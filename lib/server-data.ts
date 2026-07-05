import { createServiceRoleSupabaseClient } from "@/lib/supabase";
import type { CallbackLog, Metric, Order, Rider, RiderApplication } from "@/lib/data";

type DriverProfileRow = {
  id: string;
  full_name: string;
  phone: string;
  vehicle_type: string | null;
  approval_status: "pending_review" | "approved" | "rejected" | "suspended";
  availability: "online" | "offline";
};

function formatDate(value?: string | null) {
  if (!value) return "未提供";
  return new Intl.DateTimeFormat("zh-Hant-MO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function orderStatusLabel(status: string): Order["status"] {
  switch (status) {
    case "assigned":
      return "assigned";
    case "picked_up":
      return "picked_up";
    case "delivered":
      return "delivered";
    case "failed":
    case "canceled":
      return "issue";
    default:
      return "new";
  }
}

function callbackStatusFromCode(code?: number | null): CallbackLog["status"] {
  if (!code) return "retrying";
  if (code >= 200 && code < 300) return "success";
  return "failed";
}

export async function listRiderApplications(): Promise<RiderApplication[]> {
  const supabase = createServiceRoleSupabaseClient();
  const { data: applications, error } = await supabase
    .from("driver_applications")
    .select("id,driver_id,submitted_at,review_status")
    .order("submitted_at", { ascending: false });

  if (error) {
    throw error;
  }

  const driverIds = [...new Set((applications ?? []).map((item) => item.driver_id))];
  const { data: drivers } = driverIds.length
    ? await supabase
        .from("driver_profiles")
        .select("id,full_name,phone,vehicle_type")
        .in("id", driverIds)
    : { data: [] };

  const { data: documents } = driverIds.length
    ? await supabase
        .from("driver_documents")
        .select("driver_id,document_type")
        .in("driver_id", driverIds)
    : { data: [] };

  const driverMap = new Map((drivers ?? []).map((item) => [item.id, item]));
  const documentMap = new Map<string, Set<string>>();
  for (const doc of documents ?? []) {
    const current = documentMap.get(doc.driver_id) ?? new Set<string>();
    current.add(doc.document_type);
    documentMap.set(doc.driver_id, current);
  }

  return (applications ?? []).map((item) => {
    const driver = driverMap.get(item.driver_id);
    const docs = documentMap.get(item.driver_id) ?? new Set<string>();
    const isComplete =
      docs.has("selfie") && docs.has("macau_id") && docs.has("driving_licence");

    return {
      id: item.id,
      fullName: driver?.full_name ?? "未命名申請人",
      phone: driver?.phone ?? "未提供",
      zone: "澳門",
      submittedAt: formatDate(item.submitted_at),
      documentsComplete: isComplete,
      vehicleType: driver?.vehicle_type ?? "未提供",
      status:
        item.review_status === "approved"
          ? "approved"
          : item.review_status === "rejected"
            ? "rejected"
            : "pending"
    };
  });
}

export async function listRiders(): Promise<Rider[]> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("driver_profiles")
    .select("id,full_name,phone,availability,approval_status")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((item: any) => ({
    id: item.id,
    name: item.full_name,
    phone: item.phone,
    zone: "澳門",
    status:
      item.approval_status === "suspended"
        ? "suspended"
        : item.availability === "online"
          ? "online"
          : "offline",
    approval:
      item.approval_status === "approved"
        ? "approved"
        : item.approval_status === "rejected"
          ? "rejected"
          : "pending",
    rating: 0,
    completedOrders: 0
  }));
}

export async function listOrders(): Promise<Order[]> {
  const supabase = createServiceRoleSupabaseClient();
  const { data: orders, error } = await supabase
    .from("orders")
    .select("id,external_order_id,status,assigned_fee_mop,created_at,promised_at,shop_id,customer_id")
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!orders?.length) return [];

  const shopIds = [...new Set(orders.map((item) => item.shop_id))];
  const customerIds = [...new Set(orders.map((item) => item.customer_id))];

  const [{ data: shops }, { data: customers }, { data: assignments }] = await Promise.all([
    supabase.from("shops").select("id,name").in("id", shopIds),
    supabase.from("customers").select("id,name,address").in("id", customerIds),
    supabase.from("order_assignments").select("order_id,driver_id,assigned_at").in("order_id", orders.map((item) => item.id))
  ]);

  const driverIds = [...new Set((assignments ?? []).map((item) => item.driver_id))];
  const { data: drivers } = driverIds.length
    ? await supabase.from("driver_profiles").select("id,full_name").in("id", driverIds)
    : { data: [] };

  const shopMap = new Map((shops ?? []).map((item) => [item.id, item]));
  const customerMap = new Map((customers ?? []).map((item) => [item.id, item]));
  const driverMap = new Map((drivers ?? []).map((item) => [item.id, item]));
  const assignmentMap = new Map<string, { driver_id: string; assigned_at: string }>();

  for (const assignment of assignments ?? []) {
    const current = assignmentMap.get(assignment.order_id);
    if (!current || new Date(assignment.assigned_at) > new Date(current.assigned_at)) {
      assignmentMap.set(assignment.order_id, assignment);
    }
  }

  return orders.map((item: any) => {
    const shop = shopMap.get(item.shop_id);
    const customer = customerMap.get(item.customer_id);
    const assignment = assignmentMap.get(item.id);
    const driver = assignment ? driverMap.get(assignment.driver_id) : null;
    const etaMinutes = item.promised_at
      ? Math.max(0, Math.round((new Date(item.promised_at).getTime() - Date.now()) / 60000))
      : 0;

    return {
      id: item.id,
      code: item.external_order_id,
      status: orderStatusLabel(item.status),
      customerName: customer?.name ?? "未命名客戶",
      storeName: shop?.name ?? "未命名店舖",
      riderName: driver?.full_name ?? "未指派",
      amountMop: Number(item.assigned_fee_mop ?? 0),
      address: customer?.address ?? "未提供地址",
      createdAt: formatDate(item.created_at),
      etaMinutes,
      items: [],
      timeline: []
    };
  });
}

