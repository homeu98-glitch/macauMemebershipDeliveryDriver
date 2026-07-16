import { NextResponse } from "next/server";

import { withDriverSession } from "@/app/api/driver/_shared";
import { listPublishedDriverAnnouncements } from "@/lib/driver-announcements";
import { getDriverEarnings, getDriverLegalState, maskPhoneFrontFour } from "@/lib/driver-web-data";
import { getOrSetMemoryCache } from "@/lib/server-memory-cache";

const DRIVER_PROFILE_BOOTSTRAP_CACHE_TTL_MS = 60_000;

export async function GET(request: Request) {
  return withDriverSession(async (session) => {
    const payload = await getOrSetMemoryCache(`driver:profile-bootstrap:${session.driverId}`, DRIVER_PROFILE_BOOTSTRAP_CACHE_TTL_MS, async () => {
      const origin = new URL(request.url).origin;
      const [legal, announcements, earnings, leaderboardResponse] = await Promise.all([
        getDriverLegalState(session.driverId),
        listPublishedDriverAnnouncements(5),
        getDriverEarnings(session.driverId),
        fetch(`${origin}/api/mobile/leaderboard/weekly`, {
          cache: "no-store",
          headers: { "x-supabase-access-token": session.accessToken }
        })
      ]);

      const leaderboardText = await leaderboardResponse.text();
      let leaderboard: unknown = { entries: [] };
      try {
        leaderboard = leaderboardText ? JSON.parse(leaderboardText) : { entries: [] };
      } catch {
        leaderboard = { entries: [] };
      }

      return {
        me: {
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
        },
        legal,
        earnings,
        leaderboard
      };
    });

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" }
    });
  });
}
