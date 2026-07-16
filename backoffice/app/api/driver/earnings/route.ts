import { NextResponse } from "next/server";

import { withDriverSession } from "@/app/api/driver/_shared";
import { getDriverEarnings } from "@/lib/driver-web-data";
import { getOrSetMemoryCache } from "@/lib/server-memory-cache";

const DRIVER_EARNINGS_CACHE_TTL_MS = 60_000;

export async function GET() {
  return withDriverSession(async (session) => {
    const payload = await getOrSetMemoryCache(`driver:earnings:${session.driverId}`, DRIVER_EARNINGS_CACHE_TTL_MS, async () => getDriverEarnings(session.driverId));
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" }
    });
  });
}
