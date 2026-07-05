import { getMessaging } from "firebase-admin/messaging";

import { getFirebaseAdminApp } from "./firebase-admin";
import { createServiceRoleSupabaseClient } from "./supabase";

type SendPushOptions = {
  title: string;
  body: string;
  soundKey?: "new_order" | "urgent_order" | "order_completed" | "order_cancelled";
  data?: Record<string, string>;
};

type DriverPushTokenRow = {
  driver_id: string;
  fcm_token: string;
};

async function loadDriverTokens(driverId?: string) {
  const supabase = createServiceRoleSupabaseClient();
  let query = supabase
    .from("driver_push_tokens")
    .select("driver_id,fcm_token")
    .order("last_seen_at", { ascending: false });

  if (driverId) {
    query = query.eq("driver_id", driverId);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data ?? []) as DriverPushTokenRow[];
}

export async function sendPushToDriver(driverId: string, payload: SendPushOptions) {
  const rows = await loadDriverTokens(driverId);
  const tokens = [...new Set(rows.map((row) => row.fcm_token).filter(Boolean))];
  if (!tokens.length) {
    return { successCount: 0, failureCount: 0, message: "No registered push tokens found." };
  }

  const app = getFirebaseAdminApp();
  const messaging = getMessaging(app);
  const soundKey = payload.soundKey ?? "new_order";
  const channelId =
    soundKey === "urgent_order"
      ? "driver_urgent_order_alerts"
      : soundKey === "order_completed"
        ? "driver_order_completed_alerts"
        : soundKey === "order_cancelled"
          ? "driver_order_cancelled_alerts"
          : "driver_order_alerts";
  const soundName =
    soundKey === "urgent_order"
      ? "sound_urgent_order"
      : soundKey === "order_completed"
        ? "sound_order_completed"
        : soundKey === "order_cancelled"
          ? "sound_order_cancelled"
          : "sound_new_order";
  const result = await messaging.sendEachForMulticast({
    tokens,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: {
      ...(payload.data ?? {}),
      soundKey,
      title: payload.title,
      body: payload.body,
    },
    android: {
      priority: "high",
      notification: {
        channelId,
        sound: soundName,
      },
    },
  });

  return {
    successCount: result.successCount,
    failureCount: result.failureCount,
  };
}

export async function sendPushToOnlineDrivers(payload: SendPushOptions) {
  const supabase = createServiceRoleSupabaseClient();
  const { data: drivers, error } = await supabase
    .from("driver_profiles")
    .select("id")
    .eq("approval_status", "approved")
    .eq("availability", "online");

  if (error) {
    throw error;
  }

  let successCount = 0;
  let failureCount = 0;
  for (const driver of drivers ?? []) {
    const result = await sendPushToDriver(driver.id, payload);
    successCount += result.successCount;
    failureCount += result.failureCount;
  }

  return { successCount, failureCount };
}
