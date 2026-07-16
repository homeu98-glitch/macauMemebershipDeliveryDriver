import crypto from "node:crypto";

import { getConfiguredWebhookSecret } from "@/lib/siteb-api-auth";

type ChatProxyResult = {
  status: number;
  body: unknown;
};

function resolveWebhookSecret(preferredSecret?: string | null) {
  const secret = preferredSecret?.trim() || getConfiguredWebhookSecret();
  if (!secret) {
    throw new Error("聊天 HMAC 密鑰尚未設定：請提供建單保存的 callback.secret，或設定 SITEB_DELIVERY_WEBHOOK_SECRET。");
  }
  return secret;
}

function buildSignature(secret: string, timestamp: string, rawBody = "") {
  return crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

async function toProxyResult(response: Response): Promise<ChatProxyResult> {
  const text = await response.text();
  try {
    return {
      status: response.status,
      body: text ? JSON.parse(text) : {}
    };
  } catch {
    return {
      status: response.status,
      body: { message: text || `Chat API returned ${response.status}.` }
    };
  }
}

export async function fetchSiteBChatMessages(messagesUrl: string, options?: { since?: string | null; secret?: string | null }) {
  const url = new URL(messagesUrl);
  if (options?.since) {
    url.searchParams.set("since", options.since);
  }

  const secret = resolveWebhookSecret(options?.secret);
  const timestamp = new Date().toISOString();
  const signature = buildSignature(secret, timestamp);
  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
    headers: {
      "X-SiteB-Timestamp": timestamp,
      "X-SiteB-Signature": signature
    }
  });

  return toProxyResult(response);
}

export async function sendSiteBChatMessage(
  messagesUrl: string,
  payload: {
    body?: string | null;
    imageBase64?: string | null;
    clientMsgId?: string | null;
    driver: { id: string; displayName: string };
  },
  options?: { secret?: string | null }
) {
  const rawBody = JSON.stringify(payload);
  const secret = resolveWebhookSecret(options?.secret);
  const timestamp = new Date().toISOString();
  const signature = buildSignature(secret, timestamp, rawBody);
  const response = await fetch(messagesUrl, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-SiteB-Timestamp": timestamp,
      "X-SiteB-Signature": signature
    },
    body: rawBody
  });

  return toProxyResult(response);
}
