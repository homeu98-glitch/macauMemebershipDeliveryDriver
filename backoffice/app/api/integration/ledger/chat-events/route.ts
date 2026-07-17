import { createHmac, timingSafeEqual } from "crypto";

import { NextRequest, NextResponse } from "next/server";

import { upsertDriverChatRoomState } from "@/lib/driver-chat-state";
import { createServiceRoleSupabaseClient } from "@/lib/supabase";

type LedgerChatEventPayload = {
  schemaVersion?: number;
  eventType?: string;
  eventId?: string;
  externalOrderId?: string;
  chatRoomRef?: string;
  roomKind?: string;
  messageId?: string;
  senderRole?: string;
  senderId?: string;
  senderLabel?: string | null;
  createdAt?: string;
  hasImage?: boolean;
  message?: {
    id?: string;
    createdAt?: string;
    senderRole?: string;
    senderLabel?: string | null;
    imageUrl?: string | null;
  };
};

function verifySignature(body: string, timestamp: string, signature: string) {
  const secret = process.env.LEDGER_CHAT_EVENTS_SECRET?.trim();
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  const actualBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

function normalizeTimestampMs(timestamp: string) {
  const trimmed = timestamp.trim();
  if (!trimmed) return null;
  const isoMs = Date.parse(trimmed);
  if (Number.isFinite(isoMs)) return isoMs;
  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric)) return null;
  return trimmed.length >= 13 ? numeric : numeric * 1000;
}

async function writeWebhookLog(input: {
  status: string;
  message: string;
  externalId?: string | null;
  payload: Record<string, unknown>;
}) {
  try {
    const supabase = createServiceRoleSupabaseClient();
    await supabase.from("sync_logs").insert({
      source: "ledger_chat_events_webhook",
      external_id: input.externalId ?? null,
      status: input.status,
      message: input.message,
      payload: input.payload,
      processed_at: new Date().toISOString()
    });
  } catch {
    // ignore logging failures
  }
}

