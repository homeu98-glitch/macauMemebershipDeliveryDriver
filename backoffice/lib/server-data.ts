import { unstable_noStore as noStore } from "next/cache";
import { createServiceRoleSupabaseClient } from "./supabase";
import type { CallbackLog, IncomingCallbackReceipt, Metric, Order, PushTokenRegistration, Rider, RiderApplication } from "./data";
import { findMacauDistrict, listMacauDistrictNames } from "./districts";

type DriverProfileRow = {
  id: string;
  full_name: string;
  phone: string;
  vehicle_type: string | null;
  approval_status: "pending_review" | "approved" | "rejected" | "suspended";
  availability: "online" | "offline";
};

type DriverDocumentRow = {
  driver_id: string;
  document_type: "selfie" | "macau_id" | "driving_licence";
  storage_path: string | null;
};

async function buildSignedStorageUrl(
  bucket: "driver-documents" | "delivery-proofs",
  storagePath: string | null | undefined
) {
  if (!storagePath) return null;
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(storagePath, 60 * 60 * 24);
  if (error) return null;
  return data.signedUrl;
}


const EFFECTIVE_ONLINE_WINDOW_MINUTES = 3;
const RIDER_HEARTBEAT_LOOKBACK_HOURS = 24;

function isEffectiveOnline(manualAvailability: string, lastHeartbeatIso: string | null) {
  if (manualAvailability != "online") return false;
  if (!lastHeartbeatIso) return false;
  const windowMs = EFFECTIVE_ONLINE_WINDOW_MINUTES * 60 * 1000;
  return Date.now() - new Date(lastHeartbeatIso).getTime() <= windowMs;
}

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
  noStore();
  const supabase = createServiceRoleSupabaseClient();
  const { data: applications, error } = await supabase
    .from("driver_applications")
    .select("id,driver_id,submitted_at,review_status,review_note,reviewed_at")
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
        .select("driver_id,document_type,storage_path")
        .in("driver_id", driverIds)
    : { data: [] };

  const driverMap = new Map((drivers ?? []).map((item) => [item.id, item]));
  const documentMap = new Map<string, DriverDocumentRow[]>();
  for (const doc of (documents ?? []) as DriverDocumentRow[]) {
    const current = documentMap.get(doc.driver_id) ?? [];
    current.push(doc);
    documentMap.set(doc.driver_id, current);
  }

  return Promise.all((applications ?? []).map(async (item) => {
    const driver = driverMap.get(item.driver_id);
    const docs = documentMap.get(item.driver_id) ?? [];
    const docTypes = new Set(docs.map((doc) => doc.document_type));
    const isComplete =
      docTypes.has("selfie") && docTypes.has("macau_id") && docTypes.has("driving_licence");

    const normalizedDocs = await Promise.all(
      (["selfie", "macau_id", "driving_licence"] as const).map(async (type) => {
        const row = docs.find((doc) => doc.document_type === type);
        return {
          type,
          label:
            type === "selfie"
              ? "自拍照"
              : type === "macau_id"
                ? "澳門身份證"
                : "駕駛執照",
          url: await buildSignedStorageUrl("driver-documents", row?.storage_path)
        };
      })
    );

    return {
      id: item.id,
      fullName: driver?.full_name ?? "未命名申請人",
      phone: driver?.phone ?? "未提供",
      zone: "澳門",
      submittedAt: formatDate(item.submitted_at),
      documentsComplete: isComplete,
      documents: normalizedDocs,
      vehicleType: driver?.vehicle_type ?? "未提供",
      status:
        item.review_status === "approved"
          ? "approved"
          : item.review_status === "rejected"
            ? "rejected"
            : "pending"
    };
  }));
}

