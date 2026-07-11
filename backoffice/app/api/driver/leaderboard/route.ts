import { NextResponse } from "next/server";

import { withDriverSession } from "@/app/api/driver/_shared";

export async function GET(request: Request) {
  return withDriverSession(async (session) => {
    const origin = new URL(request.url).origin;
    const response = await fetch(`${origin}/api/mobile/leaderboard/weekly`, {
      cache: "no-store",
      headers: { "x-supabase-access-token": session.accessToken }
    });
    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" }
    });
  });
}
