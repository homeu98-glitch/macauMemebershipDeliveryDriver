import { NextResponse } from "next/server";

import { withDriverSession } from "@/app/api/driver/_shared";
import { listCompletedOrders } from "@/lib/driver-web-data";

export async function GET(request: Request) {
  return withDriverSession(async (session) => {
    const range = new URL(request.url).searchParams.get("range");
    const safeRange = range === "week" || range === "history" ? range : "today";
    return NextResponse.json({ orders: await listCompletedOrders(session.driverId, safeRange) });
  });
}