export async function listRiders(): Promise<Rider[]> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("driver_profiles")
    .select("id,full_name,phone,availability,approval_status,last_heartbeat_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const drivers = (data ?? []) as Array<any>;
  const driverIds = drivers.map((item) => item.id as string);

  // 心跳來源：driver_locations 最新 captured_at（用 24 小時窗口避免掃全表）
  const since = new Date(Date.now() - RIDER_HEARTBEAT_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();
  const { data: locationRows } = driverIds.length
    ? await supabase
        .from("driver_locations")
        .select("driver_id,captured_at")
        .in("driver_id", driverIds)
        .gte("captured_at", since)
        .order("captured_at", { ascending: false })
    : { data: [] };

  const latestHeartbeatByDriver = new Map<string, string>();
  for (const row of (locationRows ?? []) as Array<any>) {
    if (latestHeartbeatByDriver.has(row.driver_id)) continue;
    latestHeartbeatByDriver.set(row.driver_id, row.captured_at);
  }

  return drivers.map((item: any) => {
    const manualAvailability = item.availability === "online" ? "online" : "offline";
    const lastFromProfile = typeof item.last_heartbeat_at === "string" ? item.last_heartbeat_at : null;
    const lastFromLocations = latestHeartbeatByDriver.get(item.id) ?? null;
    const lastHeartbeatIso =
      lastFromProfile && lastFromLocations
        ? (new Date(lastFromProfile) > new Date(lastFromLocations) ? lastFromProfile : lastFromLocations)
        : (lastFromProfile ?? lastFromLocations);
    const effectiveOnline = isEffectiveOnline(manualAvailability, lastHeartbeatIso);

    return {
      id: item.id,
      name: item.full_name,
      phone: item.phone,
      zone: "澳門",
      status:
        item.approval_status === "suspended"
          ? "suspended"
          : effectiveOnline
            ? "online"
            : "offline",
      manualAvailability,
      lastHeartbeatAt: lastHeartbeatIso ? formatDate(lastHeartbeatIso) : null,
      approval:
        item.approval_status === "approved"
          ? "approved"
          : item.approval_status === "rejected"
            ? "rejected"
            : "pending",
      rating: 0,
      completedOrders: 0
    };
  });
}

export async function listOrders(): Promise<Order[]> {
  noStore();
  const supabase = createServiceRoleSupabaseClient();
  const { data: orders, error } = await supabase
    .from("orders")
    .select("id,external_order_id,transaction_code,status,assigned_fee_mop,created_at,promised_at,shop_id,customer_id,source_payload")
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!orders?.length) return [];

  const shopIds = [...new Set(orders.map((item) => item.shop_id))];
  const customerIds = [...new Set(orders.map((item) => item.customer_id))];

  const [{ data: shops }, { data: customers }, { data: assignments }, { data: orderEvents }] = await Promise.all([
    supabase.from("shops").select("id,name").in("id", shopIds),
    supabase.from("customers").select("id,name,address").in("id", customerIds),
    supabase.from("order_assignments").select("order_id,driver_id,assigned_at").in("order_id", orders.map((item) => item.id)),
    supabase
      .from("order_events")
      .select("order_id,event_type,created_at,payload")
      .in("order_id", orders.map((item) => item.id))
  ]);

  const driverIds = [...new Set((assignments ?? []).map((item) => item.driver_id))];
  const { data: drivers } = driverIds.length
    ? await supabase.from("driver_profiles").select("id,full_name").in("id", driverIds)
    : { data: [] };

  const shopMap = new Map((shops ?? []).map((item) => [item.id, item]));
  const customerMap = new Map((customers ?? []).map((item) => [item.id, item]));
  const driverMap = new Map((drivers ?? []).map((item) => [item.id, item]));
  const assignmentMap = new Map<string, { driver_id: string; assigned_at: string }>();
  const cancelEventMap = new Map<string, any>();

  for (const assignment of assignments ?? []) {
    const current = assignmentMap.get(assignment.order_id);
    if (!current || new Date(assignment.assigned_at) > new Date(current.assigned_at)) {
      assignmentMap.set(assignment.order_id, assignment);
    }
  }

  for (const event of orderEvents ?? []) {
    const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
    const hasCancelPayload = Boolean(
      (payload as any).cancel_reason || (payload as any).cancel_other_reason || (payload as any).cancel_handling
    );
    if (!hasCancelPayload) continue;
    const current = cancelEventMap.get(event.order_id);
    if (!current || new Date(event.created_at) > new Date(current.created_at)) {
      cancelEventMap.set(event.order_id, event);
    }
  }

  return orders.map((item: any) => {
    const shop = shopMap.get(item.shop_id);
    const customer = customerMap.get(item.customer_id);
    const assignment = assignmentMap.get(item.id);
    const driver = assignment ? driverMap.get(assignment.driver_id) : null;
    const sourcePayload =
      item.source_payload && typeof item.source_payload === "object"
        ? (item.source_payload as Record<string, any>)
        : {};
    const cancelEvent = cancelEventMap.get(item.id);
    const cancelPayload =
      cancelEvent?.payload && typeof cancelEvent.payload === "object"
        ? (cancelEvent.payload as Record<string, any>)
        : {};
    const etaMinutes = item.promised_at
      ? Math.max(0, Math.round((new Date(item.promised_at).getTime() - Date.now()) / 60000))
      : 0;

    return {
      id: item.id,
      code: item.transaction_code ?? item.external_order_id,
      displayOrderNo: item.transaction_code ?? item.external_order_id,
      externalOrderId: item.external_order_id,
      isUrgent: Boolean(sourcePayload.priceRaisedAt || sourcePayload.price_raised_at),
      rawStatus: item.status,
      status: orderStatusLabel(item.status),
      customerName: customer?.name ?? "未命名客戶",
      storeName: shop?.name ?? "未命名店舖",
      riderName: driver?.full_name ?? "未指派",
      amountMop: Number(item.assigned_fee_mop ?? 0),
      address: customer?.address ?? "未提供地址",
      createdAt: formatDate(item.created_at),
      etaMinutes,
      items: [],
      cancelReason:
        typeof cancelPayload.cancel_reason === "string"
          ? cancelPayload.cancel_reason
          : typeof sourcePayload.canceledReason === "string"
            ? sourcePayload.canceledReason
            : null,
      cancelOtherReason:
        typeof cancelPayload.cancel_other_reason === "string" ? cancelPayload.cancel_other_reason : null,
      cancelHandling:
        cancelPayload.cancel_handling === "return_to_shop" || cancelPayload.cancel_handling === "not_returning"
          ? cancelPayload.cancel_handling
          : null,
      shopOwnerCancelConfirmedAt:
        typeof sourcePayload.shopOwnerCancelConfirmedAt === "string"
          ? formatDate(sourcePayload.shopOwnerCancelConfirmedAt)
          : null,
      shopOwnerCancelConfirmedBy:
        typeof sourcePayload.shopOwnerCancelConfirmedBy === "string"
          ? sourcePayload.shopOwnerCancelConfirmedBy
          : null,
      timeline: []
    };
  });
}

