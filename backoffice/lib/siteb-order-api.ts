import { sendPushToDriver, sendPushToOnlineDrivers } from "./push-notifications";
import { dispatchOrderCallback } from "./siteb-callbacks";
import { createServiceRoleSupabaseClient } from "./supabase";

type ShopInput = {
  externalShopId?: string;
  name: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  contactName?: string | null;
  contactPhone?: string | null;
};

type CustomerInput = {
  externalCustomerId?: string;
  name?: string | null;
  phone?: string | null;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  deliveryNote?: string | null;
};

type ItemInput = {
  name: string;
  quantity: number;
};

type CallbackInput = NonNullable<CreateOrderInput["callback"]>;

export type CreateOrderInput = {
  externalOrderId: string;
  pickupMode: "now" | "scheduled";
  pickupTime?: string | null;
  deliveryMode: "now" | "scheduled" | "asap";
  deliveryDeadline?: string | null;
  deliveryFeeMop: number;
  urgent?: boolean;
  currency?: string;
  shop: ShopInput;
  customer: CustomerInput;
  items?: ItemInput[];
  notes?: Record<string, unknown>;
  callback?: {
    url: string;
    secret?: string;
    headers?: Record<string, string>;
  };
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeMoney(value: number) {
  return Number.isFinite(value) ? Number(value) : 0;
}

function normalizeDeliveryMode(mode: CreateOrderInput["deliveryMode"]) {
  return mode === "asap" ? "now" : mode;
}

function normalizeCallback(input: CreateOrderInput["callback"]): CallbackInput | undefined {
  if (!input) return undefined;
  const cleanedUrl = input.url.trim().replace(/^['"`\s]+|['"`\s]+$/g, "");
  return {
    url: cleanedUrl,
    secret: input.secret?.trim() || undefined,
    headers: input.headers ?? {}
  };
}

function validateRequiredString(value: string | undefined | null, field: string) {
  if (!value?.trim()) {
    throw new Error(`${field} is required`);
  }
}

export function validateCreateOrderInput(input: CreateOrderInput) {
  const callback = normalizeCallback(input.callback);
  validateRequiredString(input.externalOrderId, "externalOrderId");
  validateRequiredString(input.shop?.name, "shop.name");
  validateRequiredString(input.shop?.address, "shop.address");
  validateRequiredString(input.customer?.address, "customer.address");
  if (!callback?.url?.trim()) {
    throw new Error("callback.url is required");
  }
  if (normalizeDeliveryMode(input.deliveryMode) === "scheduled" && !input.deliveryDeadline?.trim()) {
    throw new Error("deliveryDeadline is required when deliveryMode is scheduled");
  }
  if (normalizeDeliveryMode(input.deliveryMode) !== "scheduled") {
    return;
  }
  if (Number.isNaN(Date.parse(input.deliveryDeadline!))) {
    throw new Error("deliveryDeadline must be a valid ISO-8601 datetime");
  }
}

async function upsertShop(shop: ShopInput) {
  const supabase = createServiceRoleSupabaseClient();
  const externalShopId = shop.externalShopId?.trim() || `shop:${shop.name}:${shop.address}`;

  const { data, error } = await supabase
    .from("shops")
    .upsert(
      {
        external_shop_id: externalShopId,
        name: shop.name,
        address: shop.address,
        latitude: shop.latitude ?? null,
        longitude: shop.longitude ?? null,
        contact_name: shop.contactName ?? null,
        contact_phone: shop.contactPhone ?? null,
        updated_at: nowIso()
      },
      { onConflict: "external_shop_id" }
    )
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

async function upsertCustomer(customer: CustomerInput) {
  const supabase = createServiceRoleSupabaseClient();
  const externalCustomerId =
    customer.externalCustomerId?.trim() || `customer:${customer.phone ?? "unknown"}:${customer.address}`;

  const { data, error } = await supabase
    .from("customers")
    .upsert(
      {
        external_customer_id: externalCustomerId,
        name: customer.name ?? null,
        phone: customer.phone ?? null,
        address: customer.address,
        latitude: customer.latitude ?? null,
        longitude: customer.longitude ?? null,
        delivery_note: customer.deliveryNote ?? null,
        updated_at: nowIso()
      },
      { onConflict: "external_customer_id" }
    )
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

async function replaceItems(orderId: string, items: ItemInput[]) {
  const supabase = createServiceRoleSupabaseClient();
  await supabase.from("order_items").delete().eq("order_id", orderId);

  if (!items.length) {
    return;
  }

  const { error } = await supabase.from("order_items").insert(
    items.map((item) => ({
      order_id: orderId,
      item_name: item.name,
      quantity: item.quantity
    }))
  );

  if (error) throw error;
}

async function appendEvent(orderId: string, eventType: string, payload: Record<string, unknown>) {
  const supabase = createServiceRoleSupabaseClient();
  const { error } = await supabase.from("order_events").insert({
    order_id: orderId,
    event_type: eventType,
    actor_type: "website",
    payload
  });
  if (error) throw error;
}

export async function createOrSyncOrder(input: CreateOrderInput) {
  validateCreateOrderInput(input);
  const supabase = createServiceRoleSupabaseClient();
  const normalizedCallback = normalizeCallback(input.callback);
  const existing = await supabase
    .from("orders")
    .select("id,status,source_payload")
    .eq("external_order_id", input.externalOrderId)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data) {
    const previousPayload =
      existing.data.source_payload && typeof existing.data.source_payload === "object"
        ? (existing.data.source_payload as Record<string, unknown>)
        : {};
    const previousCallback =
      previousPayload.callback && typeof previousPayload.callback === "object"
        ? JSON.stringify(previousPayload.callback)
        : "";
    const nextCallback = normalizedCallback ? JSON.stringify(normalizedCallback) : "";

    if (nextCallback && previousCallback !== nextCallback) {
      const { error: callbackUpdateError } = await supabase
        .from("orders")
        .update({
          updated_at: nowIso(),
          source_payload: {
            ...previousPayload,
            callback: normalizedCallback
          }
        })
        .eq("id", existing.data.id);
      if (callbackUpdateError) throw callbackUpdateError;
    }

    return {
      siteBOrderId: existing.data.id as string,
      externalOrderId: input.externalOrderId,
      status: existing.data.status as string,
      created: false
    };
  }

  const [shopId, customerId] = await Promise.all([
    upsertShop(input.shop),
    upsertCustomer(input.customer)
  ]);

  const orderPayload = {
    external_order_id: input.externalOrderId,
    shop_id: shopId,
    customer_id: customerId,
    status: "new",
    promised_at: normalizeDeliveryMode(input.deliveryMode) === "scheduled" ? input.deliveryDeadline ?? null : null,
    assigned_fee_mop: normalizeMoney(input.deliveryFeeMop),
    offline_payment_note: typeof input.notes?.shopNote === "string" ? input.notes.shopNote : null,
    callback_status: "pending",
    source_payload: {
      pickupMode: input.pickupMode,
      pickupTime: input.pickupTime ?? null,
      deliveryMode: normalizeDeliveryMode(input.deliveryMode),
      deliveryDeadline: input.deliveryDeadline ?? null,
      urgent: false,
      currency: input.currency ?? "MOP",
      notes: input.notes ?? {},
      callback: normalizedCallback
    }
  };

  const { data: createdOrder, error } = await supabase
    .from("orders")
    .insert(orderPayload)
    .select("id,status")
    .single();

  if (error) throw error;

  await replaceItems(createdOrder.id as string, input.items ?? []);
  await appendEvent(createdOrder.id as string, "website.order_created", {
    externalOrderId: input.externalOrderId,
    urgent: false
  });

  await sendPushToOnlineDrivers({
    title: "有新訂單可接",
    body: `${input.shop.name} 有新配送工單，請立即查看首頁。`,
    soundKey: "new_order",
    data: {
      type: "new_order",
      externalOrderId: input.externalOrderId,
      urgent: "false",
    },
  }).catch(() => undefined)

  return {
    siteBOrderId: createdOrder.id as string,
    externalOrderId: input.externalOrderId,
    status: createdOrder.status as string,
    created: true
  };
}

export async function cancelOrderByExternalId(
  externalOrderId: string,
  reason: string,
  requestedBy: string,
  requestedAt?: string | null
) {
  const supabase = createServiceRoleSupabaseClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("id,status,source_payload")
    .eq("external_order_id", externalOrderId)
    .maybeSingle();

  if (error) throw error;
  if (!order) {
    return { found: false as const };
  }

  if (["picked_up", "arrived_customer", "delivered"].includes(order.status)) {
    return { found: true as const, canceled: false as const, status: order.status as string };
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      status: "canceled",
      updated_at: nowIso(),
      source_payload: {
        ...(order.source_payload ?? {}),
        canceledReason: reason,
        canceledBy: requestedBy,
        canceledAt: requestedAt ?? nowIso()
      }
    })
    .eq("id", order.id);
  if (updateError) throw updateError;

  await appendEvent(order.id as string, "website.order_canceled", {
    reason,
    requestedBy,
    requestedAt: requestedAt ?? nowIso()
  });

  const { data: assignment } = await supabase
    .from("order_assignments")
    .select("driver_id")
    .eq("order_id", order.id)
    .is("canceled_at", null)
    .order("assigned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (assignment?.driver_id) {
    void sendPushToDriver(assignment.driver_id, {
      title: "",
      body: "",
      data: {
        type: "order_invalidated",
        externalOrderId
      }
    }).catch(() => undefined);
  }

  void sendPushToOnlineDrivers({
    title: "",
    body: "",
    data: {
      type: "order_invalidated",
      externalOrderId
    }
  }).catch(() => undefined);

  return { found: true as const, canceled: true as const, status: "canceled" };
}

export async function confirmOrderById(orderId: string, confirmedBy: string) {
  const supabase = createServiceRoleSupabaseClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("id,status,source_payload")
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw error;
  if (!order) return { found: false as const };

  if (["delivered", "canceled", "failed"].includes(order.status)) {
    return { found: true as const, confirmed: false as const, status: order.status as string };
  }

  const payload =
    order.source_payload && typeof order.source_payload === "object"
      ? (order.source_payload as Record<string, unknown>)
      : {};

  if (!payload.shopConfirmedAt) {
    const confirmedAt = nowIso();
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        updated_at: confirmedAt,
        source_payload: {
          ...payload,
          shopConfirmedAt: confirmedAt,
          shopConfirmedBy: confirmedBy
        }
      })
      .eq("id", orderId);
    if (updateError) throw updateError;

    await appendEvent(orderId, "website.shop_confirmed", {
      note: "訂單已由商戶確認。",
      confirmedBy,
      confirmedAt
    });
  }

  return { found: true as const, confirmed: true as const, status: order.status as string };
}

export async function adminCancelOrderById(orderId: string, requestedBy: string, reason = "backoffice_manual_cancel") {
  const supabase = createServiceRoleSupabaseClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("id,external_order_id,status,source_payload")
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw error;
  if (!order) return { found: false as const };

  if (order.status === "delivered") {
    return { found: true as const, canceled: false as const, status: order.status as string };
  }

  const shouldPlayCancelSound = order.status === "picked_up" || order.status === "arrived_customer";

  if (order.status !== "canceled") {
    const canceledAt = nowIso();
    const payload =
      order.source_payload && typeof order.source_payload === "object"
        ? (order.source_payload as Record<string, unknown>)
        : {};
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: "canceled",
        updated_at: canceledAt,
        source_payload: {
          ...payload,
          canceledReason: reason,
          canceledBy: requestedBy,
          canceledAt,
          canceledFrom: "backoffice"
        }
      })
      .eq("id", order.id);
    if (updateError) throw updateError;

    await appendEvent(order.id as string, "website.order_canceled", {
      note: "訂單已由後台取消。",
      reason,
      requestedBy,
      requestedAt: canceledAt
    });
  }

  const { data: assignment } = await supabase
    .from("order_assignments")
    .select("driver_id")
    .eq("order_id", order.id)
    .is("canceled_at", null)
    .order("assigned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (assignment?.driver_id) {
    void sendPushToDriver(assignment.driver_id, {
      title: shouldPlayCancelSound ? "訂單已取消" : "",
      body: shouldPlayCancelSound ? "唔好意思呀, 老闆取消左訂單。" : "",
      soundKey: shouldPlayCancelSound ? "order_cancelled" : undefined,
      data: {
        type: shouldPlayCancelSound ? "order_canceled" : "order_invalidated",
        externalOrderId: order.external_order_id
      }
    }).catch(() => undefined);
  }

  void sendPushToOnlineDrivers({
    title: shouldPlayCancelSound ? "訂單已取消" : "",
    body: shouldPlayCancelSound ? "唔好意思呀, 老闆取消左訂單。" : "",
    soundKey: shouldPlayCancelSound ? "order_cancelled" : undefined,
    data: {
      type: shouldPlayCancelSound ? "order_canceled" : "order_invalidated",
      externalOrderId: order.external_order_id
    }
  }).catch(() => undefined);

  await dispatchOrderCallback({
    orderId: order.id as string,
    eventType: "canceled",
    note: reason
  }).catch(() => undefined);

  return { found: true as const, canceled: true as const, status: "canceled" };
}

