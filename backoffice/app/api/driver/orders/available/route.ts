import { NextResponse } from "next/server";

import { withDriverSession } from "@/app/api/driver/_shared";
import { listAvailableOrders } from "@/lib/driver-web-data";

export async function GET() {
  return withDriverSession(async () => NextResponse.json({ orders: await listAvailableOrders() }));
}