export async function POST(request: NextRequest) {
  const timestamp = request.headers.get("x-ledger-timestamp") ?? request.headers.get("x-siteb-timestamp") ?? "";
  const signature = request.headers.get("x-ledger-signature") ?? request.headers.get("x-siteb-signature") ?? "";
  const rawBody = await request.text();

  try {
    if (!timestamp || !signature || !verifySignature(rawBody, timestamp, signature)) {
      await writeWebhookLog({
        status: "rejected",
        message: "invalid_signature",
        payload: {
          timestamp_present: Boolean(timestamp),
          signature_present: Boolean(signature)
        }
      });
      return NextResponse.json({ message: "invalid_signature" }, { status: 401 });
    }

    const nowMs = Date.now();
    const tsMs = normalizeTimestampMs(timestamp);
    if (!tsMs || Math.abs(nowMs - tsMs) > 5 * 60 * 1000) {
      await writeWebhookLog({
        status: "rejected",
        message: "stale_timestamp",
        payload: {
          timestamp,
          normalized_timestamp_ms: tsMs,
          now_ms: nowMs,
          skew_ms: tsMs ? Math.abs(nowMs - tsMs) : null
        }
      });
      return NextResponse.json({
        message: "stale_timestamp",
        details: {
          timestamp,
          normalizedTimestampMs: tsMs,
          nowMs,
          skewMs: tsMs ? Math.abs(nowMs - tsMs) : null,
          expectedFormat: "ISO_8601_UTC_or_legacy_unix"
        }
      }, { status: 401 });
    }

    const payload = (JSON.parse(rawBody) ?? {}) as LedgerChatEventPayload;
    const eventId = typeof payload.eventId === "string" && payload.eventId.trim() ? payload.eventId.trim() : null;
    const externalOrderId = typeof payload.externalOrderId === "string" && payload.externalOrderId.trim() ? payload.externalOrderId.trim() : null;
    const chatRoomRef = typeof payload.chatRoomRef === "string" && payload.chatRoomRef.trim() ? payload.chatRoomRef.trim() : null;
    const roomKind = typeof payload.roomKind === "string" && payload.roomKind.trim() ? payload.roomKind.trim() : "membership_order";
    const messageId = typeof payload.messageId === "string" && payload.messageId.trim()
      ? payload.messageId.trim()
      : (typeof payload.message?.id === "string" && payload.message.id.trim() ? payload.message.id.trim() : null);
    const createdAt = typeof payload.createdAt === "string" && payload.createdAt.trim()
      ? payload.createdAt.trim()
      : (typeof payload.message?.createdAt === "string" && payload.message.createdAt.trim() ? payload.message.createdAt.trim() : null);
    const senderRole = typeof payload.senderRole === "string" && payload.senderRole.trim()
      ? payload.senderRole.trim()
      : (typeof payload.message?.senderRole === "string" && payload.message.senderRole.trim() ? payload.message.senderRole.trim() : null);
    const senderLabel = typeof payload.senderLabel === "string"
      ? payload.senderLabel
      : (typeof payload.message?.senderLabel === "string" ? payload.message.senderLabel : null);
    const hasImage = payload.hasImage === true || Boolean(payload.message?.imageUrl);

    const missingFields = [
      !eventId ? "eventId" : null,
      !externalOrderId ? "externalOrderId" : null,
      !chatRoomRef ? "chatRoomRef" : null,
      !messageId ? "messageId" : null,
      !createdAt ? "createdAt" : null,
      !senderRole ? "senderRole" : null
    ].filter(Boolean) as string[];

    if (missingFields.length > 0) {
      await writeWebhookLog({
        status: "rejected",
        message: "invalid_payload",
        externalId: eventId ?? externalOrderId,
        payload: {
          missing_fields: missingFields,
          parsed_payload: payload,
          expected_schema: "section_8_payload_v1_flat"
        }
      });
      return NextResponse.json({
        message: "invalid_payload",
        details: {
          missingFields,
          expectedSchema: "section_8_payload_v1_flat"
        }
      }, { status: 400 });
    }

    const ensuredEventId = eventId!;
    const ensuredExternalOrderId = externalOrderId!;
    const ensuredChatRoomRef = chatRoomRef!;
    const ensuredMessageId = messageId!;
    const ensuredCreatedAt = createdAt!;
    const ensuredSenderRole = senderRole!;

    const supabase = createServiceRoleSupabaseClient();
    await supabase.from("ledger_chat_event_inbox").upsert({
      event_id: ensuredEventId,
      external_order_id: ensuredExternalOrderId,
      chat_room_ref: ensuredChatRoomRef,
      room_kind: roomKind,
      message_id: ensuredMessageId,
      message_created_at: ensuredCreatedAt,
      sender_role: ensuredSenderRole,
      sender_label: senderLabel,
      has_image: hasImage,
      payload,
      received_at: new Date().toISOString()
    }, { onConflict: "event_id" });

    await upsertDriverChatRoomState({
      chatRoomRef: ensuredChatRoomRef,
      externalOrderId: ensuredExternalOrderId,
      roomKind,
      latestMessageId: ensuredMessageId,
      latestMessageAt: ensuredCreatedAt,
      latestSenderRole: ensuredSenderRole,
      latestSenderLabel: senderLabel,
      hasImage
    });

    await writeWebhookLog({
      status: "success",
      message: "accepted",
      externalId: ensuredEventId,
      payload: {
        schemaVersion: payload.schemaVersion ?? null,
        eventType: payload.eventType ?? null,
        externalOrderId: ensuredExternalOrderId,
        chatRoomRef: ensuredChatRoomRef,
        roomKind,
        messageId: ensuredMessageId,
        createdAt: ensuredCreatedAt,
        senderRole: ensuredSenderRole,
        hasImage
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    await writeWebhookLog({
      status: "error",
      message: error instanceof Error ? error.message : "ledger_chat_event_failed",
      payload: {
        raw_body: rawBody
      }
    });
    return NextResponse.json({ message: error instanceof Error ? error.message : "ledger_chat_event_failed" }, { status: 500 });
  }
}
