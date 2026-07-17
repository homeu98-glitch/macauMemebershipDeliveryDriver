import { loadDriverChatUnreadMap } from "@/lib/driver-chat-state";
import { getLegalConfig } from "@/lib/legal-config";
import { getOrSetMemoryCache } from "@/lib/server-memory-cache";
import { createServiceRoleSupabaseClient } from "@/lib/supabase";

export type DriverWebOrderSummary = {
  orderImages: Array<{ url: string; label: string | null; mimeType: string | null }>;
  customerAddressProvided: boolean;
  customerContactProvided: boolean;
  chat: { enabled: boolean; messagesUrl: string | null } | null;
  hasUnread: boolean;
  id: string;
  externalOrderId: string;
  transactionCode: string | null;
  status: string;
  storeName: string;
  storeAddress: string;
  storePhone: string | null;
  pickupDistrict: string | null;
  storeLatitude: number;
  storeLongitude: number;
  totalSentOrders: number;
  customerName: string;
  customerAddress: string;
  customerPhone: string | null;
  destinationDistrict: string | null;
  customerLatitude: number;
  customerLongitude: number;
  amountMop: number;
  createdAt: string;
  publishedAt: string;
  promisedAt: string | null;
  deliveryDeadlineText: string;
  etaMinutes: number;
  acceptedAt: string | null;
  pickedUpAt: string | null;
  cancelReason: string | null;
  cancelOtherReason: string | null;
  cancelHandling: "return_to_shop" | "not_returning" | null;
  isUrgent: boolean;
  paymentTag: string;
  driverCancelConfirmationRequired: boolean;
  driverCancelConfirmedAt: string | null;
};

export type DriverWebOrderDetail = DriverWebOrderSummary & {
  items: string[];
  timeline: Array<{ label: string; timestamp: string; note: string }>;
  hasProof: boolean;
};

export type DriverDashboard = {
  todayEarningsMop: number;
  weekEarningsMop: number;
  completedToday: number;
  availability: string;
  approvalStatus: string;
  availableOrders: DriverWebOrderSummary[];
  pickupDistrictOptions: string[];
  destinationDistrictOptions: string[];
};

export type DriverCompletedOrder = DriverWebOrderSummary & {
  deliveredAt: string;
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-HK", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatDeadline(value: string | null | undefined) {
  if (!value) return "-";
  return formatDateTime(value);
}

function calculateEtaMinutes(value: string | null | undefined) {
  if (!value) return 0;
  const target = new Date(value).getTime();
  if (Number.isNaN(target)) return 0;
  return Math.max(0, Math.round((target - Date.now()) / 60000));
}