export async function confirmDriverCanceledOrderByShopOwner(orderId: string, confirmedBy: string) {
  const supabase = createServiceRoleSupabaseClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("id,external_order_id,status,source_payload")
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw error;
  if (!order) return { found: false as const };
  if (order.status !== "canceled") {
    return { found: true as const, confirmed: false as const, status: order.status as string };
  }

  const payload =
    order.source_payload && typeof order.source_payload === "object"
      ? (order.source_payload as Record<string, unknown>)
      : {};

  if (!payload.shopOwnerCancelConfirmedAt) {
    const confirmedAt = nowIso();
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        updated_at: confirmedAt,
        source_payload: {
          ...payload,
          shopOwnerCancelConfirmedAt: confirmedAt,
          shopOwnerCancelConfirmedBy: confirmedBy
        }
      })
      .eq("id", orderId);
    if (updateError) throw updateError;

    await appendEvent(orderId, "website.shop_owner_confirmed_driver_cancel", {
      note: "商戶已確認騎手取消訂單。",
      confirmedBy,
      confirmedAt
    });

    await dispatchOrderCallback({
      orderId,
      eventType: "shop_owner_confirmed_driver_cancel",
      note: "商戶已確認騎手取消訂單。"
    }).catch(() => undefined);

    const { data: assignment } = await supabase
      .from("order_assignments")
      .select("driver_id")
      .eq("order_id", orderId)
      .order("assigned_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (assignment?.driver_id) {
      void sendPushToDriver(assignment.driver_id, {
        title: "商戶已確認取消",
        body: "此訂單已結束，已移至已完成紀錄。",
        soundKey: "order_cancelled",
        data: {
          type: "order_canceled_confirmed",
          externalOrderId: order.external_order_id
        }
      }).catch(() => undefined);
    }
  }

  return { found: true as const, confirmed: true as const, status: order.status as string };
}

