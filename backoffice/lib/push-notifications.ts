import { publishBroadcastDispatchEvent, publishDriverDispatchEvent } from "./mqtt-dispatch";

type SendPushOptions = {
  title: string;
  body: string;
  soundKey?: "new_order" | "urgent_order" | "customer_hurry" | "order_completed" | "order_cancelled";
  data?: Record<string, string>;
};

function logPush(event: string, payload: Record<string, unknown>) {
  console.info(`[push] ${event} ${JSON.stringify(payload)}`);
}

export async function sendPushToDriver(driverId: string, payload: SendPushOptions) {
  logPush("mqtt_driver_start", {
    driverId,
    soundKey: payload.soundKey ?? "new_order",
    data: payload.data ?? null,
    title: payload.title,
  });
  const mqttResult = await publishDriverDispatchEvent(driverId, payload);
  logPush("mqtt_driver_result", {
    driverId,
    mqttResult,
  });
  return {
    successCount: mqttResult.published ? 1 : 0,
    failureCount: mqttResult.published ? 0 : 1,
    mqttResult,
  };
}

export async function sendPushToOnlineDrivers(payload: SendPushOptions) {
  logPush("mqtt_broadcast_start", {
    soundKey: payload.soundKey ?? "new_order",
    data: payload.data ?? null,
    title: payload.title,
  });
  const mqttResult = await publishBroadcastDispatchEvent(payload);
  logPush("mqtt_broadcast_result", {
    mqttResult,
  });
  return {
    successCount: mqttResult.published ? 1 : 0,
    failureCount: mqttResult.published ? 0 : 1,
    mqttResult,
  };
}