export async function getOrderById(id: string): Promise<Order | null> {
  const supabase = createServiceRoleSupabaseClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("id,external_order_id,transaction_code,status,assigned_fee_mop,created_at,promised_at,shop_id,customer_id,source_payload")
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
  const sourcePayload =
    order.source_payload && typeof order.source_payload === "object"
      ? (order.source_payload as Record<string, any>)
      : {};
  const latestCancelEvent = [...(events ?? [])]
    .reverse()
    .find((event: any) => {
      const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
      return Boolean(payload.cancel_reason || payload.cancel_other_reason || payload.cancel_handling);
    });
  const cancelPayload =
    latestCancelEvent?.payload && typeof latestCancelEvent.payload === "object"
      ? (latestCancelEvent.payload as Record<string, any>)
      : {};

  return {
    id: order.id,
    code: order.transaction_code ?? order.external_order_id,
    displayOrderNo: order.transaction_code ?? order.external_order_id,
    externalOrderId: order.external_order_id,
    isUrgent: Boolean(sourcePayload.priceRaisedAt || sourcePayload.price_raised_at),
    rawStatus: order.status,
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
    cancelReason:
      typeof cancelPayload.cancel_reason === "string"
        ? cancelPayload.cancel_reason
        : typeof sourcePayload.canceledReason === "string"
          ? sourcePayload.canceledReason
          : null,
    cancelOtherReason:
      typeof cancelPayload.cancel_other_reason === "string" ? cancelPayload.cancel_other_reason : null,
    cancelHandling:
      cancelPayload.cancel_handling === "return_to_shop" || cancelPayload.cancel_handling === "not_returning"
        ? cancelPayload.cancel_handling
        : null,
    shopOwnerCancelConfirmedAt:
      typeof sourcePayload.shopOwnerCancelConfirmedAt === "string"
        ? formatDate(sourcePayload.shopOwnerCancelConfirmedAt)
        : null,
    shopOwnerCancelConfirmedBy:
      typeof sourcePayload.shopOwnerCancelConfirmedBy === "string"
        ? sourcePayload.shopOwnerCancelConfirmedBy
        : null,
    timeline: (events ?? []).map((event) => ({
      label: event.event_type,
      timestamp: formatDate(event.created_at),
      note:
        typeof event.payload?.note === "string"
          ? event.payload.note
          : typeof event.payload?.cancel_reason === "string"
            ? `取消原因：${event.payload.cancel_reason}`
            : "系統事件"
    }))
  };
}


