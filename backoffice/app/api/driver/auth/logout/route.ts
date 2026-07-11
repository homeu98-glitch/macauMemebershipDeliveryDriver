import { NextResponse } from "next/server";

import { clearDriverSessionCookie } from "@/lib/driver-web-auth";

export async function POST() {
  const response = NextResponse.json({ success: true });
  clearDriverSessionCookie(response);
  return response;
}
