import { NextResponse } from "next/server";

import { cancelOrderByExternalId } from "@/lib/siteb-order-api";
import { requireSiteBApiAuth } from "../../../../../../lib/siteb-api-auth";

export async function POST(
  request: Request,
  { params }: { params: { externalOrderId: string } }
) {
  const claims = requireSiteBApiAuth(request);
  if (!claims) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      reason?: string;
      requestedBy?: string;
      requestedAt?: string;
    };

    const result = await cancelOrderByExternalId(
      params.externalOrderId,
      body.reason?.trim() || "shop_owner_cancelled",
      body.requestedBy?.trim() || claims.sub,
      body.requestedAt?.trim()
    );

    if (!result.found) {
      return NextResponse.json({ message: "Order not found." }, { status: 404 });
    }

    if (!result.canceled) {
      return NextResponse.json(
        {
          message: "Order can no longer be canceled after pickup.",
          status: result.status
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      externalOrderId: params.externalOrderId,
      status: result.status
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Cancel order failed." },
      { status: 500 }
    );
  }
}
