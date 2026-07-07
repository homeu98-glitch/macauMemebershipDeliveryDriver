const mqtt = require("mqtt") as typeof import("mqtt");

type DispatchEventPayload = {
  title: string;
  body: string;
  soundKey?: string;
  data?: Record<string, string>;
};

type PublishResult = {
  published: boolean;
  skipped?: boolean;
  topic: string;
  reason?: string;
};

function isEnabled() {
  return process.env.MQTT_ENABLED?.trim()?.toLowerCase() !== "false";
}

function config() {
  return {
    host: process.env.MQTT_HOST?.trim() || "",
    port: Number(process.env.MQTT_PORT?.trim() || "8883"),
    username: process.env.MQTT_USERNAME?.trim() || "",
    password: process.env.MQTT_PASSWORD?.trim() || "",
  };
}

function basePayload(payload: DispatchEventPayload) {
  return {
    title: payload.title,
    body: payload.body,
    soundKey: payload.soundKey ?? "new_order",
    ...(payload.data ?? {}),
  };
}

async function withClient<T>(action: (client: import("mqtt").MqttClient) => Promise<T>): Promise<T> {
  const { host, port, username, password } = config();
  if (!isEnabled() || !host || !port || !username || !password) {
    throw new Error("MQTT is not configured.");
  }

  const client = mqtt.connect(`mqtts://${host}:${port}`, {
    username,
    password,
    protocolVersion: 5,
    reconnectPeriod: 0,
    connectTimeout: 10_000,
    clean: true,
  });

  try {
    await new Promise<void>((resolve, reject) => {
      const handleConnect = () => {
        client.off("error", handleError);
        resolve();
      };
      const handleError = (error: Error) => {
        client.off("connect", handleConnect);
        reject(error);
      };
      client.once("connect", handleConnect);
      client.once("error", handleError);
    });

    return await action(client);
  } finally {
    await new Promise<void>((resolve) => {
      client.end(false, {}, () => resolve());
    }).catch(() => undefined);
  }
}

async function publish(topic: string, payload: DispatchEventPayload): Promise<PublishResult> {
  if (!isEnabled()) {
    return { published: false, skipped: true, topic, reason: "mqtt_disabled" };
  }

  const { host, port, username, password } = config();
  if (!host || !port || !username || !password) {
    return { published: false, skipped: true, topic, reason: "mqtt_missing_config" };
  }

  const message = JSON.stringify(basePayload(payload));
  console.info(`[mqtt] publish_start ${JSON.stringify({ topic, payload: JSON.parse(message) })}`);

  await withClient(
    (client) =>
      new Promise<void>((resolve, reject) => {
        client.publish(topic, message, { qos: 1 }, (error?: Error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      })
  );

  console.info(`[mqtt] publish_result ${JSON.stringify({ topic, published: true })}`);
  return { published: true, topic };
}

export async function publishDriverDispatchEvent(driverId: string, payload: DispatchEventPayload) {
  return publish(`drivers/${driverId}/events`, payload);
}

export async function publishBroadcastDispatchEvent(payload: DispatchEventPayload) {
  return publish("drivers/broadcast/events", payload);
}
