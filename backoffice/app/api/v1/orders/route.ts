import { NextResponse } from "next/server";

import { createOrSyncOrder, validateCreateOrderInput, type CreateOrderInput } from "../../../../lib/siteb-order-api";
import { requireSiteBApiAuth } from "../../../../lib/siteb-api-auth";

export async function POST(request: Request) {
  const claims = requireSiteBApiAuth(request);
  if (!claims) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as CreateOrderInput;
    validateCreateOrderInput(body);
    const result = await createOrSyncOrder(body);
    return NextResponse.json(
      {
        success: true,
        ...result
      },
      { status: result.created ? 201 : 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Create order failed." },
      { status: 400 }
    );
  }
}
