import { getLegalConfig } from "@/lib/legal-config";
import { createServiceRoleSupabaseClient } from "@/lib/supabase";

export type DriverWebOrderSummary = {
  id: string;
  externalOrderId: string;
  status: string;
  storeName: string;
  storeAddress: string;
  customerName: string;
  customerAddress: string;
  amountMop: number;
  createdAt: string;
  promisedAt: string | null;
  etaMinutes: number;
  isUrgent: boolean;
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
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-HK", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function toOrderSummary(order: any, shop: any, customer: any): DriverWebOrderSummary {
  const etaMinutes = order.promised_at ? Math.max(0, Math.round((new Date(order.promised_at).getTime() - Date.now()) / 60000)) : 0;
  return {
    id: order.id,
    externalOrderId: order.external_order_id,
    status: order.status,
    storeName: shop?.name ?? "未命名店舖",
    storeAddress: shop?.address ?? "未提供地址",
    customerName: customer?.name ?? "未命名客戶",
    customerAddress: customer?.address ?? "未提供地址",
    amountMop: Number(order.assigned_fee_mop ?? 0),
    createdAt: formatDateTime(order.created_at),
    promisedAt: order.promised_at ? formatDateTime(order.promised_at) : null,
    etaMinutes,
    isUrgent: etaMinutes > 0 && etaMinutes <= 15
  };
}

async function loadShopAndCustomerMaps(supabase: ReturnType<typeof createServiceRoleSupabaseClient>, rows: any[]) {
  const shopIds = [...new Set(rows.map((row) => row.shop_id).filter(Boolean))];
  const customerIds = [...new Set(rows.map((row) => row.customer_id).filter(Boolean))];
  const [{ data: shops }, { data: customers }] = await Promise.all([
    shopIds.length ? supabase.from("shops").select("id,name,address").in("id", shopIds) : Promise.resolve({ data: [] as any[] }),
    customerIds.length ? supabase.from("customers").select("id,name,address").in("id", customerIds) : Promise.resolve({ data: [] as any[] })
  ]);
  return {
    shopMap: new Map((shops ?? []).map((item: any) => [item.id, item])),
    customerMap: new Map((customers ?? []).map((item: any) => [item.id, item]))
  };
}

export function maskPhoneFrontFour(phone: string) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length >= 8) return `****${digits.slice(-4)}`;
  return phone;
}

