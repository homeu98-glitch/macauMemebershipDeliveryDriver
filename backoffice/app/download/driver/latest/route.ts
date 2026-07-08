import { NextResponse } from "next/server";

export async function GET() {
  const apkUrl = process.env.DRIVER_APK_DOWNLOAD_URL?.trim();

  if (!apkUrl) {
    return NextResponse.json(
      { message: "DRIVER_APK_DOWNLOAD_URL is not configured." },
      { status: 500 }
    );
  }

  return NextResponse.redirect(apkUrl, 307);
}
