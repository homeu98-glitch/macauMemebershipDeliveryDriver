import { sendPushToDriver, sendPushToOnlineDrivers } from "./push-notifications";
import { dispatchOrderCallback } from "./siteb-callbacks";
import { createServiceRoleSupabaseClient } from "./supabase";
import { findMacauDistrict } from "./districts";


type CoordSystem = "wgs84" | "gcj02" | "bd09";
type DeliveryFeePaidBy = "customer" | "shop";

type NormalizedCoordSet = {
  sourceCoordSystem: CoordSystem;
  sourceLat: number;
  sourceLng: number;
  wgs84: { latitude: number; longitude: number };
  gcj02: { latitude: number; longitude: number };
  bd09: { latitude: number; longitude: number };
};

type ShopInput = {
  externalShopId?: string;
  name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  coordSystem?: CoordSystem | null;
  contactName?: string | null;
  contactPhone?: string | null;
};

type CustomerInput = {
  externalCustomerId?: string;
  name?: string | null;
  phone?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  coordSystem?: CoordSystem | null;
  deliveryNote?: string | null;
};

type ItemInput = {
  name: string;
  quantity: number;
};

type OrderImageInput = {
  url: string;
  label?: string | null;
  mimeType?: string | null;
};

type CallbackInput = NonNullable<CreateOrderInput["callback"]>;

