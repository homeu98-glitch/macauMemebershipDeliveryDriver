import { NextResponse } from "next/server";

import { withDriverSession } from "@/app/api/driver/_shared";

function buildWsUrl() {
  const explicit = process.env.MQTT_WS_URL?.trim();
  if (explicit) return explicit;
  const host = process.env.MQTT_HOST?.trim() || "";
  if (!host) return null;
  const port = process.env.MQTT_WS_PORT?.trim() || "8884";
  const path = process.env.MQTT_WS_PATH?.trim() || "/mqtt";
  return `wss://${host}:${port}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function GET() {
  return withDriverSession(async (session) => {
    const enabled = process.env.MQTT_ENABLED?.trim()?.toLowerCase() !== "false";
    const wsUrl = buildWsUrl();
    const username = process.env.MQTT_USERNAME?.trim() || "";
    const password = process.env.MQTT_PASSWORD?.trim() || "";
    return NextResponse.json({
      enabled: enabled && Boolean(wsUrl && username && password),
      wsUrl,
      username,
      password,
      clientId: `driver-web-${session.driverId}-${Math.random().toString(36).slice(2, 10)}`,
      topics: [`drivers/${session.driverId}/events`, "drivers/broadcast/events"]
    });
  });
}
