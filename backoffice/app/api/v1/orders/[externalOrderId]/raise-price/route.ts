import { NextResponse } from "next/server";

import { raiseOrderPriceByExternalId } from "@/lib/siteb-order-api";
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
      newDeliveryFeeMop?: number;
      reason?: string;
      updatedAt?: string;
    };

    if (typeof body.newDeliveryFeeMop !== "number") {
      return NextResponse.json(
        { message: "newDeliveryFeeMop is required." },
        { status: 400 }
      );
    }

    const result = await raiseOrderPriceByExternalId(
      params.externalOrderId,
      body.newDeliveryFeeMop,
      body.reason?.trim() || "manual_raise_price",
      body.updatedAt?.trim()
    );

    if (!result.found) {
      return NextResponse.json({ message: "Order not found." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      requestedBy: claims.sub,
      ...result
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Raise price failed." },
      { status: 500 }
    );
  }
}
