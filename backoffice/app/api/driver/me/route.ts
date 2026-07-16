import { NextResponse } from "next/server";

import { withDriverSession } from "@/app/api/driver/_shared";
import { listPublishedDriverAnnouncements } from "@/lib/driver-announcements";
import { getDriverLegalState, maskPhoneFrontFour } from "@/lib/driver-web-data";
import { getOrSetMemoryCache } from "@/lib/server-memory-cache";

const DRIVER_ME_CACHE_TTL_MS = 60_000;

export async function GET() {
  return withDriverSession(async (session) => {
    const payload = await getOrSetMemoryCache(`driver:me:${session.driverId}`, DRIVER_ME_CACHE_TTL_MS, async () => {
      const legal = await getDriverLegalState(session.driverId);
      const announcements = await listPublishedDriverAnnouncements(5);
      return {
        driverId: session.driverId,
        fullName: session.fullName,
        maskedPhone: maskPhoneFrontFour(session.phone),
        approvalStatus: session.approvalStatus,
        availability: session.availability,
        acceptedTermsAt: legal.acceptedAt,
        announcements: announcements.map((item) => ({
          id: item.id,
          title: item.title,
          content: item.content,
          createdAt: item.createdAt
        }))
      };
    });

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" }
    });
  });
}
