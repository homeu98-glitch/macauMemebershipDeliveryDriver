import { NextResponse } from "next/server";

import { createOrSyncOrder, validateCreateOrderInput, type CreateOrderInput } from "../../../../lib/siteb-order-api";
import { requireSiteBApiAuth } from "../../../../lib/siteb-api-auth";
import { apiError, apiSuccess } from "../../../../lib/siteb-http";

export async function POST(request: Request) {
  const claims = requireSiteBApiAuth(request);
  if (!claims) {
    return apiError(401, "unauthorized", "Unauthorized.");
  }

  try {
    const body = (await request.json()) as CreateOrderInput;
    validateCreateOrderInput(body);
    const result = await createOrSyncOrder(body);
    return apiSuccess(result, result.created ? 201 : 200);
  } catch (error) {
    return apiError(
      400,
      "create_order_failed",
      error instanceof Error ? error.message : "Create order failed."
    );
  }
}