export async function raiseOrderPriceByExternalId(
  externalOrderId: string,
  newDeliveryFeeMop: number,
  reason: string,
  updatedAt?: string | null
) {
  const supabase = createServiceRoleSupabaseClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("id,status,source_payload")
    .eq("external_order_id", externalOrderId)
    .maybeSingle();
  if (error) throw error;
  if (!order) return { found: false as const };
  if (["picked_up", "arrived_customer", "delivered", "canceled", "failed"].includes(order.status)) {
    return {
      found: true as const,
      raised: false as const,
      externalOrderId,
      status: order.status as string
    };
  }

  const nextSourcePayload = {
    ...(order.source_payload ?? {}),
    urgent: true,
    priceRaisedAt: updatedAt ?? nowIso(),
    priceRaiseReason: reason
  };

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      assigned_fee_mop: normalizeMoney(newDeliveryFeeMop),
      updated_at: nowIso(),
      source_payload: nextSourcePayload
    })
    .eq("id", order.id);
  if (updateError) throw updateError;

  await appendEvent(order.id as string, "website.raise_price", {
    newDeliveryFeeMop: normalizeMoney(newDeliveryFeeMop),
    reason,
    updatedAt: updatedAt ?? nowIso()
  });

  const { data: assignment } = await supabase
    .from("order_assignments")
    .select("driver_id")
    .eq("order_id", order.id)
    .is("canceled_at", null)
    .order("assigned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const urgentPayload = {
    title: "有急單呀, 快D睇下",
    body: `配送費已調升至 MOP ${normalizeMoney(newDeliveryFeeMop)}。`,
    soundKey: "urgent_order" as const,
    data: {
      type: "urgent_order",
      externalOrderId,
      urgent: "true",
      deliveryFeeMop: String(normalizeMoney(newDeliveryFeeMop)),
      raiseReason: reason
    }
  };

  if (assignment?.driver_id) {
    await sendPushToDriver(assignment.driver_id, urgentPayload).catch(() => undefined);
  } else {
    await sendPushToOnlineDrivers(urgentPayload).catch(() => undefined);
  }

  return {
    found: true as const,
    raised: true as const,
    externalOrderId,
    status: order.status as string,
    deliveryFeeMop: normalizeMoney(newDeliveryFeeMop),
    urgent: true
  };
}

