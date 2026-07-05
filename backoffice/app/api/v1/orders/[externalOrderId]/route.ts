import { NextResponse } from "next/server";

import { getOrderStatusByExternalId } from "@/lib/siteb-order-api";
import { requireSiteBApiAuth } from "../../../../../lib/siteb-api-auth";

export async function GET(
  request: Request,
  { params }: { params: { externalOrderId: string } }
) {
  const claims = requireSiteBApiAuth(request);
  if (!claims) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    const order = await getOrderStatusByExternalId(params.externalOrderId);
    if (!order) {
      return NextResponse.json({ message: "Order not found." }, { status: 404 });
    }
    return NextResponse.json(order);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Get order failed." },
      { status: 500 }
    );
  }
}