function formatRawDateTime(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function derivePaymentTag(order: any) {
  const sourcePayload = order?.source_payload ?? null;
  const notes = sourcePayload?.notes ?? null;
  const explicitValue = [
    notes?.paymentBy,
    notes?.paidBy,
    notes?.payment_by,
    sourcePayload?.paymentBy,
    sourcePayload?.paidBy
  ]
    .find((item) => typeof item === "string" && item.trim())
    ?.trim()
    ?.toLowerCase() ?? "";

  const noteText = `${order?.offline_payment_note ?? ""} ${notes?.shopNote ?? ""}`.toLowerCase();

  if (["shop", "merchant", "prepaid", "paid_by_shop", "shop_paid"].includes(explicitValue)) {
    return "商家支付運貨";
  }
  if (["customer", "cod", "cash", "paid_by_customer", "customer_paid"].includes(explicitValue)) {
    return "客人支付運費";
  }
  if (
    noteText.includes("已線上付款") ||
    noteText.includes("paid by shop") ||
    noteText.includes("prepaid") ||
    noteText.includes("shop paid") ||
    noteText.includes("商戶支付") ||
    noteText.includes("店舖支付")
  ) {
    return "商家支付運貨";
  }
  return "客人支付運費";
}

function haversineKm(startLat: number, startLng: number, endLat: number, endLng: number) {
  if (!startLat || !startLng || !endLat || !endLng) return 0;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(endLat - startLat);
  const dLng = toRad(endLng - startLng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(startLat)) * Math.cos(toRad(endLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.asin(Math.sqrt(a));
  return Math.round(earthRadiusKm * c * 10) / 10;
}

const RELATION_CACHE_TTL_MS = 60_000;

const AVAILABLE_ORDERS_CACHE_TTL_MS = 10_000;

function buildSortedIdKey(values: unknown[]) {
  return [...new Set(values.filter(Boolean).map((value) => String(value)))]
    .sort()
    .join(",");
}

async function loadShopAndCustomerMaps(supabase: ReturnType<typeof createServiceRoleSupabaseClient>, rows: any[]) {
  const shopIds = [...new Set(rows.map((row) => row.shop_id).filter(Boolean))];
  const customerIds = [...new Set(rows.map((row) => row.customer_id).filter(Boolean))];

  if (shopIds.length === 0 && customerIds.length === 0) {
    return {
      shopMap: new Map(),
      customerMap: new Map(),
      totalSentOrdersByShopId: new Map<string, number>()
    };
  }

  const shopKey = buildSortedIdKey(shopIds);
  const customerKey = buildSortedIdKey(customerIds);
  const relationKey = `driver-web:relations:shops=${shopKey}:customers=${customerKey}`;

  return getOrSetMemoryCache(relationKey, RELATION_CACHE_TTL_MS, async () => {
    const [{ data: shops }, { data: customers }, { data: shopOrders }] = await Promise.all([
      shopIds.length
        ? supabase.from("shops").select("id,name,address,district,latitude,longitude,contact_phone").in("id", shopIds)
        : Promise.resolve({ data: [] as any[] }),
      customerIds.length
        ? supabase.from("customers").select("id,name,address,district,latitude,longitude,phone").in("id", customerIds)
        : Promise.resolve({ data: [] as any[] }),
      shopIds.length
        ? supabase.from("orders").select("shop_id").in("shop_id", shopIds)
        : Promise.resolve({ data: [] as any[] })
    ]);

    const totalSentOrdersByShopId = new Map<string, number>();
    for (const item of shopOrders ?? []) {
      if (!item?.shop_id) continue;
      totalSentOrdersByShopId.set(item.shop_id, (totalSentOrdersByShopId.get(item.shop_id) ?? 0) + 1);
    }

    return {
      shopMap: new Map((shops ?? []).map((item: any) => [item.id, item])),
      customerMap: new Map((customers ?? []).map((item: any) => [item.id, item])),
      totalSentOrdersByShopId
    };
  });
}

function toOrderSummary(order: any, shop: any, customer: any, totalSentOrdersByShopId: Map<string, number>, hasUnread = false): DriverWebOrderSummary {
  const etaMinutes = calculateEtaMinutes(order.promised_at);
  const sourcePayload =
    order?.source_payload && typeof order.source_payload === "object"
      ? (order.source_payload as Record<string, unknown>)
      : null;
  const customerSnapshot =
    sourcePayload?.customerSnapshot && typeof sourcePayload.customerSnapshot === "object"
      ? (sourcePayload.customerSnapshot as Record<string, unknown>)
      : null;
  const orderImages = Array.isArray(sourcePayload?.images)
    ? (sourcePayload?.images as Array<Record<string, unknown>>)
        .filter((item) => typeof item?.url === "string" && item.url.trim())
        .map((item) => ({
          url: String(item.url),
          label: typeof item.label === "string" ? item.label : null,
          mimeType: typeof item.mimeType === "string" ? item.mimeType : null
        }))
    : [];
  const urgentFromPayload = sourcePayload?.priceRaisedAt || sourcePayload?.price_raised_at;
  const customerAddressProvided = Boolean(customerSnapshot?.addressProvided ?? customer?.address);
  const customerContactProvided = Boolean(customerSnapshot?.contactProvided ?? customer?.phone ?? customer?.name);
  const chat =
    sourcePayload?.chat && typeof sourcePayload.chat === "object"
      ? (sourcePayload.chat as Record<string, unknown>)
      : null;

  return {
    orderImages,
    customerAddressProvided,
    customerContactProvided,
    chat: {
      enabled: chat?.enabled === true && typeof chat?.messagesUrl === "string" && Boolean(chat.messagesUrl),
      messagesUrl: typeof chat?.messagesUrl === "string" ? chat.messagesUrl : null
    },
    hasUnread,
    id: order.id,
    externalOrderId: order.external_order_id,
    transactionCode: order.transaction_code ?? null,
    status: order.status,
    storeName: shop?.name ?? "未命名店舖",
    storeAddress: shop?.address ?? "未提供地址",
    storePhone: shop?.contact_phone ?? null,
    pickupDistrict: shop?.district ?? null,
    storeLatitude: Number(shop?.latitude ?? 0),
    storeLongitude: Number(shop?.longitude ?? 0),
    totalSentOrders: totalSentOrdersByShopId.get(order.shop_id) ?? 0,
    customerName: (typeof customerSnapshot?.name === "string" ? customerSnapshot.name : customer?.name) ?? "未提供客戶資料",
    customerAddress: customerAddressProvided
      ? ((typeof customerSnapshot?.address === "string" ? customerSnapshot.address : customer?.address) ?? "未提供地址")
      : "請查看訂單圖片中的地址資料",
    customerPhone: (typeof customerSnapshot?.phone === "string" ? customerSnapshot.phone : customer?.phone) ?? null,
    destinationDistrict: customerAddressProvided ? customer?.district ?? null : null,
    customerLatitude: customerAddressProvided ? Number(customer?.latitude ?? customerSnapshot?.latitude ?? 0) : 0,
    customerLongitude: customerAddressProvided ? Number(customer?.longitude ?? customerSnapshot?.longitude ?? 0) : 0,
    amountMop: Number(order.assigned_fee_mop ?? 0),
    createdAt: formatDateTime(order.created_at),
    publishedAt: formatDateTime(order.created_at),
    promisedAt: order.promised_at ? formatDateTime(order.promised_at) : null,
    deliveryDeadlineText: formatDeadline(order.promised_at),
    etaMinutes,
    acceptedAt: formatRawDateTime(order.accepted_at),
    pickedUpAt: formatRawDateTime(order.picked_up_at),
    cancelReason: typeof order.cancel_reason === "string" ? order.cancel_reason : null,
    cancelOtherReason: typeof order.cancel_other_reason === "string" ? order.cancel_other_reason : null,
    cancelHandling: order.cancel_handling === "return_to_shop" || order.cancel_handling === "not_returning" ? order.cancel_handling : null,
    isUrgent: Boolean(urgentFromPayload),
    paymentTag: derivePaymentTag(order),
    driverCancelConfirmationRequired: Boolean(sourcePayload?.driverCancelConfirmationRequired),
    driverCancelConfirmedAt: typeof sourcePayload?.driverCancelConfirmedAt === "string" ? sourcePayload.driverCancelConfirmedAt : null
  };
}

export function maskPhoneFrontFour(phone: string) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length >= 8) return `****${digits.slice(-4)}`;
  return phone;
}

export async function getDriverReviewStatus(driverId: string) {
  const supabase = createServiceRoleSupabaseClient();
  const { data } = await supabase
    .from("driver_applications")
    .select("review_status,review_note,reviewed_at")
    .eq("driver_id", driverId)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return {
    status: data?.review_status ?? "pending",
    reviewNote: data?.review_note ?? null,
    reviewedAt: data?.reviewed_at ? formatDateTime(data.reviewed_at) : null
  };
}

export async function getDriverLegalState(driverId: string) {
  const supabase = createServiceRoleSupabaseClient();
  const [config, profileResult] = await Promise.all([
    getLegalConfig(),
    supabase.from("driver_profiles").select("accepted_terms_version,accepted_terms_at").eq("id", driverId).maybeSingle()
  ]);

  const acceptedVersion = profileResult.data?.accepted_terms_version ?? null;
  return {
    disclaimer: config.disclaimer,
    serviceTerms: config.serviceTerms,
    version: config.version,
    acceptedVersion,
    acceptedAt: profileResult.data?.accepted_terms_at ? formatDateTime(profileResult.data.accepted_terms_at) : null,
    mustAccept: acceptedVersion !== config.version
  };
}

export async function listAvailableOrders(driverId?: string, filters?: { pickupDistrict?: string; destinationDistrict?: string }) {
  const supabase = createServiceRoleSupabaseClient();
  const mapped = await getOrSetMemoryCache("driver-web:available-orders:mapped", AVAILABLE_ORDERS_CACHE_TTL_MS, async () => {
    const { data: rows } = await supabase
      .from("orders")
      .select("id,external_order_id,transaction_code,status,assigned_fee_mop,created_at,promised_at,shop_id,customer_id,source_payload,offline_payment_note")
      .eq("status", "new")
      .order("created_at", { ascending: false })
      .limit(100);

    const orders = rows ?? [];
    if (orders.length === 0) return [] as DriverWebOrderSummary[];
    const [{ shopMap, customerMap, totalSentOrdersByShopId }, unreadByOrderId] = await Promise.all([
      loadShopAndCustomerMaps(supabase, orders),
      driverId ? loadDriverChatUnreadMap(driverId, orders) : Promise.resolve(new Map<string, boolean>())
    ]);
    return orders.map((row: any) => toOrderSummary(row, shopMap.get(row.shop_id), customerMap.get(row.customer_id), totalSentOrdersByShopId, Boolean(unreadByOrderId.get(row.id))));
  });

  return mapped.filter((item) => {
    const pickupOk = !filters?.pickupDistrict || item.pickupDistrict === filters.pickupDistrict;
    const destinationOk = !filters?.destinationDistrict || item.destinationDistrict === filters.destinationDistrict;
    return pickupOk && destinationOk;
  });
}

export async function listActiveOrders(driverId: string) {
  const supabase = createServiceRoleSupabaseClient();
  const { data: assignments } = await supabase
    .from("order_assignments")
    .select("order_id,accepted_at")
    .eq("driver_id", driverId)
    .is("canceled_at", null)
    .order("assigned_at", { ascending: false });

  const orderIds = (assignments ?? []).map((item: any) => item.order_id);
  if (orderIds.length === 0) return [] as DriverWebOrderSummary[];

  const [{ data: rows }, { data: events }] = await Promise.all([
    supabase
      .from("orders")
      .select("id,external_order_id,transaction_code,status,assigned_fee_mop,created_at,promised_at,shop_id,customer_id,source_payload,offline_payment_note")
      .in("id", orderIds)
      .not("status", "in", "(\"delivered\",\"failed\")")
      .order("created_at", { ascending: false }),
    supabase
      .from("order_events")
      .select("order_id,event_type,created_at,payload")
      .in("order_id", orderIds)
      .in("event_type", ["accepted", "picked_up", "issue_reported", "website.shop_owner_confirmed_driver_cancel"])
  ]);

  const rawOrders = rows ?? [];
  const acceptedAtByOrderId = new Map((assignments ?? []).map((item: any) => [item.order_id, item.accepted_at ?? null]));
  const acceptedAtEventByOrderId = new Map<string, string>();
  const pickedUpAtByOrderId = new Map<string, string>();
  const cancelMetaByOrderId = new Map<string, { cancelReason: string | null; cancelOtherReason: string | null; cancelHandling: "return_to_shop" | "not_returning" | null }>();
  const shopConfirmedCancelOrderIds = new Set<string>();
  for (const event of events ?? []) {
    if (event.event_type === "accepted" && !acceptedAtEventByOrderId.has(event.order_id)) {
      acceptedAtEventByOrderId.set(event.order_id, event.created_at);
    }
    if (event.event_type === "picked_up" && !pickedUpAtByOrderId.has(event.order_id)) {
      pickedUpAtByOrderId.set(event.order_id, event.created_at);
    }
    if (event.event_type === "website.shop_owner_confirmed_driver_cancel") {
      shopConfirmedCancelOrderIds.add(event.order_id);
    }
    if (event.event_type === "issue_reported" && event.payload && !cancelMetaByOrderId.has(event.order_id)) {
      const payload = event.payload as Record<string, unknown>;
      const cancelHandling = payload.cancel_handling === "return_to_shop" || payload.cancel_handling === "not_returning" ? (payload.cancel_handling as "return_to_shop" | "not_returning") : null;
      const cancelReason = typeof payload.cancel_reason === "string" ? payload.cancel_reason : null;
      const cancelOtherReason = typeof payload.cancel_other_reason === "string" ? payload.cancel_other_reason : null;
      if (cancelHandling || cancelReason || cancelOtherReason) {
        cancelMetaByOrderId.set(event.order_id, { cancelReason, cancelOtherReason, cancelHandling });
      }
    }
  }
  const orders = rawOrders.filter((row: any) => {
    if (row.status !== "canceled") return true;
    const sourcePayload = row?.source_payload && typeof row.source_payload === "object"
      ? (row.source_payload as Record<string, unknown>)
      : null;
    return !sourcePayload?.shopOwnerCancelConfirmedAt && !shopConfirmedCancelOrderIds.has(row.id);
  });
  const [{ shopMap, customerMap, totalSentOrdersByShopId }, unreadByOrderId] = await Promise.all([
    loadShopAndCustomerMaps(supabase, orders),
    loadDriverChatUnreadMap(driverId, orders)
  ]);
  return orders.map((row: any) => {
    const cancelMeta = cancelMetaByOrderId.get(row.id);
    return toOrderSummary(
      {
        ...row,
        accepted_at: acceptedAtByOrderId.get(row.id) ?? acceptedAtEventByOrderId.get(row.id) ?? null,
        picked_up_at: pickedUpAtByOrderId.get(row.id) ?? null,
        cancel_reason: cancelMeta?.cancelReason ?? null,
        cancel_other_reason: cancelMeta?.cancelOtherReason ?? null,
        cancel_handling: cancelMeta?.cancelHandling ?? null
      },
      shopMap.get(row.shop_id),
      customerMap.get(row.customer_id),
      totalSentOrdersByShopId,
      Boolean(unreadByOrderId.get(row.id))
    );
  });
}

export async function getDriverOrderDetail(driverId: string, orderId: string) {
  const supabase = createServiceRoleSupabaseClient();
  const [{ data: assignment }, { data: order }] = await Promise.all([
    supabase.from("order_assignments").select("id,accepted_at").eq("driver_id", driverId).eq("order_id", orderId).is("canceled_at", null).maybeSingle(),
    supabase
      .from("orders")
      .select("id,external_order_id,transaction_code,status,assigned_fee_mop,created_at,promised_at,shop_id,customer_id,source_payload,offline_payment_note")
      .eq("id", orderId)
      .maybeSingle()
  ]);

  if (!order) return null;
  if (order.status !== "new" && !assignment) return null;

  const [{ data: shop }, { data: customer }, { data: items }, { data: events }, { data: proof }, { totalSentOrdersByShopId }, unreadByOrderId] = await Promise.all([
    supabase.from("shops").select("id,name,address,district,latitude,longitude,contact_phone").eq("id", order.shop_id).maybeSingle(),
    supabase.from("customers").select("id,name,address,district,latitude,longitude,phone").eq("id", order.customer_id).maybeSingle(),
    supabase.from("order_items").select("item_name,quantity").eq("order_id", orderId),
    supabase.from("order_events").select("event_type,created_at,payload").eq("order_id", orderId).order("created_at", { ascending: true }),
    supabase.from("delivery_proofs").select("id").eq("order_id", orderId).eq("driver_id", driverId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    loadShopAndCustomerMaps(supabase, [order]),
    loadDriverChatUnreadMap(driverId, [order])
  ]);

  const acceptedEvent = (events ?? []).find((event: any) => event.event_type === "accepted");
  const pickedUpEvent = (events ?? []).find((event: any) => event.event_type === "picked_up");
  const cancelEvent = [...(events ?? [])].reverse().find((event: any) => event.event_type === "issue_reported" && (event.payload?.cancel_handling || event.payload?.cancel_reason));
  const summary = toOrderSummary({
    ...order,
    accepted_at: assignment?.accepted_at ?? acceptedEvent?.created_at ?? null,
    picked_up_at: pickedUpEvent?.created_at ?? null,
    cancel_reason: cancelEvent?.payload?.cancel_reason ?? null,
    cancel_other_reason: cancelEvent?.payload?.cancel_other_reason ?? null,
    cancel_handling: cancelEvent?.payload?.cancel_handling ?? null
  }, shop, customer, totalSentOrdersByShopId);
  return {
    ...summary,
    items: (items ?? []).map((item: any) => `${item.quantity} x ${item.item_name}`),
    timeline: (events ?? []).map((event: any) => ({
      label: event.event_type,
      timestamp: formatDateTime(event.created_at),
      note:
        typeof event.payload?.cancel_reason === "string"
          ? `取消原因：${event.payload.cancel_reason}`
          : typeof event.payload?.note === "string"
            ? event.payload.note
            : "系統事件"
    })),
    hasProof: Boolean(proof)
  } satisfies DriverWebOrderDetail;
}

export async function getDriverDashboard(driverId: string, _availability: string, _approvalStatus: string) {
  const supabase = createServiceRoleSupabaseClient();
  const [{ data: profile }, availableOrders] = await Promise.all([
    supabase.from("driver_profiles").select("availability,approval_status").eq("id", driverId).maybeSingle(),
    listAvailableOrders(driverId)
  ]);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));
  startOfWeek.setHours(0, 0, 0, 0);

  const { data: weekEvents } = await supabase
    .from("order_events")
    .select("order_id,created_at")
    .eq("actor_driver_id", driverId)
    .eq("event_type", "delivered")
    .gte("created_at", startOfWeek.toISOString());

  const weekEventRows = weekEvents ?? [];
  const todayEventRows = weekEventRows.filter((item: any) => typeof item.created_at === "string" && item.created_at >= startOfDay.toISOString());
  const weekOrderIds = [...new Set(weekEventRows.map((item: any) => item.order_id))];
  const { data: weekOrders } = weekOrderIds.length
    ? await supabase.from("orders").select("id,assigned_fee_mop").in("id", weekOrderIds)
    : { data: [] as any[] };
  const amountByOrderId = new Map((weekOrders ?? []).map((item: any) => [item.id, Number(item.assigned_fee_mop ?? 0)]));
  const sumByIds = (ids: string[]) => ids.reduce((sum, id) => sum + Number(amountByOrderId.get(id) ?? 0), 0);
  const todayOrderIds = [...new Set(todayEventRows.map((item: any) => item.order_id))];
  const pickupDistrictOptions = [...new Set(availableOrders.map((item) => item.pickupDistrict).filter(Boolean))] as string[];
  const destinationDistrictOptions = [...new Set(availableOrders.map((item) => item.destinationDistrict).filter(Boolean))] as string[];

  return {
    todayEarningsMop: sumByIds(todayOrderIds),
    weekEarningsMop: sumByIds(weekOrderIds),
    completedToday: todayOrderIds.length,
    availability: profile?.availability ?? "offline",
    approvalStatus: profile?.approval_status ?? "pending_review",
    availableOrders,
    pickupDistrictOptions,
    destinationDistrictOptions
  } satisfies DriverDashboard;
}

