import { NextResponse } from "next/server";

import { getDriverAppDownloadConfig } from "../../../lib/app-release-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = await getDriverAppDownloadConfig().catch(() => null);

  if (!config?.apkUrl) {
    return NextResponse.json(
      { message: "No APK configured yet." },
      { status: 404 }
    );
  }

  return NextResponse.redirect(config.apkUrl, 307);
}
