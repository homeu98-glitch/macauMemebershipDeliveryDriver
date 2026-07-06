import { NextResponse } from "next/server";

import { getSessionUser } from "../../../../lib/auth";
import { confirmDriverCanceledOrderByShopOwner } from "../../../../lib/siteb-order-api";

export async function POST(request: Request) {
  const user = getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "未登入後台。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { orderId?: string };
  if (!body.orderId?.trim()) {
    return NextResponse.json({ message: "orderId is required." }, { status: 400 });
  }

  try {
    const result = await confirmDriverCanceledOrderByShopOwner(body.orderId.trim(), user.email);
    if (!result.found) {
      return NextResponse.json({ message: "Order not found." }, { status: 404 });
    }
    if (!result.confirmed) {
      return NextResponse.json(
        { message: "Only canceled orders can be confirmed by shop owner." },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Shop owner cancel confirm failed." },
      { status: 500 }
    );
  }
}