export async function listCompletedOrders(driverId: string, range: "today" | "yesterday" | "week" | "history" = "today") {
  const supabase = createServiceRoleSupabaseClient();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfDay);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));
  startOfWeek.setHours(0, 0, 0, 0);

  let query = supabase.from("order_events").select("order_id,created_at").eq("actor_driver_id", driverId).eq("event_type", "delivered").order("created_at", { ascending: false });
  if (range === "today") query = query.gte("created_at", startOfDay.toISOString());
  if (range === "yesterday") query = query.gte("created_at", startOfYesterday.toISOString()).lt("created_at", startOfDay.toISOString());
  if (range === "week") query = query.gte("created_at", startOfWeek.toISOString());

  const { data: deliveredEvents } = await query.limit(range === "history" ? 100 : 50);
  const events = deliveredEvents ?? [];
  const orderIds = [...new Set(events.map((item: any) => item.order_id))];
  if (orderIds.length === 0) return [] as DriverCompletedOrder[];

  const { data: rows } = await supabase
    .from("orders")
    .select("id,external_order_id,transaction_code,status,assigned_fee_mop,created_at,promised_at,shop_id,customer_id,source_payload,offline_payment_note")
    .in("id", orderIds)
    .order("created_at", { ascending: false });
  const orders = rows ?? [];
  const deliveredAtByOrderId = new Map(events.map((item: any) => [item.order_id, formatDateTime(item.created_at)]));
  const [{ shopMap, customerMap, totalSentOrdersByShopId }, unreadByOrderId] = await Promise.all([
    loadShopAndCustomerMaps(supabase, orders),
    loadDriverChatUnreadMap(driverId, orders)
  ]);
  return orders.map((row: any) => ({
    ...toOrderSummary(row, shopMap.get(row.shop_id), customerMap.get(row.customer_id), totalSentOrdersByShopId, Boolean(unreadByOrderId.get(row.id))),
    deliveredAt: deliveredAtByOrderId.get(row.id) ?? formatDateTime(row.created_at)
  }));
}