export async function getRiderDetailById(id: string) {
  const supabase = createServiceRoleSupabaseClient();

  const [{ data: rider, error }, { data: latestApplication }, { data: assignments }] = await Promise.all([
    supabase
      .from("driver_profiles")
      .select("id,full_name,phone,vehicle_type,approval_status,availability,created_at")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("driver_applications")
      .select("submitted_at,review_status,review_note,reviewed_at")
      .eq("driver_id", id)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("order_assignments")
      .select("order_id,assigned_at")
      .eq("driver_id", id)
      .order("assigned_at", { ascending: false })
  ]);

  if (error) throw error;
  if (!rider) return null;

  const latestAssignmentByOrderId = new Map<string, string>();
  for (const row of assignments ?? []) {
    if (!latestAssignmentByOrderId.has(row.order_id)) {
      latestAssignmentByOrderId.set(row.order_id, row.assigned_at);
    }
  }

  const orderIds = [...latestAssignmentByOrderId.keys()];
  if (!orderIds.length) {
    return {
      id: rider.id,
      fullName: rider.full_name,
      phone: rider.phone,
      vehicleType: rider.vehicle_type ?? "未提供",
      approvalStatus: rider.approval_status,
      availability: rider.availability,
      createdAt: formatDate((rider as any).created_at),
      applicationSubmittedAt: latestApplication?.submitted_at ? formatDate(latestApplication.submitted_at) : null,
      reviewStatus: latestApplication?.review_status ?? null,
      reviewNote: latestApplication?.review_note ?? null,
      reviewedAt: latestApplication?.reviewed_at ? formatDate(latestApplication.reviewed_at) : null,
      orders: []
    };
  }

  const [{ data: orders, error: ordersError }, { data: items }, { data: events }] = await Promise.all([
    supabase
      .from("orders")
      .select("id,external_order_id,transaction_code,status,assigned_fee_mop,created_at,promised_at,shop_id,customer_id,source_payload")
      .in("id", orderIds),
    supabase
      .from("order_items")
      .select("order_id,item_name,quantity")
      .in("order_id", orderIds),
    supabase
      .from("order_events")
      .select("order_id,event_type,created_at,payload")
      .in("order_id", orderIds)
      .order("created_at", { ascending: true })
  ]);

  if (ordersError) throw ordersError;

  const shopIds = [...new Set((orders ?? []).map((item: any) => item.shop_id).filter(Boolean))];
  const customerIds = [...new Set((orders ?? []).map((item: any) => item.customer_id).filter(Boolean))];

  const [{ data: shops }, { data: customers }] = await Promise.all([
    shopIds.length ? supabase.from("shops").select("id,name").in("id", shopIds) : Promise.resolve({ data: [] as any[] }),
    customerIds.length ? supabase.from("customers").select("id,name,address").in("id", customerIds) : Promise.resolve({ data: [] as any[] })
  ]);

  const shopMap = new Map((shops ?? []).map((item: any) => [item.id, item]));
  const customerMap = new Map((customers ?? []).map((item: any) => [item.id, item]));
  const itemsMap = new Map<string, Array<{ item_name: string; quantity: number }>>();
  const eventsMap = new Map<string, any[]>();

  for (const item of items ?? []) {
    const current = itemsMap.get(item.order_id) ?? [];
    current.push(item as any);
    itemsMap.set(item.order_id, current);
  }

  for (const event of events ?? []) {
    const current = eventsMap.get(event.order_id) ?? [];
    current.push(event as any);
    eventsMap.set(event.order_id, current);
  }

  const normalizedOrders = (orders ?? [])
    .map((order: any) => {
      const orderEvents = eventsMap.get(order.id) ?? [];
      const latestCancelEvent = [...orderEvents].reverse().find((event: any) => {
        const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
        return Boolean(payload.cancel_reason || payload.cancel_other_reason || payload.cancel_handling);
      });
      const cancelPayload =
        latestCancelEvent?.payload && typeof latestCancelEvent.payload === "object"
          ? (latestCancelEvent.payload as Record<string, any>)
          : {};
      const sourcePayload =
        order.source_payload && typeof order.source_payload === "object"
          ? (order.source_payload as Record<string, any>)
          : {};
      const shop = shopMap.get(order.shop_id);
      const customer = customerMap.get(order.customer_id);
      const assignedAt = latestAssignmentByOrderId.get(order.id) ?? order.created_at;

      return {
        id: order.id,
        code: order.transaction_code ?? order.external_order_id,
        displayOrderNo: order.transaction_code ?? order.external_order_id,
        externalOrderId: order.external_order_id,
        isUrgent: Boolean(sourcePayload.priceRaisedAt || sourcePayload.price_raised_at),
        rawStatus: order.status,
        status: orderStatusLabel(order.status),
        customerName: customer?.name ?? "未命名客戶",
        storeName: shop?.name ?? "未命名店舖",
        riderName: rider.full_name,
        amountMop: Number(order.assigned_fee_mop ?? 0),
        address: customer?.address ?? "未提供地址",
        createdAt: formatDate(order.created_at),
        promisedAt: order.promised_at ? formatDate(order.promised_at) : null,
        assignedAt: formatDate(assignedAt),
        items: (itemsMap.get(order.id) ?? []).map((item) => `${item.quantity} x ${item.item_name}`),
        cancelReason:
          typeof cancelPayload.cancel_reason === "string"
            ? cancelPayload.cancel_reason
            : typeof sourcePayload.canceledReason === "string"
              ? sourcePayload.canceledReason
              : null,
        cancelOtherReason:
          typeof cancelPayload.cancel_other_reason === "string" ? cancelPayload.cancel_other_reason : null,
        cancelHandling:
          cancelPayload.cancel_handling === "return_to_shop" || cancelPayload.cancel_handling === "not_returning"
            ? cancelPayload.cancel_handling
            : null,
        shopOwnerCancelConfirmedAt:
          typeof sourcePayload.shopOwnerCancelConfirmedAt === "string"
            ? formatDate(sourcePayload.shopOwnerCancelConfirmedAt)
            : null,
        shopOwnerCancelConfirmedBy:
          typeof sourcePayload.shopOwnerCancelConfirmedBy === "string"
            ? sourcePayload.shopOwnerCancelConfirmedBy
            : null,
        timeline: orderEvents.map((event: any) => ({
          label: event.event_type,
          timestamp: formatDate(event.created_at),
          note:
            typeof event.payload?.note === "string"
              ? event.payload.note
              : typeof event.payload?.cancel_reason === "string"
                ? `取消原因：${event.payload.cancel_reason}`
                : "系統事件"
        }))
      };
    })
    .sort((a, b) => new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime());

  return {
    id: rider.id,
    fullName: rider.full_name,
    phone: rider.phone,
    vehicleType: rider.vehicle_type ?? "未提供",
    approvalStatus: rider.approval_status,
    availability: rider.availability,
    createdAt: formatDate((rider as any).created_at),
    applicationSubmittedAt: latestApplication?.submitted_at ? formatDate(latestApplication.submitted_at) : null,
    reviewStatus: latestApplication?.review_status ?? null,
    reviewNote: latestApplication?.review_note ?? null,
    reviewedAt: latestApplication?.reviewed_at ? formatDate(latestApplication.reviewed_at) : null,
    orders: normalizedOrders
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
    attempts: typeof item.response_body?.attempts === "number" ? item.response_body.attempts : 1,
    lastAttemptAt: formatDate(item.sent_at),
    summary:
      typeof item.response_body?.message === "string"
        ? item.response_body.message
        : item.http_status
          ? `最近回應碼 ${item.http_status}`
          : "尚未收到回應"
  }));
}


