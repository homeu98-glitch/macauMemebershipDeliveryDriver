import { NextResponse } from "next/server";

import { getSessionUser } from "../../../../lib/auth";
import { adminCancelOrderById } from "../../../../lib/siteb-order-api";

export async function POST(request: Request) {
  const user = getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "未登入後台。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    orderId?: string;
    reason?: string;
  };
  if (!body.orderId?.trim()) {
    return NextResponse.json({ message: "orderId is required." }, { status: 400 });
  }

  try {
    const result = await adminCancelOrderById(
      body.orderId.trim(),
      user.email,
      body.reason?.trim() || "backoffice_manual_cancel"
    );
    if (!result.found) {
      return NextResponse.json({ message: "Order not found." }, { status: 404 });
    }
    if (!result.canceled) {
      return NextResponse.json(
        { message: "Delivered orders can no longer be canceled." },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Cancel failed." },
      { status: 500 }
    );
  }
}

