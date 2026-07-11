import { NextResponse } from "next/server";

import { withDriverSession } from "@/app/api/driver/_shared";
import { getDriverLegalState } from "@/lib/driver-web-data";

export async function GET() {
  return withDriverSession(async (session) => NextResponse.json(await getDriverLegalState(session.driverId)));
}