export async function getOnlineRiderDistrictCounts(options?: { recentMinutes?: number }) {
  noStore();
  const recentMinutes = options?.recentMinutes ?? 15;
  const since = new Date(Date.now() - recentMinutes * 60 * 1000).toISOString();

  const supabase = createServiceRoleSupabaseClient();

  const { data: onlineDrivers, error: driversError } = await supabase
    .from("driver_profiles")
    .select("id,full_name")
    .eq("availability", "online")
    .eq("approval_status", "approved");

  if (driversError) throw driversError;

  const driverRows = onlineDrivers ?? [];
  const driverIds = driverRows.map((item: any) => item.id);
  const driverNameMap = new Map(driverRows.map((item: any) => [item.id, item.full_name ?? "未命名車手"]));
  const counts: Record<string, number> = {};
  const ridersByDistrict: Record<string, Array<{ id: string; name: string; lastCapturedAt: string }>> = {};
  const districts = listMacauDistrictNames();
  for (const name of districts) {
    counts[name] = 0;
    ridersByDistrict[name] = [];
  }

  if (!driverIds.length) {
    return {
      districts,
      counts,
      ridersByDistrict,
      unknown: 0,
      unknownRiders: [] as Array<{ id: string; name: string }>,
      totalOnline: 0,
      recentMinutes,
      lastUpdatedAt: null as string | null
    };
  }

  const { data: locations, error: locationsError } = await supabase
    .from("driver_locations")
    .select("driver_id,latitude,longitude,captured_at")
    .in("driver_id", driverIds)
    .gte("captured_at", since)
    .order("captured_at", { ascending: false });

  if (locationsError) throw locationsError;

  const latestByDriver = new Map<string, { latitude: number; longitude: number; capturedAt: string }>();
  for (const row of locations ?? []) {
    if (latestByDriver.has(row.driver_id)) continue;
    latestByDriver.set(row.driver_id, {
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      capturedAt: row.captured_at
    });
  }

  let unknown = 0;
  const unknownRiders: Array<{ id: string; name: string }> = [];
  let lastUpdatedAtRaw: string | null = null;

  for (const driverId of driverIds) {
    const loc = latestByDriver.get(driverId);
    const driverName = driverNameMap.get(driverId) ?? "未命名車手";
    if (!loc) {
      unknown += 1;
      unknownRiders.push({ id: driverId, name: driverName });
      continue;
    }

    if (!lastUpdatedAtRaw || new Date(loc.capturedAt) > new Date(lastUpdatedAtRaw)) {
      lastUpdatedAtRaw = loc.capturedAt;
    }

    const district = findMacauDistrict(loc.latitude, loc.longitude);
    if (!district || !(district in counts)) {
      unknown += 1;
      unknownRiders.push({ id: driverId, name: driverName });
      continue;
    }

    counts[district] += 1;
    ridersByDistrict[district].push({
      id: driverId,
      name: driverName,
      lastCapturedAt: formatDate(loc.capturedAt)
    });
  }

  for (const district of districts) {
    ridersByDistrict[district].sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
  }
  unknownRiders.sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));

  return {
    districts,
    counts,
    ridersByDistrict,
    unknown,
    unknownRiders,
    totalOnline: driverIds.length,
    recentMinutes,
    lastUpdatedAt: lastUpdatedAtRaw ? formatDate(lastUpdatedAtRaw) : null
  };
}