export type CreateOrderInput = {
  externalOrderId: string;
  pickupMode: "now" | "scheduled";
  pickupTime?: string | null;
  deliveryMode: "now" | "scheduled" | "asap";
  deliveryDeadline?: string | null;
  deliveryFeeMop: number;
  deliveryFeePaidBy?: DeliveryFeePaidBy | null;
  urgent?: boolean;
  currency?: string;
  shop: ShopInput;
  customer?: CustomerInput | null;
  images?: OrderImageInput[];
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

async function isWithinOneMinuteGrace(orderId: string) {
  const supabase = createServiceRoleSupabaseClient();
  const { data: assignment } = await supabase
    .from("order_assignments")
    .select("accepted_at")
    .eq("order_id", orderId)
    .is("canceled_at", null)
    .order("assigned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return typeof assignment?.accepted_at === "string" && Date.now() - new Date(assignment.accepted_at).getTime() <= 30 * 1000;
}

async function cancelActiveAssignments(orderId: string) {
  const supabase = createServiceRoleSupabaseClient();
  await supabase
    .from("order_assignments")
    .update({ canceled_at: nowIso() })
    .eq("order_id", orderId)
    .is("canceled_at", null);
}

function normalizeMoney(value: number) {
  return Number.isFinite(value) ? Number(value) : 0;
}

function normalizeDeliveryFeePaidBy(value: unknown): DeliveryFeePaidBy | null {
  return value === "customer" || value === "shop" ? value : null;
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

async function buildSignedProofUrlForOrderStatus(storagePath: string | null | undefined) {
  if (!storagePath) return null;
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase.storage.from("delivery-proofs").createSignedUrl(storagePath, 60 * 60 * 24);
  if (error) return null;
  return data.signedUrl;
}

function normalizeText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeOrderImages(images: CreateOrderInput["images"]) {
  return (images ?? [])
    .map((item) => ({
      url: normalizeText(item?.url),
      label: normalizeText(item?.label),
      mimeType: normalizeText(item?.mimeType)
    }))
    .filter((item) => item.url)
    .map((item) => ({
      url: item.url!,
      label: item.label ?? null,
      mimeType: item.mimeType ?? null
    }));
}

function buildCustomerSnapshot(customer: CreateOrderInput["customer"] | undefined | null) {
  const address = normalizeText(customer?.address);
  const name = normalizeText(customer?.name);
  const phone = normalizeText(customer?.phone);
  const deliveryNote = normalizeText(customer?.deliveryNote);
  const externalCustomerId = normalizeText(customer?.externalCustomerId);
  const latitude = Number.isFinite(customer?.latitude as number) ? Number(customer?.latitude) : null;
  const longitude = Number.isFinite(customer?.longitude as number) ? Number(customer?.longitude) : null;
  const addressProvided = Boolean(address);
  const contactProvided = Boolean(name || phone);

  return {
    externalCustomerId,
    name,
    phone,
    address: address ?? null,
    latitude,
    longitude,
    deliveryNote,
    addressProvided,
    contactProvided,
    isAnonymous: !contactProvided,
    displayName: name ?? "未提供客戶資料",
    displayAddress: address ?? "請查看訂單圖片中的地址資料"
  };
}

const X_PI = Math.PI * 3000.0 / 180.0;
const PI = Math.PI;
const A = 6378245.0;
const EE = 0.00669342162296594323;

function normalizeCoordSystem(value?: string | null): CoordSystem {
  const normalized = (value ?? "wgs84").trim().toLowerCase();
  if (normalized === "gcj02" || normalized === "bd09" || normalized === "wgs84") {
    return normalized;
  }
  return "wgs84";
}

function outOfChina(lat: number, lng: number) {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

function transformLat(x: number, y: number) {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(y * PI) + 40.0 * Math.sin(y / 3.0 * PI)) * 2.0 / 3.0;
  ret += (160.0 * Math.sin(y / 12.0 * PI) + 320 * Math.sin(y * PI / 30.0)) * 2.0 / 3.0;
  return ret;
}

function transformLng(x: number, y: number) {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(x * PI) + 40.0 * Math.sin(x / 3.0 * PI)) * 2.0 / 3.0;
  ret += (150.0 * Math.sin(x / 12.0 * PI) + 300.0 * Math.sin(x / 30.0 * PI)) * 2.0 / 3.0;
  return ret;
}

function delta(lat: number, lng: number) {
  const dLat = transformLat(lng - 105.0, lat - 35.0);
  const dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = lat / 180.0 * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  return {
    lat: (dLat * 180.0) / ((A * (1 - EE)) / (magic * sqrtMagic) * PI),
    lng: (dLng * 180.0) / (A / sqrtMagic * Math.cos(radLat) * PI),
  };
}

function wgs84ToGcj02(lat: number, lng: number) {
  if (outOfChina(lat, lng)) return { latitude: lat, longitude: lng };
  const d = delta(lat, lng);
  return { latitude: lat + d.lat, longitude: lng + d.lng };
}

function gcj02ToWgs84(lat: number, lng: number) {
  if (outOfChina(lat, lng)) return { latitude: lat, longitude: lng };
  const d = delta(lat, lng);
  return { latitude: lat - d.lat, longitude: lng - d.lng };
}

function gcj02ToBd09(lat: number, lng: number) {
  const z = Math.sqrt(lng * lng + lat * lat) + 0.00002 * Math.sin(lat * X_PI);
  const theta = Math.atan2(lat, lng) + 0.000003 * Math.cos(lng * X_PI);
  return {
    latitude: z * Math.sin(theta) + 0.006,
    longitude: z * Math.cos(theta) + 0.0065,
  };
}

function bd09ToGcj02(lat: number, lng: number) {
  const x = lng - 0.0065;
  const y = lat - 0.006;
  const z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * X_PI);
  const theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * X_PI);
  return {
    latitude: z * Math.sin(theta),
    longitude: z * Math.cos(theta),
  };
}

function normalizeCoordSet(latitude: number, longitude: number, coordSystem?: string | null): NormalizedCoordSet {
  const sourceCoordSystem = normalizeCoordSystem(coordSystem);
  const sourceLat = Number(latitude);
  const sourceLng = Number(longitude);

  let wgs84;
  let gcj02;
  let bd09;

  if (sourceCoordSystem === "wgs84") {
    wgs84 = { latitude: sourceLat, longitude: sourceLng };
    gcj02 = wgs84ToGcj02(sourceLat, sourceLng);
    bd09 = gcj02ToBd09(gcj02.latitude, gcj02.longitude);
  } else if (sourceCoordSystem === "gcj02") {
    gcj02 = { latitude: sourceLat, longitude: sourceLng };
    wgs84 = gcj02ToWgs84(sourceLat, sourceLng);
    bd09 = gcj02ToBd09(sourceLat, sourceLng);
  } else {
    bd09 = { latitude: sourceLat, longitude: sourceLng };
    gcj02 = bd09ToGcj02(sourceLat, sourceLng);
    wgs84 = gcj02ToWgs84(gcj02.latitude, gcj02.longitude);
  }

  return { sourceCoordSystem, sourceLat, sourceLng, wgs84, gcj02, bd09 };
}

