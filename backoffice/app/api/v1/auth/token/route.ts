import { NextResponse } from "next/server";

import { createSiteBApiToken, getConfiguredClientId } from "../../../../../lib/siteb-api-auth";
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
    const expectedClientId = getConfiguredClientId();
    const sharedSecret =
      process.env.SITEB_DELIVERY_CLIENT_SECRET?.trim() ??
      process.env.JWT_SHARED_SECRET?.trim() ??
      "";
    const previousSecret =
      process.env.SITEB_DELIVERY_CLIENT_SECRET_PREVIOUS?.trim() ??
      process.env.JWT_SHARED_SECRET_PREVIOUS?.trim() ??
      "";
    if (!clientId || !clientSecret) {
      return apiError(400, "bad_request", "clientId and clientSecret are required.");
    }


    if (clientId !== expectedClientId) {
      return apiError(401, "invalid_client", "Invalid client credentials.");
    }

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
