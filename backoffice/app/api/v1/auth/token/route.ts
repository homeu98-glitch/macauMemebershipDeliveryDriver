import { NextResponse } from "next/server";

import { createSiteBApiToken } from "../../../../../lib/siteb-api-auth";
import { apiError, apiSuccess } from "../../../../../lib/siteb-http";

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
      return apiError(400, "bad_request", "clientId and clientSecret are required.");
    }

    const previousSecret = process.env.JWT_SHARED_SECRET_PREVIOUS?.trim() ?? "";

    if (!sharedSecret) {
      return apiError(500, "server_not_configured", "JWT_SHARED_SECRET is not configured.");
    }

    if (clientSecret !== sharedSecret && clientSecret !== previousSecret) {
      return apiError(401, "invalid_client", "Invalid client credentials.");
    }

    return apiSuccess(createSiteBApiToken(clientId, audience));
  } catch (error) {
    return apiError(
      500,
      "token_request_failed",
      error instanceof Error ? error.message : "Token request failed."
    );
  }
}
