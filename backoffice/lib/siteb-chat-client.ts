import crypto from "node:crypto";

import { getConfiguredWebhookSecret } from "@/lib/siteb-api-auth";

type ChatProxyResult = {
  status: number;
  body: unknown;
};

function buildSignature(timestamp: string, rawBody = "") {
  const secret = getConfiguredWebhookSecret();
  if (!secret) {
    throw new Error("SITEB_DELIVERY_WEBHOOK_SECRET 尚未設定。");
  }
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

export async function fetchSiteBChatMessages(messagesUrl: string, since?: string | null) {
  const url = new URL(messagesUrl);
  if (since) {
    url.searchParams.set("since", since);
  }

  const timestamp = new Date().toISOString();
  const signature = buildSignature(timestamp);
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
  }
) {
  const rawBody = JSON.stringify(payload);
  const timestamp = new Date().toISOString();
  const signature = buildSignature(timestamp, rawBody);
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