export async function getOrderById(id: string): Promise<Order | null> {
  const supabase = createServiceRoleSupabaseClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("id,external_order_id,status,assigned_fee_mop,created_at,promised_at,shop_id,customer_id")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!order) return null;

  const [{ data: shop }, { data: customer }, { data: items }, { data: events }, { data: assignments }] =
    await Promise.all([
      supabase.from("shops").select("id,name").eq("id", order.shop_id).maybeSingle(),
      supabase.from("customers").select("id,name,address").eq("id", order.customer_id).maybeSingle(),
      supabase.from("order_items").select("item_name,quantity").eq("order_id", order.id),
      supabase.from("order_events").select("event_type,created_at,payload").eq("order_id", order.id).order("created_at", { ascending: true }),
      supabase.from("order_assignments").select("driver_id,assigned_at").eq("order_id", order.id).order("assigned_at", { ascending: false }).limit(1)
    ]);

  const driverId = assignments?.[0]?.driver_id;
  const { data: driver } = driverId
    ? await supabase.from("driver_profiles").select("full_name").eq("id", driverId).maybeSingle()
    : { data: null };

  return {
    id: order.id,
    code: order.external_order_id,
    status: orderStatusLabel(order.status),
    customerName: customer?.name ?? "未命名客戶",
    storeName: shop?.name ?? "未命名店舖",
    riderName: driver?.full_name ?? "未指派",
    amountMop: Number(order.assigned_fee_mop ?? 0),
    address: customer?.address ?? "未提供地址",
    createdAt: formatDate(order.created_at),
    etaMinutes: order.promised_at
      ? Math.max(0, Math.round((new Date(order.promised_at).getTime() - Date.now()) / 60000))
      : 0,
    items: (items ?? []).map((item) => `${item.quantity} x ${item.item_name}`),
    timeline: (events ?? []).map((event) => ({
      label: event.event_type,
      timestamp: formatDate(event.created_at),
      note: typeof event.payload?.note === "string" ? event.payload.note : "系統事件"
    }))
  };
}

export async function listCallbackLogs(): Promise<CallbackLog[]> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("callback_logs")
    .select("id,event_type,endpoint,http_status,request_body,response_body,sent_at")
    .order("sent_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((item: any) => ({
    id: item.id,
    event: item.event_type,
    endpoint: item.endpoint,
    status: callbackStatusFromCode(item.http_status),
    responseCode: item.http_status ?? 0,
    attempts: 1,
    lastAttemptAt: formatDate(item.sent_at),
    summary:
      typeof item.response_body?.message === "string"
        ? item.response_body.message
        : item.http_status
          ? `最近回應碼 ${item.http_status}`
          : "尚未收到回應"
  }));
}

export async function getMetrics(): Promise<Metric[]> {
  const [applications, riders, orders, callbacks] = await Promise.all([
    listRiderApplications(),
    listRiders(),
    listOrders(),
    listCallbackLogs()
  ]);

  const liveOrders = orders.filter((item) =>
    ["new", "assigned", "picked_up"].includes(item.status)
  ).length;
  const activeRiders = riders.filter((item) => item.status === "online").length;
  const pendingApprovals = applications.filter((item) => item.status === "pending").length;
  const successCallbacks = callbacks.filter((item) => item.status === "success").length;
  const callbackRate = callbacks.length ? Math.round((successCallbacks / callbacks.length) * 100) : 0;

  return [
    { label: "進行中訂單", value: String(liveOrders), change: "即時同步", tone: "positive" },
    { label: "待審核騎手", value: String(pendingApprovals), change: "需要處理", tone: "warning" },
    { label: "在線騎手", value: String(activeRiders), change: "目前上線人數", tone: "positive" },
    { label: "回調成功率", value: `${callbackRate}%`, change: "依據 callback_logs", tone: "default" }
  ];
}
