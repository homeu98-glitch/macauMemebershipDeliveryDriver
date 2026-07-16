import { NextResponse } from "next/server";

import { withDriverSession } from "@/app/api/driver/_shared";
import { getDriverLegalState } from "@/lib/driver-web-data";
import { getOrSetMemoryCache } from "@/lib/server-memory-cache";

const DRIVER_LEGAL_CACHE_TTL_MS = 10 * 60_000;

export async function GET() {
  return withDriverSession(async (session) => {
    const payload = await getOrSetMemoryCache(`driver:legal:${session.driverId}`, DRIVER_LEGAL_CACHE_TTL_MS, async () => getDriverLegalState(session.driverId));
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=600" }
    });
  });
}