export async function getDriverEarnings(driverId: string) {
  const supabase = createServiceRoleSupabaseClient();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));
  startOfWeek.setHours(0, 0, 0, 0);

  const [{ data: weekDeliveredEvents }, { data: historyDeliveredEvents }] = await Promise.all([
    supabase
      .from("order_events")
      .select("order_id,created_at")
      .eq("actor_driver_id", driverId)
      .eq("event_type", "delivered")
      .gte("created_at", startOfWeek.toISOString())
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("order_events")
      .select("order_id,created_at")
      .eq("actor_driver_id", driverId)
      .eq("event_type", "delivered")
      .order("created_at", { ascending: false })
      .limit(100)
  ]);

  const weekEvents = weekDeliveredEvents ?? [];
  const historyEvents = historyDeliveredEvents ?? [];
  const historyOrderIds = [...new Set(historyEvents.map((item: any) => item.order_id))];
  const weekOrderIds = [...new Set(weekEvents.map((item: any) => item.order_id))];
  const todayOrderIds = [...new Set(weekEvents.filter((item: any) => typeof item.created_at === "string" && item.created_at >= startOfDay.toISOString()).map((item: any) => item.order_id))];
  const unionOrderIds = [...new Set([...historyOrderIds, ...weekOrderIds])];
  if (unionOrderIds.length === 0) {
    return {
      todayTotal: 0,
      weekTotal: 0,
      historyTotal: 0,
      historyOrders: [] as DriverCompletedOrder[]
    };
  }

  const { data: rows } = await supabase
    .from("orders")
    .select("id,external_order_id,transaction_code,status,assigned_fee_mop,created_at,promised_at,shop_id,customer_id,source_payload,offline_payment_note")
    .in("id", unionOrderIds)
    .order("created_at", { ascending: false });

  const orders = rows ?? [];
  const orderMap = new Map(orders.map((row: any) => [row.id, row]));
  const amountByOrderId = new Map(orders.map((row: any) => [row.id, Number(row.assigned_fee_mop ?? 0)]));
  const historyRows = historyOrderIds.map((orderId) => orderMap.get(orderId)).filter(Boolean) as any[];
  const { shopMap, customerMap, totalSentOrdersByShopId } = await loadShopAndCustomerMaps(supabase, historyRows);
  const deliveredAtByOrderId = new Map(historyEvents.map((item: any) => [item.order_id, formatDateTime(item.created_at)]));
  const historyOrders = historyRows.map((row: any) => ({
    ...toOrderSummary(row, shopMap.get(row.shop_id), customerMap.get(row.customer_id), totalSentOrdersByShopId),
    deliveredAt: deliveredAtByOrderId.get(row.id) ?? formatDateTime(row.created_at)
  })) as DriverCompletedOrder[];
  const sumByIds = (ids: string[]) => ids.reduce((acc, id) => acc + Number(amountByOrderId.get(id) ?? 0), 0);

  return {
    todayTotal: sumByIds(todayOrderIds),
    weekTotal: sumByIds(weekOrderIds),
    historyTotal: historyOrders.reduce((acc, row) => acc + Number(row.amountMop ?? 0), 0),
    historyOrders
  };
}

export function formatDistanceKmFromCurrent(current: { lat: number; lng: number } | null, order: DriverWebOrderSummary) {
  if (!current) return null;
  const targetLat = order.storeLatitude;
  const targetLng = order.storeLongitude;
  const km = haversineKm(current.lat, current.lng, targetLat, targetLng);
  return km > 0 ? `${km.toFixed(1)} km` : null;
}
