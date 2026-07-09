import { NextResponse } from "next/server";

import { getActiveDriverAppRelease } from "../../../../../lib/driver-app-release";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const active = await getActiveDriverAppRelease().catch(() => null);
  const url = new URL(request.url);
  const origin = url.origin;

  if (!active) {
    return NextResponse.json({
      success: false,
      message: "No active release configured.",
      landingPageUrl: `${origin}/apkdownload`,
      stableDownloadUrl: `${origin}/apkdownload/latest`
    });
  }

  return NextResponse.json({
    success: true,
    version: active.version,
    releaseNotes: active.releaseNotes,
    landingPageUrl: `${origin}/apkdownload`,
    stableDownloadUrl: `${origin}/apkdownload/latest`
  });
}