function validateRequiredString(value: string | undefined | null, field: string) {
  if (!value?.trim()) {
    throw new Error(`${field} is required`);
  }
}

function requireResolvedDistrict(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  label: string
) {
  if (latitude == null || longitude == null || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error(`${label} latitude/longitude is required to determine district`);
  }

  const district = findMacauDistrict(latitude, longitude);
  if (!district) {
    throw new Error(`${label} district could not be resolved from Macau GeoJSON`);
  }

  return district;
}

export function validateCreateOrderInput(input: CreateOrderInput) {
  const callback = normalizeCallback(input.callback);
  validateRequiredString(input.externalOrderId, "externalOrderId");
  validateRequiredString(input.shop?.name, "shop.name");
  validateRequiredString(input.shop?.address, "shop.address");
  if (!callback?.url?.trim()) {
    throw new Error("callback.url is required");
  }
  if (normalizeDeliveryMode(input.deliveryMode) === "scheduled" && !input.deliveryDeadline?.trim()) {
    throw new Error("deliveryDeadline is required when deliveryMode is scheduled");
  }
  const normalizedImages = normalizeOrderImages(input.images);
  const shopHasCoords = Number.isFinite(Number(input.shop?.latitude)) && Number.isFinite(Number(input.shop?.longitude));
  if (!shopHasCoords) {
    throw new Error("shop latitude/longitude is required to determine district");
  }
  const shopCoords = normalizeCoordSet(Number(input.shop?.latitude), Number(input.shop?.longitude), input.shop?.coordSystem);
  requireResolvedDistrict(shopCoords.wgs84.latitude, shopCoords.wgs84.longitude, "shop");

  const hasCustomerAddress = Boolean(normalizeText(input.customer?.address));
  const customerLat = Number(input.customer?.latitude);
  const customerLng = Number(input.customer?.longitude);
  const hasCustomerCoords =
    Number.isFinite(customerLat) &&
    Number.isFinite(customerLng) &&
    !(customerLat === 0 && customerLng === 0);
  if (!hasCustomerAddress && normalizedImages.length === 0) {
    throw new Error("customer.address or at least one images[].url is required");
  }
  if (hasCustomerCoords) {
    const customerCoords = normalizeCoordSet(customerLat, customerLng, input.customer?.coordSystem);
    requireResolvedDistrict(customerCoords.wgs84.latitude, customerCoords.wgs84.longitude, "customer");
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
  const coords = normalizeCoordSet(Number(shop.latitude), Number(shop.longitude), shop.coordSystem);

  const { data, error } = await supabase
    .from("shops")
    .upsert(
      {
        external_shop_id: externalShopId,
        name: shop.name,
        address: shop.address,
        latitude: coords.wgs84.latitude,
        longitude: coords.wgs84.longitude,
        contact_name: shop.contactName ?? null,
        contact_phone: shop.contactPhone ?? null,
        district: findMacauDistrict(coords.wgs84.latitude, coords.wgs84.longitude),
        updated_at: nowIso()
      },
      { onConflict: "external_shop_id" }
    )
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}



async function upsertCustomer(customer: CustomerInput | null | undefined, externalOrderId: string) {
  const supabase = createServiceRoleSupabaseClient();
  const snapshot = buildCustomerSnapshot(customer);
  const hasCoords = Number.isFinite(Number(customer?.latitude)) && Number.isFinite(Number(customer?.longitude));
  const coords = hasCoords
    ? normalizeCoordSet(Number(customer?.latitude), Number(customer?.longitude), customer?.coordSystem)
    : null;
  const externalCustomerId =
    snapshot.externalCustomerId ||
    (snapshot.phone && snapshot.address
      ? `customer:${snapshot.phone}:${snapshot.address}`
      : `customer:order:${externalOrderId}`);

  const { data, error } = await supabase
    .from("customers")
    .upsert(
      {
        external_customer_id: externalCustomerId,
        name: snapshot.name,
        phone: snapshot.phone,
        address: snapshot.displayAddress,
        latitude: coords?.wgs84.latitude ?? null,
        longitude: coords?.wgs84.longitude ?? null,
        delivery_note: snapshot.deliveryNote,
        district: coords ? findMacauDistrict(coords.wgs84.latitude, coords.wgs84.longitude) : null,
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
  const normalizedImages = normalizeOrderImages(input.images);
  const customerSnapshot = buildCustomerSnapshot(input.customer);
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
    const customerId = await upsertCustomer(input.customer, input.externalOrderId);
    const nextPayload = {
      ...previousPayload,
      callback: normalizedCallback ?? previousPayload.callback ?? null,
      images: normalizedImages,
      customerSnapshot
    };

    if (
      (nextCallback && previousCallback !== nextCallback) ||
      JSON.stringify(previousPayload.images ?? []) !== JSON.stringify(normalizedImages) ||
      JSON.stringify(previousPayload.customerSnapshot ?? {}) !== JSON.stringify(customerSnapshot)
    ) {
      const { error: callbackUpdateError } = await supabase
        .from("orders")
        .update({
          updated_at: nowIso(),
          customer_id: customerId,
          source_payload: nextPayload
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

  const shopCoords = normalizeCoordSet(Number(input.shop.latitude), Number(input.shop.longitude), input.shop.coordSystem);
  const hasCustomerCoords = Number.isFinite(Number(input.customer?.latitude)) && Number.isFinite(Number(input.customer?.longitude));
  const customerCoords = hasCustomerCoords
    ? normalizeCoordSet(Number(input.customer?.latitude), Number(input.customer?.longitude), input.customer?.coordSystem)
    : null;

  const [shopId, customerId] = await Promise.all([
    upsertShop(input.shop),
    upsertCustomer(input.customer, input.externalOrderId)
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
      urgent: input.urgent === true,
      currency: input.currency ?? "MOP",
      notes: input.notes ?? {},
      callback: normalizedCallback,
      images: normalizedImages,
      customerSnapshot,
      navigation: {
        shop: shopCoords,
        customer: customerCoords
      }
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
    urgent: input.urgent === true,
    imageCount: normalizedImages.length,
    customerAddressProvided: customerSnapshot.addressProvided,
    customerContactProvided: customerSnapshot.contactProvided
  });

  await sendPushToOnlineDrivers({
    title: input.urgent === true ? "有急單呀, 快D睇下" : "有新訂單可接",
    body: `${input.shop.name} 有新配送工單，請立即查看首頁。`,
    soundKey: input.urgent === true ? "urgent_order" : "new_order",
    data: {
      type: "new_order",
      externalOrderId: input.externalOrderId,
      urgent: String(input.urgent === true),
      ...(input.urgent === true ? { playSound: "true" } : {}),
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
    .or(`external_order_id.eq.${externalOrderId},transaction_code.eq.${externalOrderId}`)
    .maybeSingle();

  if (error) throw error;
  if (!order) {
    return { found: false as const };
  }

  if (order.status === "delivered") {
    return { found: true as const, canceled: false as const, status: order.status as string };
  }

  const withinGrace = await isWithinOneMinuteGrace(order.id as string);
  if (["picked_up", "arrived_customer"].includes(order.status) && !withinGrace) {
    return { found: true as const, canceled: false as const, status: order.status as string };
  }

  const { data: assignment } = await supabase
    .from("order_assignments")
    .select("id,driver_id,accepted_at")
    .eq("order_id", order.id)
    .is("canceled_at", null)
    .order("assigned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const shouldPlayCancelSound = Boolean(assignment?.driver_id) || ["picked_up", "arrived_customer"].includes(order.status) || withinGrace || order.status === "accepted";
  const acceptedAt = assignment?.accepted_at ?? null;
  const driverCancelConfirmationRequired = Boolean(assignment?.driver_id);
  const canceledAt = requestedAt ?? nowIso();

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      status: "canceled",
      updated_at: nowIso(),
      source_payload: {
        ...(order.source_payload ?? {}),
        canceledReason: reason,
        canceledBy: requestedBy,
        canceledAt,
        driverCancelConfirmationRequired,
        driverCancelConfirmedAt: null
      }
    })
    .eq("id", order.id);
  if (updateError) throw updateError;

  await appendEvent(order.id as string, "website.order_canceled", {
    reason,
    requestedBy,
    requestedAt: canceledAt
  });


  if (assignment?.driver_id) {
    await sendPushToDriver(assignment.driver_id, {
      title: shouldPlayCancelSound ? "商家已取消訂單" : "",
      body: shouldPlayCancelSound ? (driverCancelConfirmationRequired ? "商家已取消訂單，請按確認取消。" : "商家已取消訂單。") : "",
      soundKey: shouldPlayCancelSound ? "order_cancelled" : undefined,
      data: {
        type: shouldPlayCancelSound ? "order_canceled" : "order_invalidated",
        externalOrderId,
        ...(shouldPlayCancelSound ? { playSound: "true" } : {}),
        requireCancelConfirm: driverCancelConfirmationRequired ? "true" : "false"
      }
    }).catch(() => undefined);
  } else {
    await sendPushToOnlineDrivers({
      title: shouldPlayCancelSound ? "商家已取消訂單" : "",
      body: shouldPlayCancelSound ? (driverCancelConfirmationRequired ? "商家已取消訂單，請按確認取消。" : "商家已取消訂單。") : "",
      soundKey: shouldPlayCancelSound ? "order_cancelled" : undefined,
      data: {
        type: shouldPlayCancelSound ? "order_canceled" : "order_invalidated",
        externalOrderId,
        ...(shouldPlayCancelSound ? { playSound: "true" } : {}),
        requireCancelConfirm: driverCancelConfirmationRequired ? "true" : "false"
      }
    }).catch(() => undefined);
  }

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

  const { data: assignment } = await supabase
    .from("order_assignments")
    .select("id,driver_id,accepted_at")
    .eq("order_id", order.id)
    .is("canceled_at", null)
    .order("assigned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const shouldPlayCancelSound = Boolean(assignment?.driver_id);
  const driverCancelConfirmationRequired = Boolean(assignment?.driver_id);

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
          canceledFrom: "backoffice",
          driverCancelConfirmationRequired,
          driverCancelConfirmedAt: null
        }
      })
      .eq("id", order.id);
    if (updateError) throw updateError;

    await appendEvent(order.id as string, "website.order_canceled", {
      reason,
      requestedBy,
      requestedAt: canceledAt
    });

    if (assignment?.driver_id) {
      void sendPushToDriver(assignment.driver_id, {
        title: shouldPlayCancelSound ? "商家已取消訂單" : "",
        body: shouldPlayCancelSound ? "商家已取消訂單，請按確認取消。" : "",
        soundKey: shouldPlayCancelSound ? "order_cancelled" : undefined,
        data: {
          type: shouldPlayCancelSound ? "order_canceled" : "order_invalidated",
          externalOrderId: order.external_order_id,
          ...(shouldPlayCancelSound ? { playSound: "true" } : {}),
          requireCancelConfirm: driverCancelConfirmationRequired ? "true" : "false"
        }
      }).catch(() => undefined);
    }

    void sendPushToOnlineDrivers({
      title: shouldPlayCancelSound ? "商家已取消訂單" : "",
      body: shouldPlayCancelSound ? "商家已取消訂單，請按確認取消。" : "",
      soundKey: shouldPlayCancelSound ? "order_cancelled" : undefined,
      data: {
        type: shouldPlayCancelSound ? "order_canceled" : "order_invalidated",
        externalOrderId: order.external_order_id,
        ...(shouldPlayCancelSound ? { playSound: "true" } : {}),
        requireCancelConfirm: driverCancelConfirmationRequired ? "true" : "false"
      }
    }).catch(() => undefined);
  }

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
      await sendPushToDriver(assignment.driver_id, {
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
    .or(`external_order_id.eq.${externalOrderId},transaction_code.eq.${externalOrderId}`)
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
      raiseReason: reason,
      playSound: "true"
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
    .or(`external_order_id.eq.${externalOrderId},transaction_code.eq.${externalOrderId}`)
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
    requestedAt: nowIso()
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

  const sourcePayload =
    order.source_payload && typeof order.source_payload === "object"
      ? (order.source_payload as Record<string, unknown>)
      : {};
  const customerSnapshot =
    sourcePayload.customerSnapshot && typeof sourcePayload.customerSnapshot === "object"
      ? (sourcePayload.customerSnapshot as Record<string, unknown>)
      : {};
  const deliveryFeePaidBy = normalizeDeliveryFeePaidBy(sourcePayload.deliveryFeePaidBy);
  const acceptanceLocation =
    sourcePayload.acceptanceLocation && typeof sourcePayload.acceptanceLocation === "object"
      ? (sourcePayload.acceptanceLocation as Record<string, unknown>)
      : null;
  const orderImages = Array.isArray(sourcePayload.images)
    ? (sourcePayload.images as Array<Record<string, unknown>>)
        .filter((item) => typeof item?.url === "string" && item.url.trim())
        .map((item) => ({
          url: String(item.url),
          label: typeof item.label === "string" ? item.label : null,
          mimeType: typeof item.mimeType === "string" ? item.mimeType : null
        }))
    : [];

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

  const latestProof = proofs?.[0] ?? null;
  const latestProofImageUrl = latestProof?.storage_path
    ? await buildSignedProofUrlForOrderStatus(latestProof.storage_path)
    : null;

  return {
    siteBOrderId: order.id,
    externalOrderId: order.external_order_id,
    status: order.status,
    deliveryFeeMop: Number(order.assigned_fee_mop ?? 0),
    deliveryFeePaidBy,
    urgent: Boolean(sourcePayload.urgent),
    promisedAt: order.promised_at,
    createdAt: order.created_at,
    shop,
    customer: {
      name: typeof customerSnapshot.name === "string" ? customerSnapshot.name : customer?.name ?? null,
      phone: typeof customerSnapshot.phone === "string" ? customerSnapshot.phone : customer?.phone ?? null,
      address: typeof customerSnapshot.address === "string" ? customerSnapshot.address : customer?.address ?? null,
      latitude: typeof customerSnapshot.latitude === "number" ? customerSnapshot.latitude : null,
      longitude: typeof customerSnapshot.longitude === "number" ? customerSnapshot.longitude : null,
      deliveryNote: typeof customerSnapshot.deliveryNote === "string" ? customerSnapshot.deliveryNote : null,
      isAnonymous: Boolean(customerSnapshot.isAnonymous),
      addressProvided: Boolean(customerSnapshot.addressProvided),
      contactProvided: Boolean(customerSnapshot.contactProvided)
    },
    driver: driver
      ? {
          fullName: driver.full_name,
          phone: driver.phone
        }
      : null,
    acceptanceLocation: acceptanceLocation
      ? {
          latitude: typeof acceptanceLocation.latitude === "number" ? acceptanceLocation.latitude : null,
          longitude: typeof acceptanceLocation.longitude === "number" ? acceptanceLocation.longitude : null,
          capturedAt: typeof acceptanceLocation.capturedAt === "string" ? acceptanceLocation.capturedAt : null,
          source: typeof acceptanceLocation.source === "string" ? acceptanceLocation.source : null
        }
      : null,
    images: orderImages,
    assignment,
    proof: latestProof
      ? {
          imageUrl: latestProofImageUrl,
          storagePath: latestProof.storage_path ?? null,
          uploadedAt: latestProof.created_at ?? null
        }
      : null
  };
}
