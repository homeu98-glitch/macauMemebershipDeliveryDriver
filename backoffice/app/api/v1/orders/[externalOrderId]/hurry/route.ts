import { NextResponse } from "next/server";

import { hurryOrderByExternalId } from "../../../../../../lib/siteb-order-api";
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
      return NextResponse.json({ message: "Order not found." }, { status: 404 });
    }

    if (!result.pushed) {
      return NextResponse.json(
        {
          success: true,
          externalOrderId: params.externalOrderId,
          status: result.status,
          pushed: false
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      success: true,
      externalOrderId: params.externalOrderId,
      status: result.status,
      pushed: true
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Hurry order failed." },
      { status: 500 }
    );
  }
}
