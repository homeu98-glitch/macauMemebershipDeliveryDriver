import { createServiceRoleSupabaseClient } from "./supabase";
import { publishBroadcastDispatchEvent, publishDriverDispatchEvent } from "./mqtt-dispatch";

const webpush = require("web-push") as typeof import("web-push");

type SendPushOptions = {
  title: string;
  body: string;
  soundKey?: "new_order" | "urgent_order" | "customer_hurry" | "order_completed" | "order_cancelled";
  data?: Record<string, string>;
};

type WebPushSubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

function logPush(event: string, payload: Record<string, unknown>) {
  console.info(`[push] ${event} ${JSON.stringify(payload)}`);
}

function hasWebPushConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY?.trim() &&
    process.env.WEB_PUSH_PRIVATE_KEY?.trim()
  );
}

let webPushConfigured = false;
function ensureWebPushConfigured() {
  if (webPushConfigured || !hasWebPushConfig()) return false;
  webpush.setVapidDetails(
    process.env.WEB_PUSH_SUBJECT?.trim() || "mailto:support@macau-delivery.local",
    process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY!.trim(),
    process.env.WEB_PUSH_PRIVATE_KEY!.trim()
  );
  webPushConfigured = true;
  return true;
}

async function listWebSubscriptionsByDriverIds(driverIds: string[]) {
  if (!driverIds.length) return [] as Array<WebPushSubscriptionRow & { driver_id: string }>;
  const supabase = createServiceRoleSupabaseClient();
  const { data } = await supabase
    .from("driver_web_push_subscriptions")
    .select("driver_id,endpoint,p256dh,auth")
    .in("driver_id", driverIds);
  return (data ?? []) as Array<WebPushSubscriptionRow & { driver_id: string }>;
}

async function sendWebPushRows(rows: Array<WebPushSubscriptionRow>, payload: SendPushOptions) {
  if (!ensureWebPushConfigured()) {
    return { successCount: 0, failureCount: 0, skipped: true };
  }

  let successCount = 0;
  let failureCount = 0;
  for (const row of rows) {
    try {
      await webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: {
            p256dh: row.p256dh,
            auth: row.auth
          }
        },
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          soundKey: payload.soundKey ?? "new_order",
          url: payload.data?.url || "/driver/home",
          data: payload.data ?? {}
        })
      );
      successCount += 1;
    } catch (error) {
      failureCount += 1;
      logPush("web_push_send_failed", {
        endpoint: row.endpoint,
        message: error instanceof Error ? error.message : "unknown"
      });
    }
  }

  return { successCount, failureCount, skipped: false };
}

async function sendWebPushToDriver(driverId: string, payload: SendPushOptions) {
  const rows = await listWebSubscriptionsByDriverIds([driverId]);
  return sendWebPushRows(rows.map((row) => ({ endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth })), payload);
}

async function sendWebPushToOnlineDrivers(payload: SendPushOptions) {
  const supabase = createServiceRoleSupabaseClient();
  const { data: drivers } = await supabase
    .from("driver_profiles")
    .select("id")
    .eq("availability", "online")
    .eq("approval_status", "approved");
  const driverIds = (drivers ?? []).map((item: any) => item.id as string);
  const rows = await listWebSubscriptionsByDriverIds(driverIds);
  return sendWebPushRows(rows.map((row) => ({ endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth })), payload);
}

export async function sendPushToDriver(driverId: string, payload: SendPushOptions) {
  logPush("push_driver_start", {
    driverId,
    soundKey: payload.soundKey ?? "new_order",
    data: payload.data ?? null,
    title: payload.title
  });

  const [mqttResult, webPushResult] = await Promise.all([
    publishDriverDispatchEvent(driverId, payload),
    sendWebPushToDriver(driverId, payload).catch(() => ({ successCount: 0, failureCount: 1, skipped: false }))
  ]);

  logPush("push_driver_result", {
    driverId,
    mqttResult,
    webPushResult
  });

  return {
    successCount: (mqttResult.published ? 1 : 0) + webPushResult.successCount,
    failureCount: (mqttResult.published ? 0 : 1) + webPushResult.failureCount,
    mqttResult,
    webPushResult
  };
}

export async function sendPushToOnlineDrivers(payload: SendPushOptions) {
  logPush("push_broadcast_start", {
    soundKey: payload.soundKey ?? "new_order",
    data: payload.data ?? null,
    title: payload.title
  });

  const [mqttResult, webPushResult] = await Promise.all([
    publishBroadcastDispatchEvent(payload),
    sendWebPushToOnlineDrivers(payload).catch(() => ({ successCount: 0, failureCount: 1, skipped: false }))
  ]);

  logPush("push_broadcast_result", {
    mqttResult,
    webPushResult
  });

  return {
    successCount: (mqttResult.published ? 1 : 0) + webPushResult.successCount,
    failureCount: (mqttResult.published ? 0 : 1) + webPushResult.failureCount,
    mqttResult,
    webPushResult
  };
}
