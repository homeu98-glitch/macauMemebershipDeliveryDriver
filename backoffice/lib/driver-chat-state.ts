import { createServiceRoleSupabaseClient } from "@/lib/supabase";

function normalizeSourcePayload(sourcePayload: unknown) {
  return sourcePayload && typeof sourcePayload === "object" ? (sourcePayload as Record<string, unknown>) : null;
}

export function deriveDriverChatRoomRef(order: { id: string; externalOrderId?: string | null; sourcePayload?: unknown }) {
  const payload = normalizeSourcePayload(order.sourcePayload);
  const explicit = typeof payload?.chatRoomRef === "string" && payload.chatRoomRef.trim() ? payload.chatRoomRef.trim() : null;
  if (explicit) return explicit;
  const externalOrderId = typeof order.externalOrderId === "string" && order.externalOrderId.trim() ? order.externalOrderId.trim() : null;
  if (externalOrderId && externalOrderId.startsWith("ext-")) return externalOrderId;
  return order.id;
}

export function isDriverSideSenderRole(role: string | null | undefined) {
  const normalized = (role ?? "").trim().toLowerCase();
  return normalized === "rider" || normalized === "driver" || normalized === "courier" || normalized.includes("rider") || normalized.includes("driver");
}

export async function loadDriverChatUnreadMap(
  driverId: string,
  orders: Array<{ id: string; external_order_id?: string | null; source_payload?: unknown }>
) {
  const refs = orders.map((order) => ({ orderId: order.id, chatRoomRef: deriveDriverChatRoomRef({ id: order.id, externalOrderId: order.external_order_id, sourcePayload: order.source_payload }) }));
  const roomRefs = [...new Set(refs.map((item) => item.chatRoomRef).filter(Boolean))];
  const result = new Map<string, boolean>();
  if (roomRefs.length === 0) return result;

  const supabase = createServiceRoleSupabaseClient();
  const [{ data: roomStates }, { data: readStates }] = await Promise.all([
    supabase.from("driver_chat_room_state").select("chat_room_ref,latest_message_at,latest_sender_role").in("chat_room_ref", roomRefs),
    supabase.from("driver_chat_read_state").select("chat_room_ref,last_read_at").eq("driver_id", driverId).in("chat_room_ref", roomRefs)
  ]);

  const roomStateByRef = new Map((roomStates ?? []).map((item: any) => [item.chat_room_ref, item]));
  const readStateByRef = new Map((readStates ?? []).map((item: any) => [item.chat_room_ref, item]));

  for (const item of refs) {
    const roomState = roomStateByRef.get(item.chatRoomRef);
    if (!roomState?.latest_message_at) {
      result.set(item.orderId, false);
      continue;
    }
    const readState = readStateByRef.get(item.chatRoomRef);
    const lastReadAt = typeof readState?.last_read_at === "string" ? readState.last_read_at : null;
    const latestMessageAt = String(roomState.latest_message_at);
    const latestSenderRole = typeof roomState.latest_sender_role === "string" ? roomState.latest_sender_role : null;
    const hasUnread = !isDriverSideSenderRole(latestSenderRole) && (!lastReadAt || latestMessageAt > lastReadAt);
    result.set(item.orderId, hasUnread);
  }

  return result;
}

export async function upsertDriverChatRoomState(input: {
  chatRoomRef: string;
  externalOrderId: string;
  roomKind: string;
  latestMessageId: string;
  latestMessageAt: string;
  latestSenderRole: string;
  latestSenderLabel?: string | null;
  hasImage?: boolean;
}) {
  const supabase = createServiceRoleSupabaseClient();
  const { data: existing } = await supabase
    .from("driver_chat_room_state")
    .select("chat_room_ref,latest_message_at,latest_message_id")
    .eq("chat_room_ref", input.chatRoomRef)
    .maybeSingle();

  const shouldWrite = !existing || String(input.latestMessageAt) > String(existing.latest_message_at ?? "") || (String(input.latestMessageAt) === String(existing.latest_message_at ?? "") && String(input.latestMessageId) > String(existing.latest_message_id ?? ""));
  if (!shouldWrite) return;

  await supabase.from("driver_chat_room_state").upsert({
    chat_room_ref: input.chatRoomRef,
    external_order_id: input.externalOrderId,
    room_kind: input.roomKind,
    latest_message_id: input.latestMessageId,
    latest_message_at: input.latestMessageAt,
    latest_sender_role: input.latestSenderRole,
    latest_sender_label: input.latestSenderLabel ?? null,
    has_image: input.hasImage === true,
    updated_at: new Date().toISOString()
  }, { onConflict: "chat_room_ref" });
}

export async function markDriverChatReadState(driverId: string, chatRoomRef: string, lastReadAt: string) {
  const supabase = createServiceRoleSupabaseClient();
  await supabase.from("driver_chat_read_state").upsert({
    driver_id: driverId,
    chat_room_ref: chatRoomRef,
    last_read_at: lastReadAt,
    updated_at: new Date().toISOString()
  }, { onConflict: "driver_id,chat_room_ref" });
}
