import crypto from "crypto";
import { NextResponse } from "next/server";

import { getConfiguredWebhookSecret } from "../../../../../../lib/siteb-api-auth";
import { createServiceRoleSupabaseClient } from "../../../../../../lib/supabase";

function buildExpectedSignature(secret: string, timestamp: string, rawBody: string) {
  return crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const timestamp = request.headers.get("x-siteb-timestamp")?.trim() ?? "";
  const signature = request.headers.get("x-siteb-signature")?.trim() ?? "";
  const configuredSecret = getConfiguredWebhookSecret();

  let payload: Record<string, unknown> = {};
  try {
    payload = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
  } catch {
    payload = { rawBody };
  }

  const externalOrderId =
    typeof payload.externalOrderId === "string" ? payload.externalOrderId : null;
  const eventType =
    typeof payload.eventType === "string" ? payload.eventType : "unknown";

  const shouldVerify = Boolean(configuredSecret && timestamp && signature);
  const signatureValid = shouldVerify
    ? buildExpectedSignature(configuredSecret, timestamp, rawBody) === signature
    : true;

  const supabase = createServiceRoleSupabaseClient();
  await supabase.from("sync_logs").insert({
    source: "siteb_callback_receiver",
    external_id: externalOrderId,
    status: signatureValid ? "received" : "rejected",
    message: signatureValid
      ? `Received ${eventType}`
      : "Invalid webhook signature",
    payload: {
      ...payload,
      receivedHeaders: {
        authorization: request.headers.get("authorization"),
        xSiteBTimestamp: timestamp || null,
        xSiteBSignature: signature ? "present" : null
      }
    }
  });

  if (!signatureValid) {
    return NextResponse.json(
      {
        ok: false,
        message: "Invalid signature."
      },
      { status: 401 }
    );
  }

  return NextResponse.json({
    ok: true,
    received: true,
    eventType,
    externalOrderId
  });
}
