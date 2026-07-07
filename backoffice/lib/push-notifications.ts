import { getFirebaseAdminApp } from "./firebase-admin";
import { createServiceRoleSupabaseClient } from "./supabase";

const firebaseAdminMessaging = require("firebase-admin/messaging") as {
  getMessaging: () => {
    sendEachForMulticast: (payload: {
      tokens: string[];
      data?: Record<string, string>;
      android?: {
        priority?: string;
        ttl?: number;
      };
    }) => Promise<{
      successCount: number;
      failureCount: number;
      responses: Array<{
        success: boolean;
        messageId?: string;
        error?: { code?: string; message?: string };
      }>;
    }>;
  };
};

type SendPushOptions = {
  title: string;
  body: string;
  soundKey?: "new_order" | "urgent_order" | "customer_hurry" | "order_completed" | "order_cancelled";
  data?: Record<string, string>;
};

type DriverPushTokenRow = {
  driver_id: string;
  fcm_token: string;
};


function maskToken(token: string) {
  if (token.length <= 12) return token;
  return `${token.slice(0, 8)}...${token.slice(-4)}`;
}

function logPush(event: string, payload: Record<string, unknown>) {
  console.info(`[push] ${event} ${JSON.stringify(payload)}`);
}

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
    logPush("no_tokens", {
      driverId,
      title: payload.title,
      soundKey: payload.soundKey ?? "new_order",
      data: payload.data ?? null,
    });
    return { successCount: 0, failureCount: 0, message: "No registered push tokens found.", tokenCount: 0, tokenDebug: [] };
  }

  getFirebaseAdminApp();
  const messaging = firebaseAdminMessaging.getMessaging();
  const soundKey = payload.soundKey ?? "new_order";
  const tokenDebug = tokens.map(maskToken);
  const dataPayload = {
    ...(payload.data ?? {}),
    soundKey,
    title: payload.title,
    body: payload.body,
  };

  logPush("send_start", {
    driverId,
    tokenCount: tokens.length,
    tokenDebug,
    title: payload.title,
    soundKey,
    data: dataPayload,
  });

  const result = await messaging.sendEachForMulticast({
    tokens,
    data: dataPayload,
    android: {
      priority: "high",
      ttl: 24 * 60 * 60 * 1000,
    },
  });

  const responseDebug = result.responses.map((response, index) => ({
    token: tokenDebug[index],
    success: response.success,
    messageId: response.messageId,
    errorCode: response.error?.code,
    errorMessage: response.error?.message,
  }));

  logPush("send_result", {
    driverId,
    tokenCount: tokens.length,
    successCount: result.successCount,
    failureCount: result.failureCount,
    responseDebug,
  });

  return {
    successCount: result.successCount,
    failureCount: result.failureCount,
    tokenCount: tokens.length,
    tokenDebug,
    responseDebug,
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
