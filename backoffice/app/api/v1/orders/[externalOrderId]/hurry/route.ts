import { NextResponse } from "next/server";

import { hurryOrderByExternalId } from "../../../../../../lib/siteb-order-api";
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
      message?: string;
      requestedBy?: string;
      requestedAt?: string;
    };

    const result = await hurryOrderByExternalId(
      params.externalOrderId,
      body.message?.trim() || "客人催單啦，請盡快送達。",
      body.requestedBy?.trim() || claims.sub,
      body.requestedAt?.trim()
    );

    if (!result.found) {
      return apiError(404, "order_not_found", "Order not found.");
    }

    if (!result.pushed) {
      return apiSuccess({
        externalOrderId: params.externalOrderId,
        status: result.status,
        pushed: false
      });
    }

    return apiSuccess({
      externalOrderId: params.externalOrderId,
      status: result.status,
      pushed: true
    });
  } catch (error) {
    return apiError(500, "hurry_order_failed", error instanceof Error ? error.message : "Hurry order failed.");
  }
}
