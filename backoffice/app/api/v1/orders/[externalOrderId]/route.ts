import { NextResponse } from "next/server";

import { getOrderStatusByExternalId } from "../../../../../lib/siteb-order-api";
import { requireSiteBApiAuth } from "../../../../../lib/siteb-api-auth";
import { apiError, apiSuccess } from "../../../../../lib/siteb-http";

export async function GET(
  request: Request,
  { params }: { params: { externalOrderId: string } }
) {
  const claims = requireSiteBApiAuth(request);
  if (!claims) {
    return apiError(401, "unauthorized", "Unauthorized.");
  }

  try {
    const order = await getOrderStatusByExternalId(params.externalOrderId);
    if (!order) {
      return apiError(404, "order_not_found", "Order not found.");
    }
    return apiSuccess(order);
  } catch (error) {
    return apiError(500, "get_order_failed", error instanceof Error ? error.message : "Get order failed.");
  }
}
