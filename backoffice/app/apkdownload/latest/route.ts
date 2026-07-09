import { NextResponse } from "next/server";

import { getDriverAppDownloadConfig } from "../../../lib/app-release-config";
import { getActiveDriverAppRelease } from "../../../lib/driver-app-release";

export const dynamic = "force-dynamic";

export async function GET() {
  const active = await getActiveDriverAppRelease().catch(() => null);
  const legacyConfig = active ? null : await getDriverAppDownloadConfig().catch(() => null);
  const apkUrl = active?.apkUrl || legacyConfig?.apkUrl || "";

  if (!apkUrl) {
    return NextResponse.json({ message: "No APK configured yet." }, { status: 404 });
  }
  return NextResponse.redirect(apkUrl, 307);
}
