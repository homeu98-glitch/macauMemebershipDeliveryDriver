import { NextResponse } from "next/server";

import { cancelOrderByExternalId } from "../../../../../../lib/siteb-order-api";
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
      return apiError(404, "order_not_found", "Order not found.");
    }

    if (!result.canceled) {
      return apiError(
        409,
        "order_conflict",
        "Order can no longer be canceled after pickup.",
        { status: result.status }
      );
    }

    return apiSuccess({
      externalOrderId: params.externalOrderId,
      status: result.status
    });
  } catch (error) {
    return apiError(500, "cancel_order_failed", error instanceof Error ? error.message : "Cancel order failed.");
  }
}
