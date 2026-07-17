import { NextRequest, NextResponse } from "next/server";

import { withDriverSession } from "@/app/api/driver/_shared";
import { deriveDriverChatRoomRef, markDriverChatReadState, upsertDriverChatRoomState } from "@/lib/driver-chat-state";
import { fetchSiteBChatMessages, sendSiteBChatMessage } from "@/lib/siteb-chat-client";
import { createServiceRoleSupabaseClient } from "@/lib/supabase";

function normalizeChatMeta(sourcePayload: unknown) {
  const payload = sourcePayload && typeof sourcePayload === "object" ? (sourcePayload as Record<string, unknown>) : null;
  const chat = payload?.chat && typeof payload.chat === "object" ? (payload.chat as Record<string, unknown>) : null;
  const callback = payload?.callback && typeof payload.callback === "object" ? (payload.callback as Record<string, unknown>) : null;
  const messagesUrl = typeof chat?.messagesUrl === "string" && chat.messagesUrl.trim() ? chat.messagesUrl.trim() : null;
  const enabled = chat?.enabled === true && Boolean(messagesUrl);
  const callbackSecret = typeof callback?.secret === "string" && callback.secret.trim() ? callback.secret.trim() : null;
  return enabled ? { enabled, messagesUrl, callbackSecret } : null;
}

async function resolveDriverOrderChat(session: { driverId: string }, orderId: string) {
  const supabase = createServiceRoleSupabaseClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("id,external_order_id,status,source_payload")
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw error;
  if (!order) {
    return { status: 404, message: "找不到訂單。", messagesUrl: null as string | null, secret: null as string | null, orderId: null as string | null, externalOrderId: null as string | null, sourcePayload: null as unknown };
  }

  const chat = normalizeChatMeta(order.source_payload);
  if (!chat?.messagesUrl) {
    return { status: 404, message: "此訂單未啟用聊天。", messagesUrl: null as string | null, secret: null as string | null, orderId: order.id as string, externalOrderId: (order.external_order_id as string | null) ?? null, sourcePayload: order.source_payload };
  }

  if (order.status !== "new") {
    const { data: assignment, error: assignmentError } = await supabase
      .from("order_assignments")
      .select("id")
      .eq("order_id", orderId)
      .eq("driver_id", session.driverId)
      .is("canceled_at", null)
      .limit(1)
      .maybeSingle();

    if (assignmentError) throw assignmentError;
    if (!assignment) {
      return { status: 403, message: "你沒有權限查看此訂單聊天。", messagesUrl: null as string | null, secret: null as string | null, orderId: order.id as string, externalOrderId: (order.external_order_id as string | null) ?? null, sourcePayload: order.source_payload };
    }
  }

  return {
    status: 200,
    message: null as string | null,
    messagesUrl: chat.messagesUrl,
    secret: chat.callbackSecret,
    orderId: order.id as string,
    externalOrderId: (order.external_order_id as string | null) ?? null,
    sourcePayload: order.source_payload
  };
}

export async function GET(request: NextRequest, context: { params: { orderId: string } }) {
  return withDriverSession(async (session) => {
    try {
      const resolved = await resolveDriverOrderChat(session, context.params.orderId);
      if (!resolved.messagesUrl || !resolved.orderId) {
        return NextResponse.json({ message: resolved.message }, { status: resolved.status });
      }
      const since = request.nextUrl.searchParams.get("since");
      const result = await fetchSiteBChatMessages(resolved.messagesUrl, { since, secret: resolved.secret });
      const body = result.body && typeof result.body === "object" ? (result.body as Record<string, unknown>) : {};
      const items = Array.isArray(body.items) ? body.items.filter((item) => item && typeof item === "object") as Array<Record<string, unknown>> : [];
      const latestItem = items.length ? items[items.length - 1] : null;
      const latestCreatedAt = typeof latestItem?.created_at === "string" ? latestItem.created_at : null;
      if (latestCreatedAt) {
        const chatRoomRef = deriveDriverChatRoomRef({ id: resolved.orderId, externalOrderId: resolved.externalOrderId, sourcePayload: resolved.sourcePayload });
        await markDriverChatReadState(session.driverId, chatRoomRef, latestCreatedAt);
      }
      return NextResponse.json(result.body, { status: result.status });
    } catch (error) {
      return NextResponse.json({ message: error instanceof Error ? error.message : "載入聊天失敗。" }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest, context: { params: { orderId: string } }) {
  return withDriverSession(async (session) => {
    try {
      const resolved = await resolveDriverOrderChat(session, context.params.orderId);
      if (!resolved.messagesUrl || !resolved.orderId) {
        return NextResponse.json({ message: resolved.message }, { status: resolved.status });
      }

      const payload = (await request.json().catch(() => ({}))) as {
        body?: string;
        imageBase64?: string;
        clientMsgId?: string;
      };
      const body = typeof payload.body === "string" ? payload.body.trim() : "";
      const imageBase64 = typeof payload.imageBase64 === "string" && payload.imageBase64.trim() ? payload.imageBase64.trim() : null;
      const clientMsgId = typeof payload.clientMsgId === "string" && payload.clientMsgId.trim() ? payload.clientMsgId.trim() : null;

      if (!body && !imageBase64) {
        return NextResponse.json({ message: "文字與圖片至少要提供一項。" }, { status: 400 });
      }

      const result = await sendSiteBChatMessage(
        resolved.messagesUrl,
        {
          body: body || null,
          imageBase64,
          clientMsgId,
          driver: {
            id: session.driverId,
            displayName: session.fullName
          }
        },
        { secret: resolved.secret }
      );

      const bodyPayload = result.body && typeof result.body === "object" ? (result.body as Record<string, unknown>) : {};
      const messagePayload = bodyPayload.message && typeof bodyPayload.message === "object" ? (bodyPayload.message as Record<string, unknown>) : null;
      const createdAt = typeof messagePayload?.created_at === "string" ? messagePayload.created_at : null;
      const messageId = typeof messagePayload?.id === "string" ? messagePayload.id : clientMsgId;
      const chatRoomRef = deriveDriverChatRoomRef({ id: resolved.orderId, externalOrderId: resolved.externalOrderId, sourcePayload: resolved.sourcePayload });
      if (createdAt) {
        await markDriverChatReadState(session.driverId, chatRoomRef, createdAt);
      }
      if (createdAt && messageId) {
        await upsertDriverChatRoomState({
          chatRoomRef,
          externalOrderId: resolved.externalOrderId ?? resolved.orderId,
          roomKind: "member_order",
          latestMessageId: messageId,
          latestMessageAt: createdAt,
          latestSenderRole: "rider",
          latestSenderLabel: session.fullName,
          hasImage: Boolean(imageBase64)
        });
      }

      return NextResponse.json(result.body, { status: result.status });
    } catch (error) {
      return NextResponse.json({ message: error instanceof Error ? error.message : "發送聊天訊息失敗。" }, { status: 500 });
    }
  });
}
