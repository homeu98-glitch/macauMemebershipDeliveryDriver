import { NextResponse } from "next/server";

import { withDriverSession } from "@/app/api/driver/_shared";
import { listPublishedDriverAnnouncements } from "@/lib/driver-announcements";
import { getDriverLegalState, maskPhoneFrontFour } from "@/lib/driver-web-data";

export async function GET() {
  return withDriverSession(async (session) => {
    const legal = await getDriverLegalState(session.driverId);
    const announcements = await listPublishedDriverAnnouncements(5);

    return NextResponse.json({
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
    });
  });
}
