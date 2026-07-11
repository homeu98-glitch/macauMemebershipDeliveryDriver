import { NextResponse } from "next/server";

import { applyDriverSessionCookie, ensureActiveDriverSession } from "@/lib/driver-web-auth";

export async function withDriverSession(handler: (session: NonNullable<Awaited<ReturnType<typeof ensureActiveDriverSession>>["session"]>) => Promise<NextResponse>) {
  const { session, refreshed } = await ensureActiveDriverSession();
  if (!session) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  const response = await handler(session);
  if (refreshed) applyDriverSessionCookie(response, session);
  return response;
}
