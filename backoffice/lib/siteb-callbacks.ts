import crypto from "crypto";

import { createSiteBApiToken, getConfiguredWebhookSecret } from "./siteb-api-auth";
import { createServiceRoleSupabaseClient } from "./supabase";

type DispatchCallbackInput = {
  orderId: string;
  eventType:
    | "accepted"
    | "picked_up"
    | "arrived"
    | "delivered"
    | "exception_reported"
    | "canceled";
  note?: string | null;
  action?: string | null;
};

function haversineKm(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
) {
  if (!startLat || !startLng || !endLat || !endLng) return 0;
  const earthRadiusKm = 6371;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(endLat - startLat);
  const dLng = toRad(endLng - startLng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(startLat)) *
      Math.cos(toRad(endLat)) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(earthRadiusKm * c * 10) / 10;
}

function normalizeEndpoint(url: string) {
  return url.trim();
}

async function buildSignedProofUrl(storagePath: string) {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase.storage
    .from("delivery-proofs")
    .createSignedUrl(storagePath, 60 * 60 * 24);
  if (error) throw error;
  return data.signedUrl;
}

async function loadOrderCallbackContext(orderId: string) {
  const supabase = createServiceRoleSupabaseClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("id,external_order_id,status,assigned_fee_mop,promised_at,created_at,source_payload,shop_id,customer_id")
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw error;
  if (!order) {
    throw new Error("Order not found.");
  }

  const callbackMeta =
    typeof order.source_payload === "object" && order.source_payload
      ? (order.source_payload as Record<string, unknown>).callback
      : null;

  const callback =
    callbackMeta && typeof callbackMeta === "object"
      ? (callbackMeta as { url?: string; secret?: string; headers?: Record<string, string> })
      : null;

  if (!callback?.url?.trim()) {
    throw new Error("Callback URL is missing from order source payload.");
  }

  const [{ data: shop }, { data: customer }, { data: assignment }, { data: location }, { data: proof }] =
    await Promise.all([
      supabase
        .from("shops")
        .select("name,address,latitude,longitude,contact_name,contact_phone")
        .eq("id", order.shop_id)
        .maybeSingle(),
      supabase
        .from("customers")
        .select("name,address,phone")
        .eq("id", order.customer_id)
        .maybeSingle(),
      supabase
        .from("order_assignments")
        .select("driver_id,assigned_at,accepted_at")
        .eq("order_id", order.id)
        .order("assigned_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("driver_locations")
        .select("latitude,longitude,captured_at")
        .order("captured_at", { ascending: false })
        .limit(1),
      supabase
        .from("delivery_proofs")
        .select("storage_path,created_at")
        .eq("order_id", order.id)
        .order("created_at", { ascending: false })
        .limit(1)
    ]);

  let driver: { full_name: string; phone: string } | null = null;
  if (assignment?.driver_id) {
    const { data: driverRow } = await supabase
      .from("driver_profiles")
      .select("full_name,phone")
      .eq("id", assignment.driver_id)
      .maybeSingle();
    driver = driverRow ?? null;
  }

  return {
    order,
    callback,
    shop,
    customer,
    assignment,
    driver,
    latestDriverLocation: location?.[0] ?? null,
    latestProof: proof?.[0] ?? null
  };
}

function createCallbackPayload(
  context: Awaited<ReturnType<typeof loadOrderCallbackContext>>,
  input: DispatchCallbackInput,
  proofUrl: string | null
) {
  const eventTime = new Date().toISOString();
  const distanceToShopKm =
    context.latestDriverLocation &&
    context.shop?.latitude &&
    context.shop?.longitude
      ? haversineKm(
          Number(context.latestDriverLocation.latitude),
          Number(context.latestDriverLocation.longitude),
          Number(context.shop.latitude),
          Number(context.shop.longitude)
        )
      : 0;

  switch (input.eventType) {
    case "accepted":
      return {
        eventType: "order.accepted",
        externalOrderId: context.order.external_order_id,
        status: "accepted",
        eventTime,
        driver: {
          fullName: context.driver?.full_name ?? "未命名騎手",
          phone: context.driver?.phone ?? "",
          distanceToShopKm,
          etaMinutes: 0
        },
        pickupTime: context.assignment?.accepted_at ?? eventTime
      };
    case "picked_up":
      return {
        eventType: "order.picked_up",
        externalOrderId: context.order.external_order_id,
        status: "picked_up",
        eventTime,
        driver: {
          fullName: context.driver?.full_name ?? "未命名騎手",
          phone: context.driver?.phone ?? ""
        }
      };
    case "arrived":
      return {
        eventType: "order.arrived_customer",
        externalOrderId: context.order.external_order_id,
        status: "arrived_customer",
        eventTime
      };
    case "delivered":
      return {
        eventType: "order.delivered",
        externalOrderId: context.order.external_order_id,
        status: "delivered",
        eventTime,
        proof: {
          imageUrl: proofUrl,
          storagePath: context.latestProof?.storage_path ?? null,
          uploadedAt: context.latestProof?.created_at ?? eventTime
        }
      };
    case "exception_reported":
      return {
        eventType: "order.exception_reported",
        externalOrderId: context.order.external_order_id,
        status: "exception_reported",
        eventTime,
        exception: {
          reason: input.note ?? "driver_reported_issue",
          action: input.action ?? "pending_review",
          note: input.note ?? "Driver reported an issue."
        }
      };
    case "canceled":
      return {
        eventType: "order.canceled",
        externalOrderId: context.order.external_order_id,
        status: "canceled",
        eventTime,
        cancel: {
          reason: input.note ?? "unknown",
          note: input.note ?? ""
        }
      };
  }
}

export async function dispatchOrderCallback(input: DispatchCallbackInput) {
  const supabase = createServiceRoleSupabaseClient();
  const context = await loadOrderCallbackContext(input.orderId);
  const proofUrl =
    input.eventType === "delivered" && context.latestProof?.storage_path
      ? await buildSignedProofUrl(context.latestProof.storage_path)
      : null;

  const payload = createCallbackPayload(context, input, proofUrl);
  const endpoint = normalizeEndpoint(context.callback.url!);
  const rawPayload = JSON.stringify(payload);
  const timestamp = new Date().toISOString();
  const signature =
    (context.callback.secret?.trim() || getConfiguredWebhookSecret())
      ? crypto
          .createHmac("sha256", context.callback.secret?.trim() || getConfiguredWebhookSecret())
          .update(`${timestamp}.${rawPayload}`)
          .digest("hex")
      : null;

  let responseStatus = 500;
  let responseBody: unknown = { message: "Callback not sent." };
  let attempts = 0;

  const delaysMs = [0, 1000, 5000];
  for (let i = 0; i < delaysMs.length; i += 1) {
    attempts = i + 1;
    if (delaysMs[i] > 0) {
      await new Promise((resolve) => setTimeout(resolve, delaysMs[i]));
    }

    try {
      const callbackResponse: Response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${createSiteBApiToken("siteb-driver-callback", "siteb-api").accessToken}`,
          ...(signature
            ? {
                "X-SiteB-Timestamp": timestamp,
                "X-SiteB-Signature": signature
              }
            : {}),
          ...(context.callback.headers ?? {})
        },
        body: rawPayload
      });

      responseStatus = callbackResponse.status;
      const rawBody = await callbackResponse.text();
      try {
        responseBody = rawBody ? JSON.parse(rawBody) : {};
      } catch {
        responseBody = { message: rawBody };
      }

      if (responseStatus >= 200 && responseStatus < 300) {
        break;
      }
    } catch (error) {
      responseStatus = 500;
      responseBody = {
        message: error instanceof Error ? error.message : "Callback dispatch failed."
      };
    }
  }

  const { data: logRow } = await supabase
    .from("callback_logs")
    .insert({
    order_id: context.order.id,
    event_type: payload.eventType,
    endpoint,
    http_status: responseStatus,
    request_body: payload,
      response_body: {
        ...(typeof responseBody === "object" && responseBody ? (responseBody as any) : { message: String(responseBody) }),
        attempts
      },
    sent_at: new Date().toISOString()
    })
    .select("id")
    .single();

  return {
    success: responseStatus >= 200 && responseStatus < 300,
    status: responseStatus,
    logId: logRow?.id ?? null,
    attempts,
    payload,
    responseBody
  };
}
