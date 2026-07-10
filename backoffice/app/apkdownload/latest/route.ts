import { NextResponse } from "next/server";

import { getDriverAppDownloadConfig } from "../../../lib/app-release-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = await getDriverAppDownloadConfig().catch(() => null);
  const apkUrl = config?.apkUrl || "";

  if (!apkUrl) {
    return NextResponse.json({ message: "No APK configured yet." }, { status: 404 });
  }

  return NextResponse.redirect(apkUrl, {
    status: 307,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

