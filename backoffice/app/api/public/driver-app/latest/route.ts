import { NextResponse } from "next/server";

import { getDriverAppDownloadConfig } from "../../../../../lib/app-release-config";
import { getActiveDriverAppRelease } from "../../../../../lib/driver-app-release";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const active = await getActiveDriverAppRelease().catch(() => null);
  const legacyConfig = active ? null : await getDriverAppDownloadConfig().catch(() => null);
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

  const url = new URL(request.url);
  const origin = url.origin;

  if (!current) {
    return NextResponse.json({
      success: false,
      message: "No active release configured.",
      landingPageUrl: `${origin}/apkdownload`,
      stableDownloadUrl: `${origin}/apkdownload/latest`
    });
  }

  return NextResponse.json({
    success: true,
    version: current.version,
    releaseNotes: current.releaseNotes,
    landingPageUrl: `${origin}/apkdownload`,
    stableDownloadUrl: `${origin}/apkdownload/latest`
  });
}