export async function hurryOrderByExternalId(
  externalOrderId: string,
  message: string,
  requestedBy: string,
  requestedAt?: string | null
) {
  const supabase = createServiceRoleSupabaseClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("id,status")
    .eq("external_order_id", externalOrderId)
    .maybeSingle();

  if (error) throw error;
  if (!order) return { found: false as const };

  if (["delivered", "canceled"].includes(order.status)) {
    return { found: true as const, pushed: false as const, status: order.status as string };
  }

  const { data: assignment } = await supabase
    .from("order_assignments")
    .select("driver_id")
    .eq("order_id", order.id)
    .is("canceled_at", null)
    .order("assigned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  await appendEvent(order.id as string, "website.customer_hurry", {
    message,
    requestedBy,
    requestedAt: requestedAt ?? nowIso()
  });

  if (!assignment?.driver_id) {
    return { found: true as const, pushed: false as const, status: order.status as string };
  }

  await sendPushToDriver(assignment.driver_id, {
    title: "客人催單提醒",
    body: message,
    soundKey: "customer_hurry",
    data: {
      type: "customer_hurry",
      externalOrderId
    }
  });

  return { found: true as const, pushed: true as const, status: order.status as string };
}

export async function getOrderStatusByExternalId(externalOrderId: string) {
  const supabase = createServiceRoleSupabaseClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("id,external_order_id,status,assigned_fee_mop,created_at,promised_at,source_payload,shop_id,customer_id")
    .eq("external_order_id", externalOrderId)
    .maybeSingle();

  if (error) throw error;
  if (!order) return null;

  const [{ data: shop }, { data: customer }, { data: assignment }, { data: proofs }] = await Promise.all([
    supabase.from("shops").select("name,address,contact_phone").eq("id", order.shop_id).maybeSingle(),
    supabase.from("customers").select("name,address,phone").eq("id", order.customer_id).maybeSingle(),
    supabase
      .from("order_assignments")
      .select("driver_id,assigned_at,accepted_at")
      .eq("order_id", order.id)
      .order("assigned_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("delivery_proofs")
      .select("storage_path,created_at")
      .eq("order_id", order.id)
      .order("created_at", { ascending: false })
      .limit(1)
  ]);

  let driver: { full_name: string; phone: string } | null = null;
  if (assignment?.driver_id) {
    const { data } = await supabase
      .from("driver_profiles")
      .select("full_name,phone")
      .eq("id", assignment.driver_id)
      .maybeSingle();
    driver = data ?? null;
  }

  return {
    siteBOrderId: order.id,
    externalOrderId: order.external_order_id,
    status: order.status,
    deliveryFeeMop: Number(order.assigned_fee_mop ?? 0),
    urgent: Boolean((order.source_payload as Record<string, unknown> | null)?.urgent),
    promisedAt: order.promised_at,
    createdAt: order.created_at,
    shop,
    customer,
    driver: driver
      ? {
          fullName: driver.full_name,
          phone: driver.phone
        }
      : null,
    assignment,
    latestProof: proofs?.[0] ?? null
  };
}
