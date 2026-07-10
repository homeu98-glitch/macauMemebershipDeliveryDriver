import { NextResponse } from "next/server";

import { getDriverAppDownloadConfig } from "../../../lib/app-release-config";
import { createServiceRoleSupabaseClient } from "../../../lib/supabase";

export const dynamic = "force-dynamic";

async function getActiveDriverAppReleaseDirect() {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("driver_app_releases")
    .select("id,version,apk_url,release_notes,created_at,is_active")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!data || data.length === 0) return null;

  const row = data[0] as any;
  return {
    version: String(row.version),
    releaseNotes: String(row.release_notes ?? ""),
    apkUrl: String(row.apk_url),
  };
}

export async function GET() {
  const legacyConfig = await getDriverAppDownloadConfig().catch(() => null);
  const active = legacyConfig ? null : await getActiveDriverAppReleaseDirect().catch(() => null);
  const apkUrl = legacyConfig?.apkUrl || active?.apkUrl || "";

  if (!apkUrl) {
    return NextResponse.json({ message: "No APK configured yet." }, { status: 404 });
  }

  return NextResponse.redirect(apkUrl, 307);
}
