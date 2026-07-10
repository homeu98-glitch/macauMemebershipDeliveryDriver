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
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    version: String(data.version),
    releaseNotes: String(data.release_notes ?? ""),
    apkUrl: String(data.apk_url),
  };
}


export async function GET() {
  const active = await getActiveDriverAppReleaseDirect().catch(() => null);
  const legacyConfig = active ? null : await getDriverAppDownloadConfig().catch(() => null);
  const apkUrl = active?.apkUrl || legacyConfig?.apkUrl || "";

  if (!apkUrl) {
    return NextResponse.json({ message: "No APK configured yet." }, { status: 404 });
  }
  return NextResponse.redirect(apkUrl, 307);
}
