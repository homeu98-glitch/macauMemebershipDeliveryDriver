import { NextResponse } from "next/server";

import { getDriverAppDownloadConfig } from "../../../../../lib/app-release-config";
import { getActiveDriverAppRelease } from "../../../../../lib/driver-app-release";
import { createServiceRoleSupabaseClient } from "../../../../../lib/supabase";

export const dynamic = "force-dynamic";

type DebugInfo = {
  supabaseUrl: string | null;
  serviceRoleKeyPresent: boolean;
  activeRows?: Array<{ id: string; version: string; createdAt: string; isActive: boolean }>;
  topRows?: Array<{ id: string; version: string; createdAt: string; isActive: boolean }>;
  vercelRegion: string | null;
  gitCommitSha: string | null;
  deploymentId: string | null;
  used: "active" | "legacy" | "none";
  activeVersion: string | null;
  legacyVersion: string | null;
  activeError: string | null;
  legacyError: string | null;
};

function toErrString(error: unknown) {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  return String(error);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const debugLevel = url.searchParams.get("debug");
  const debugEnabled = debugLevel === "1" || debugLevel === "2";

  let activeError: unknown = null;
  let legacyError: unknown = null;

  const active = await getActiveDriverAppRelease().catch((e) => {
    activeError = e;
    return null;
  });

  const legacyConfig = active
    ? null
    : await getDriverAppDownloadConfig().catch((e) => {
        legacyError = e;
        return null;
      });



let activeRows:
  | Array<{ id: string; version: string; createdAt: string; isActive: boolean }>
  | undefined;
let topRows:
  | Array<{ id: string; version: string; createdAt: string; isActive: boolean }>
  | undefined;

// Deep debug mode: show what the backend actually sees in DB
if (debugLevel === "2") {
  try {
    const supabase = createServiceRoleSupabaseClient();
    const { data: actives } = await supabase
      .from("driver_app_releases")
      .select("id,version,created_at,is_active")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    activeRows = (actives ?? []).map((row: any) => ({
      id: String(row.id),
      version: String(row.version),
      createdAt: String(row.created_at),
      isActive: Boolean(row.is_active),
    }));

    const { data: tops } = await supabase
      .from("driver_app_releases")
      .select("id,version,created_at,is_active")
      .order("created_at", { ascending: false })
      .limit(5);

    topRows = (tops ?? []).map((row: any) => ({
      id: String(row.id),
      version: String(row.version),
      createdAt: String(row.created_at),
      isActive: Boolean(row.is_active),
    }));
  } catch {
    // ignore deep debug failure
  }
}

  const current = active
    ? {
        version: active.version,
        releaseNotes: active.releaseNotes,
        apkUrl: active.apkUrl
      }
    : legacyConfig
      ? {
          version: legacyConfig.version,
          releaseNotes: legacyConfig.releaseNotes,
          apkUrl: legacyConfig.apkUrl
        }
      : null;

  const debug: DebugInfo | undefined = debugEnabled
    ? {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
        serviceRoleKeyPresent: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
        vercelRegion: process.env.VERCEL_REGION ?? null,
        gitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
        deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
        used: active ? "active" : legacyConfig ? "legacy" : "none",
        activeVersion: active?.version ?? null,
        legacyVersion: legacyConfig?.version ?? null,
        activeError: toErrString(activeError),
        legacyError: toErrString(legacyError),
        ...(debugLevel === "2" ? { activeRows, topRows } : {})
      }
    : undefined;

  if (!current) {
    return NextResponse.json(
      {
        success: false,
        message: "No active release configured.",
        landingPageUrl: `${origin}/apkdownload`,
        stableDownloadUrl: `${origin}/apkdownload/latest`,
        ...(debug ? { debug } : {})
      },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }

  return NextResponse.json(
    {
      success: true,
      version: current.version,
      releaseNotes: current.releaseNotes,
      landingPageUrl: `${origin}/apkdownload`,
      stableDownloadUrl: `${origin}/apkdownload/latest`,
      ...(debug ? { debug } : {})
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
