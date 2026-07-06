import { NextResponse } from "next/server";

import { raiseOrderPriceByExternalId } from "../../../../../../lib/siteb-order-api";
import { requireSiteBApiAuth } from "../../../../../../lib/siteb-api-auth";
import { apiError, apiSuccess } from "../../../../../../lib/siteb-http";

export async function POST(
  request: Request,
  { params }: { params: { externalOrderId: string } }
) {
  const claims = requireSiteBApiAuth(request);
  if (!claims) {
    return apiError(401, "unauthorized", "Unauthorized.");
  }

  try {
    const body = (await request.json()) as {
      newDeliveryFeeMop?: number;
      reason?: string;
      updatedAt?: string;
    };

    if (typeof body.newDeliveryFeeMop !== "number") {
      return apiError(400, "bad_request", "newDeliveryFeeMop is required.");
    }

    const result = await raiseOrderPriceByExternalId(
      params.externalOrderId,
      body.newDeliveryFeeMop,
      body.reason?.trim() || "manual_raise_price",
      body.updatedAt?.trim()
    );

    if (!result.found) {
      return apiError(404, "order_not_found", "Order not found.");
    }

    return apiSuccess({
      requestedBy: claims.sub,
      ...result
    });
  } catch (error) {
    return apiError(500, "raise_price_failed", error instanceof Error ? error.message : "Raise price failed.");
  }
}