export async function listPushTokenRegistrations(): Promise<PushTokenRegistration[]> {
  const supabase = createServiceRoleSupabaseClient();
  const { data: tokens, error } = await supabase
    .from("driver_push_tokens")
    .select("id,driver_id,platform,device_label,app_version,last_seen_at")
    .order("last_seen_at", { ascending: false });

  if (error) throw error;

  const driverIds = [...new Set((tokens ?? []).map((item) => item.driver_id))];
  const { data: drivers } = driverIds.length
    ? await supabase
        .from("driver_profiles")
        .select("id,full_name,phone")
        .in("id", driverIds)
    : { data: [] };

  const driverMap = new Map((drivers ?? []).map((item) => [item.id, item]));

  return (tokens ?? []).map((item: any) => {
    const driver = driverMap.get(item.driver_id);
    return {
      id: item.id,
      riderName: driver?.full_name ?? "未知騎手",
      phone: driver?.phone ?? "未提供",
      platform: item.platform ?? "android",
      deviceLabel: item.device_label ?? "未命名裝置",
      appVersion: item.app_version ?? "未提供",
      lastSeenAt: formatDate(item.last_seen_at),
    };
  });
}

export async function listIncomingCallbackReceipts(): Promise<IncomingCallbackReceipt[]> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("sync_logs")
    .select("id,external_id,status,message,payload,processed_at")
    .eq("source", "siteb_callback_receiver")
    .order("processed_at", { ascending: false })
    .limit(20);

  if (error) throw error;

  return (data ?? []).map((item: any) => ({
    id: item.id,
    event: typeof item.payload?.eventType === "string" ? item.payload.eventType : "unknown",
    externalOrderId:
      typeof item.external_id === "string" && item.external_id
        ? item.external_id
        : typeof item.payload?.externalOrderId === "string"
          ? item.payload.externalOrderId
          : "未提供",
    status: item.status === "rejected" ? "rejected" : "received",
    receivedAt: formatDate(item.processed_at),
    summary:
      typeof item.message === "string" && item.message
        ? item.message
        : item.status === "rejected"
          ? "Webhook 驗證失敗"
          : "已收到並回覆 200"
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
