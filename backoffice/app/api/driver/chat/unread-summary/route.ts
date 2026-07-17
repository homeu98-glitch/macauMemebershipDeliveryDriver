import { NextRequest, NextResponse } from "next/server";

import { withDriverSession } from "@/app/api/driver/_shared";
import { fetchSiteBChatMessages } from "@/lib/siteb-chat-client";
import { getOrSetMemoryCache } from "@/lib/server-memory-cache";
import { createServiceRoleSupabaseClient } from "@/lib/supabase";

const CHAT_UNREAD_SUMMARY_CACHE_TTL_MS = 45_000;

type UnreadSummaryRequest = {
  orders?: Array<{
    orderId?: string;
    since?: string | null;
    lastReadAt?: string | null;
  }>;
};

function normalizeChatMeta(sourcePayload: unknown) {
  const payload = sourcePayload && typeof sourcePayload === "object" ? (sourcePayload as Record<string, unknown>) : null;
  const chat = payload?.chat && typeof payload.chat === "object" ? (payload.chat as Record<string, unknown>) : null;
  const callback = payload?.callback && typeof payload.callback === "object" ? (payload.callback as Record<string, unknown>) : null;
  const messagesUrl = typeof chat?.messagesUrl === "string" && chat.messagesUrl.trim() ? chat.messagesUrl.trim() : null;
  const enabled = chat?.enabled === true && Boolean(messagesUrl);
  const callbackSecret = typeof callback?.secret === "string" && callback.secret.trim() ? callback.secret.trim() : null;
  return enabled ? { messagesUrl, callbackSecret } : null;
}

function isDriverMessage(senderRole: unknown, senderLabel: unknown) {
  const role = typeof senderRole === "string" ? senderRole.trim().toLowerCase() : "";
  const label = typeof senderLabel === "string" ? senderLabel.trim().toLowerCase() : "";
  return role === "driver" || role === "rider" || role === "courier" || role.includes("driver") || role.includes("rider") || label === "你" || label.includes("車手");
}

function latestTimestamp(items: Array<Record<string, unknown>>) {
  const timestamps = items
    .map((item) => (typeof item.created_at === "string" ? item.created_at : null))
    .filter((value): value is string => Boolean(value))
    .sort();
  return timestamps.length ? timestamps[timestamps.length - 1] : null;
}

export async function POST(request: NextRequest) {
  return withDriverSession(async (session) => {
    try {
      const payload = (await request.json().catch(() => ({}))) as UnreadSummaryRequest;
      const requestedOrders = Array.isArray(payload.orders) ? payload.orders : [];
      const normalized = requestedOrders
        .map((item) => ({
          orderId: typeof item?.orderId === "string" ? item.orderId.trim() : "",
          since: typeof item?.since === "string" && item.since.trim() ? item.since.trim() : null,
          lastReadAt: typeof item?.lastReadAt === "string" && item.lastReadAt.trim() ? item.lastReadAt.trim() : null
        }))
        .filter((item) => item.orderId);

      const uniqueOrderIds = [...new Set(normalized.map((item) => item.orderId))].slice(0, 40);
      if (uniqueOrderIds.length === 0) {
        return NextResponse.json({ summaries: [] });
      }

      const requestByOrderId = new Map(normalized.map((item) => [item.orderId, item]));
      const supabase = createServiceRoleSupabaseClient();
      const { data: orders, error } = await supabase
        .from("orders")
        .select("id,status,source_payload")
        .in("id", uniqueOrderIds);
      if (error) throw error;

      const protectedOrderIds = (orders ?? []).filter((order) => order.status !== "new").map((order) => order.id);
      const allowedAssignedOrderIds = new Set<string>();
      if (protectedOrderIds.length > 0) {
        const { data: assignments, error: assignmentsError } = await supabase
          .from("order_assignments")
          .select("order_id")
          .in("order_id", protectedOrderIds)
          .eq("driver_id", session.driverId)
          .is("canceled_at", null);
        if (assignmentsError) throw assignmentsError;
        for (const assignment of assignments ?? []) {
          if (typeof assignment.order_id === "string") {
            allowedAssignedOrderIds.add(assignment.order_id);
          }
        }
      }

      const summaries = await Promise.all(
        (orders ?? []).map(async (order) => {
          const requestItem = requestByOrderId.get(order.id);
          const chat = normalizeChatMeta(order.source_payload);
          if (!requestItem || !chat?.messagesUrl) {
            return { orderId: order.id, latestMessageAt: null, hasUnread: false };
          }
          if (order.status !== "new" && !allowedAssignedOrderIds.has(order.id)) {
            return { orderId: order.id, latestMessageAt: null, hasUnread: false };
          }

          try {
            const messagesUrl = chat.messagesUrl;
            const cacheKey = `driver:chat-unread-summary:${messagesUrl}:${requestItem.since ?? "root"}`;
            const cached = await getOrSetMemoryCache(cacheKey, CHAT_UNREAD_SUMMARY_CACHE_TTL_MS, async () => {
              const result = await fetchSiteBChatMessages(messagesUrl, {
                since: requestItem.since,
                secret: chat.callbackSecret
              });
              if (result.status < 200 || result.status >= 300) {
                return { items: [] as Array<Record<string, unknown>>, latestMessageAt: requestItem.since ?? null };
              }
              const body = result.body && typeof result.body === "object" ? (result.body as Record<string, unknown>) : {};
              const items = Array.isArray(body.items)
                ? body.items.filter((item) => item && typeof item === "object").map((item) => item as Record<string, unknown>)
                : [];
              return { items, latestMessageAt: latestTimestamp(items) ?? requestItem.since ?? null };
            });
            const items = cached.items;
            const latestMessageAt = cached.latestMessageAt;
            const hasUnread = items.some((item) => {
              const createdAt = typeof item.created_at === "string" ? item.created_at : null;
              if (!createdAt) return false;
              if (requestItem.lastReadAt && createdAt <= requestItem.lastReadAt) return false;
              return !isDriverMessage(item.sender_role, item.sender_label);
            });
            return { orderId: order.id, latestMessageAt, hasUnread };
          } catch {
            return { orderId: order.id, latestMessageAt: requestItem.since ?? null, hasUnread: false };
          }
        })
      );

      return NextResponse.json({ summaries });
    } catch (error) {
      return NextResponse.json({ message: error instanceof Error ? error.message : "載入聊天未讀摘要失敗。" }, { status: 500 });
    }
  });
}
