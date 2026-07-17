import { createHmac, timingSafeEqual } from "crypto";

import { NextRequest, NextResponse } from "next/server";

import { upsertDriverChatRoomState } from "@/lib/driver-chat-state";
import { createServiceRoleSupabaseClient } from "@/lib/supabase";

type LedgerChatEventPayload = {
  eventId?: string;
  externalOrderId?: string;
  chatRoomRef?: string;
  roomKind?: string;
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

export async function POST(request: NextRequest) {
  try {
    const timestamp = request.headers.get("x-ledger-timestamp") ?? request.headers.get("x-siteb-timestamp") ?? "";
    const signature = request.headers.get("x-ledger-signature") ?? request.headers.get("x-siteb-signature") ?? "";
    const rawBody = await request.text();
    if (!timestamp || !signature || !verifySignature(rawBody, timestamp, signature)) {
      return NextResponse.json({ message: "invalid_signature" }, { status: 401 });
    }

    const nowMs = Date.now();
    const tsMs = Number(timestamp) * 1000;
    if (!Number.isFinite(tsMs) || Math.abs(nowMs - tsMs) > 5 * 60 * 1000) {
      return NextResponse.json({ message: "stale_timestamp" }, { status: 400 });
    }

    const payload = (JSON.parse(rawBody) ?? {}) as LedgerChatEventPayload;
    const eventId = typeof payload.eventId === "string" && payload.eventId.trim() ? payload.eventId.trim() : null;
    const externalOrderId = typeof payload.externalOrderId === "string" && payload.externalOrderId.trim() ? payload.externalOrderId.trim() : null;
    const chatRoomRef = typeof payload.chatRoomRef === "string" && payload.chatRoomRef.trim() ? payload.chatRoomRef.trim() : null;
    const roomKind = typeof payload.roomKind === "string" && payload.roomKind.trim() ? payload.roomKind.trim() : "member_order";
    const messageId = typeof payload.message?.id === "string" && payload.message.id.trim() ? payload.message.id.trim() : null;
    const createdAt = typeof payload.message?.createdAt === "string" && payload.message.createdAt.trim() ? payload.message.createdAt.trim() : null;
    const senderRole = typeof payload.message?.senderRole === "string" && payload.message.senderRole.trim() ? payload.message.senderRole.trim() : null;
    if (!eventId || !externalOrderId || !chatRoomRef || !messageId || !createdAt || !senderRole) {
      return NextResponse.json({ message: "invalid_payload" }, { status: 400 });
    }

    const supabase = createServiceRoleSupabaseClient();
    await supabase.from("ledger_chat_event_inbox").upsert({
      event_id: eventId,
      external_order_id: externalOrderId,
      chat_room_ref: chatRoomRef,
      room_kind: roomKind,
      message_id: messageId,
      message_created_at: createdAt,
      sender_role: senderRole,
      sender_label: payload.message?.senderLabel ?? null,
      has_image: Boolean(payload.message?.imageUrl),
      payload,
      received_at: new Date().toISOString()
    }, { onConflict: "event_id" });

    await upsertDriverChatRoomState({
      chatRoomRef,
      externalOrderId,
      roomKind,
      latestMessageId: messageId,
      latestMessageAt: createdAt,
      latestSenderRole: senderRole,
      latestSenderLabel: payload.message?.senderLabel ?? null,
      hasImage: Boolean(payload.message?.imageUrl)
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "ledger_chat_event_failed" }, { status: 500 });
  }
}
