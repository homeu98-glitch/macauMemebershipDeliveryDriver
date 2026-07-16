import { NextResponse } from "next/server";

import { withDriverSession } from "@/app/api/driver/_shared";
import { getOrSetMemoryCache } from "@/lib/server-memory-cache";

const DRIVER_LEADERBOARD_CACHE_TTL_MS = 60_000;

export async function GET(request: Request) {
  return withDriverSession(async (session) => {
    const payload = await getOrSetMemoryCache(`driver:leaderboard:${session.driverId}`, DRIVER_LEADERBOARD_CACHE_TTL_MS, async () => {
      const origin = new URL(request.url).origin;
      const response = await fetch(`${origin}/api/mobile/leaderboard/weekly`, {
        cache: "no-store",
        headers: { "x-supabase-access-token": session.accessToken }
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(text || `leaderboard_failed:${response.status}`);
      }
      try {
        return JSON.parse(text);
      } catch {
        return { entries: [] };
      }
    });

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" }
    });
  });
}
