import { NextResponse } from "next/server";

import { getSessionUser } from "../../../../lib/auth";
import { raiseOrderPriceByExternalId } from "../../../../lib/siteb-order-api";

export async function POST(request: Request) {
  const user = getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "未登入後台。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    externalOrderId?: string;
    newDeliveryFeeMop?: number;
    reason?: string;
  };

  if (!body.externalOrderId?.trim()) {
    return NextResponse.json({ message: "externalOrderId is required." }, { status: 400 });
  }
  if (typeof body.newDeliveryFeeMop !== "number" || Number.isNaN(body.newDeliveryFeeMop)) {
    return NextResponse.json({ message: "newDeliveryFeeMop is required." }, { status: 400 });
  }

  try {
    const result = await raiseOrderPriceByExternalId(
      body.externalOrderId.trim(),
      body.newDeliveryFeeMop,
      body.reason?.trim() || `raised_by_backoffice:${user.email}`,
      new Date().toISOString()
    );
    if (!result.found) {
      return NextResponse.json({ message: "Order not found." }, { status: 404 });
    }
    if ("raised" in result && result.raised === false) {
      return NextResponse.json(
        { message: "Price can no longer be raised after pickup or completion." },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Raise price failed." },
      { status: 500 }
    );
  }
}
