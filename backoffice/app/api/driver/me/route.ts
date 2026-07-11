import { NextResponse } from "next/server";

import { withDriverSession } from "@/app/api/driver/_shared";
import { getDriverLegalState, maskPhoneFrontFour } from "@/lib/driver-web-data";

export async function GET() {
  return withDriverSession(async (session) => {
    const legal = await getDriverLegalState(session.driverId);
    return NextResponse.json({ driverId: session.driverId, fullName: session.fullName, maskedPhone: maskPhoneFrontFour(session.phone), approvalStatus: session.approvalStatus, availability: session.availability, acceptedTermsAt: legal.acceptedAt });
  });
}
