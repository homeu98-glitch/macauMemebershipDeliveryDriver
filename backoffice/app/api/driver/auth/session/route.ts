import { NextResponse } from "next/server";

import { applyDriverSessionCookie, ensureActiveDriverSession } from "@/lib/driver-web-auth";

export async function GET() {
  const { session, refreshed } = await ensureActiveDriverSession();
  if (!session) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  const response = NextResponse.json({ driverId: session.driverId, fullName: session.fullName, approvalStatus: session.approvalStatus, availability: session.availability });
  if (refreshed) applyDriverSessionCookie(response, session);
  return response;
}