export async function getDriverReviewStatus(driverId: string) {
  const supabase = createServiceRoleSupabaseClient();
  const { data } = await supabase.from("driver_applications").select("review_status,review_note,reviewed_at").eq("driver_id", driverId).order("submitted_at", { ascending: false }).limit(1).maybeSingle();
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

export async function listAvailableOrders() {
  const supabase = createServiceRoleSupabaseClient();
  const { data: rows } = await supabase.from("orders").select("id,external_order_id,status,assigned_fee_mop,created_at,promised_at,shop_id,customer_id").eq("status", "new").order("created_at", { ascending: false }).limit(20);
  const orders = rows ?? [];
  const { shopMap, customerMap } = await loadShopAndCustomerMaps(supabase, orders);
  return orders.map((row: any) => toOrderSummary(row, shopMap.get(row.shop_id), customerMap.get(row.customer_id)));
}

export async function listActiveOrders(driverId: string) {
  const supabase = createServiceRoleSupabaseClient();
  const { data: assignments } = await supabase.from("order_assignments").select("order_id").eq("driver_id", driverId).is("canceled_at", null).order("assigned_at", { ascending: false });
  const orderIds = (assignments ?? []).map((item: any) => item.order_id);
  if (orderIds.length === 0) return [] as DriverWebOrderSummary[];
  const { data: rows } = await supabase.from("orders").select("id,external_order_id,status,assigned_fee_mop,created_at,promised_at,shop_id,customer_id").in("id", orderIds).not("status", "in", "(delivered,canceled)").order("created_at", { ascending: false });
  const orders = rows ?? [];
  const { shopMap, customerMap } = await loadShopAndCustomerMaps(supabase, orders);
  return orders.map((row: any) => toOrderSummary(row, shopMap.get(row.shop_id), customerMap.get(row.customer_id)));
}

export async function getDriverOrderDetail(driverId: string, orderId: string) {
  const supabase = createServiceRoleSupabaseClient();
  const [{ data: assignment }, { data: order }] = await Promise.all([
    supabase.from("order_assignments").select("id").eq("driver_id", driverId).eq("order_id", orderId).is("canceled_at", null).maybeSingle(),
    supabase.from("orders").select("id,external_order_id,status,assigned_fee_mop,created_at,promised_at,shop_id,customer_id").eq("id", orderId).maybeSingle()
  ]);
  if (!order) return null;
  if (order.status !== "new" && !assignment) return null;
  const [{ data: shop }, { data: customer }, { data: items }, { data: events }, { data: proof }] = await Promise.all([
    supabase.from("shops").select("id,name,address").eq("id", order.shop_id).maybeSingle(),
    supabase.from("customers").select("id,name,address").eq("id", order.customer_id).maybeSingle(),
    supabase.from("order_items").select("item_name,quantity").eq("order_id", orderId),
    supabase.from("order_events").select("event_type,created_at,payload").eq("order_id", orderId).order("created_at", { ascending: true }),
    supabase.from("delivery_proofs").select("id").eq("order_id", orderId).eq("driver_id", driverId).order("created_at", { ascending: false }).limit(1).maybeSingle()
  ]);
  const summary = toOrderSummary(order, shop, customer);
  return {
    ...summary,
    items: (items ?? []).map((item: any) => `${item.quantity} x ${item.item_name}`),
    timeline: (events ?? []).map((event: any) => ({
      label: event.event_type,
      timestamp: formatDateTime(event.created_at),
      note: typeof event.payload?.cancel_reason === "string" ? `取消原因：${event.payload.cancel_reason}` : (typeof event.payload?.note === "string" ? event.payload.note : "系統事件")
    })),
    hasProof: Boolean(proof)
  } satisfies DriverWebOrderDetail;
}

export async function getDriverDashboard(driverId: string, availability: string, approvalStatus: string) {
  const supabase = createServiceRoleSupabaseClient();
  const availableOrders = await listAvailableOrders();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));
  startOfWeek.setHours(0, 0, 0, 0);
  const [{ data: todayEvents }, { data: weekEvents }] = await Promise.all([
    supabase.from("order_events").select("order_id").eq("actor_driver_id", driverId).eq("event_type", "delivered").gte("created_at", startOfDay.toISOString()),
    supabase.from("order_events").select("order_id").eq("actor_driver_id", driverId).eq("event_type", "delivered").gte("created_at", startOfWeek.toISOString())
  ]);
  async function sumAmounts(eventRows: any[] | null | undefined) {
    const ids = [...new Set((eventRows ?? []).map((item: any) => item.order_id))];
    if (ids.length === 0) return 0;
    const { data } = await supabase.from("orders").select("assigned_fee_mop").in("id", ids);
    return Number((data ?? []).reduce((sum: number, item: any) => sum + Number(item.assigned_fee_mop ?? 0), 0));
  }
  const [todayEarningsMop, weekEarningsMop] = await Promise.all([sumAmounts(todayEvents), sumAmounts(weekEvents)]);
  return {
    todayEarningsMop,
    weekEarningsMop,
    completedToday: [...new Set((todayEvents ?? []).map((item: any) => item.order_id))].length,
    availability,
    approvalStatus,
    availableOrders
  } satisfies DriverDashboard;
}


export type DriverCompletedOrder = DriverWebOrderSummary & {
  deliveredAt: string;
};

export async function listCompletedOrders(driverId: string, range: "today" | "week" | "history" = "today") {
  const supabase = createServiceRoleSupabaseClient();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));
  startOfWeek.setHours(0, 0, 0, 0);

  let query = supabase.from("order_events").select("order_id,created_at").eq("actor_driver_id", driverId).eq("event_type", "delivered").order("created_at", { ascending: false });
  if (range === "today") query = query.gte("created_at", startOfDay.toISOString());
  if (range === "week") query = query.gte("created_at", startOfWeek.toISOString());

  const { data: deliveredEvents } = await query.limit(range === "history" ? 100 : 50);
  const events = deliveredEvents ?? [];
  const orderIds = [...new Set(events.map((item: any) => item.order_id))];
  if (orderIds.length === 0) return [] as DriverCompletedOrder[];

  const { data: rows } = await supabase
    .from("orders")
    .select("id,external_order_id,status,assigned_fee_mop,created_at,promised_at,shop_id,customer_id")
    .in("id", orderIds)
    .order("created_at", { ascending: false });
  const orders = rows ?? [];
  const deliveredAtByOrderId = new Map(events.map((item: any) => [item.order_id, formatDateTime(item.created_at)]));
  const { shopMap, customerMap } = await loadShopAndCustomerMaps(supabase, orders);
  return orders.map((row: any) => ({
    ...toOrderSummary(row, shopMap.get(row.shop_id), customerMap.get(row.customer_id)),
    deliveredAt: deliveredAtByOrderId.get(row.id) ?? row.createdAt
  }));
}

export async function getDriverEarnings(driverId: string) {
  const [todayOrders, weekOrders, historyOrders] = await Promise.all([
    listCompletedOrders(driverId, "today"),
    listCompletedOrders(driverId, "week"),
    listCompletedOrders(driverId, "history")
  ]);

  const sum = (rows: Array<{ amountMop: number }>) => rows.reduce((acc, row) => acc + Number(row.amountMop ?? 0), 0);

  return {
    todayTotal: sum(todayOrders),
    weekTotal: sum(weekOrders),
    historyTotal: sum(historyOrders),
    historyOrders
  };
}
