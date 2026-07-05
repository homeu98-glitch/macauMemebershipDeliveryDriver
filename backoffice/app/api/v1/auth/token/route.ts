import { NextResponse } from "next/server";

import { createSiteBApiToken } from "../../../../../lib/siteb-api-auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      clientId?: string;
      clientSecret?: string;
      audience?: string;
    };

    const clientId = body.clientId?.trim();
    const clientSecret = body.clientSecret?.trim();
    const audience = body.audience?.trim() || "siteb-api";
    const sharedSecret = process.env.JWT_SHARED_SECRET?.trim() ?? "";

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { message: "clientId and clientSecret are required." },
        { status: 400 }
      );
    }

    if (!sharedSecret) {
      return NextResponse.json(
        { message: "JWT_SHARED_SECRET is not configured." },
        { status: 500 }
      );
    }

    if (clientSecret !== sharedSecret) {
      return NextResponse.json(
        { message: "Invalid client credentials." },
        { status: 401 }
      );
    }

    return NextResponse.json(createSiteBApiToken(clientId, audience));
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Token request failed." },
      { status: 500 }
    );
  }
}
