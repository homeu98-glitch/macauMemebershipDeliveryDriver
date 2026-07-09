import { NextResponse } from "next/server";

import { getActiveDriverAppRelease } from "../../../lib/driver-app-release";

export const dynamic = "force-dynamic";

export async function GET() {
  const active = await getActiveDriverAppRelease().catch(() => null);
  if (!active?.apkUrl) {
    return NextResponse.json({ message: "No APK configured yet." }, { status: 404 });
  }
  return NextResponse.redirect(active.apkUrl, 307);
}
