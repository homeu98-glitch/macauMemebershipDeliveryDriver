import { NextResponse } from "next/server";

import { withDriverSession } from "@/app/api/driver/_shared";
import { getDriverOrderDetail } from "@/lib/driver-web-data";

export async function GET(_request: Request, { params }: { params: { orderId: string } }) {
  return withDriverSession(async (session) => {
    const detail = await getDriverOrderDetail(session.driverId, params.orderId);
    if (!detail) return NextResponse.json({ message: "找不到訂單資料。" }, { status: 404 });
    return NextResponse.json(detail);
  });
}
