import { NextResponse } from "next/server";

import { getDriverAppDownloadConfig } from "../../../../../lib/app-release-config";
import { getActiveDriverAppRelease } from "../../../../../lib/driver-app-release";

export const dynamic = "force-dynamic";

type DebugInfo = {
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
  const debugEnabled = url.searchParams.get("debug") === "1";

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
        vercelRegion: process.env.VERCEL_REGION ?? null,
        gitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
        deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
        used: active ? "active" : legacyConfig ? "legacy" : "none",
        activeVersion: active?.version ?? null,
        legacyVersion: legacyConfig?.version ?? null,
        activeError: toErrString(activeError),
        legacyError: toErrString(legacyError)
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
