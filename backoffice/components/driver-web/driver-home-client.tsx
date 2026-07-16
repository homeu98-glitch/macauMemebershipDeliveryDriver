"use client";

import Link from "next/link";

import { DriverChatIconButton, DriverOrderChatModal, type OrderChatMeta, useDriverChatUnreadMap } from "@/components/driver-web/driver-chat";
import { PhotoViewerModal } from "@/components/driver-web/photo-viewer-modal";

import { captureDriverLocationPayload, reportDriverLocationOnce } from "@/components/driver-web/driver-location-client";
import { useEffect, useMemo, useRef, useState } from "react";

type OrderSummary = {
  orderImages: Array<{ url: string; label: string | null; mimeType: string | null }>;
  customerAddressProvided: boolean;
  customerContactProvided: boolean;
  chat: OrderChatMeta;
  id: string;
  externalOrderId: string;
  transactionCode: string | null;
  status: string;
  storeName: string;
  storeAddress: string;
  pickupDistrict: string | null;
  storeLatitude: number;
  storeLongitude: number;
  totalSentOrders: number;
  customerName: string;
  customerAddress: string;
  destinationDistrict: string | null;
  customerLatitude: number;
  customerLongitude: number;
  amountMop: number;
  createdAt: string;
  publishedAt: string;
  promisedAt: string | null;
  deliveryDeadlineText: string;
  etaMinutes: number;
  isUrgent: boolean;
  paymentTag: string;
};

type Dashboard = {
  todayEarningsMop: number;
  weekEarningsMop: number;
  completedToday: number;
  availability: string;
  approvalStatus: string;
  availableOrders: OrderSummary[];
  pickupDistrictOptions: string[];
  destinationDistrictOptions: string[];
};

type FilterModalType = "pickup" | "destination" | null;

type NotificationCheck = {
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
  vapidConfigured: boolean;
};

function haversineKm(startLat: number, startLng: number, endLat: number, endLng: number) {
  if (!startLat || !startLng || !endLat || !endLng) return null;
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

function formatDistanceKmFromCurrent(current: { lat: number; lng: number } | null, order: OrderSummary) {
  if (!current) return null;
  const km = haversineKm(current.lat, current.lng, order.storeLatitude, order.storeLongitude);
  return km ? `${km.toFixed(1)} 公里到商戶` : null;
}

function buildGoogleNavUrl(order: OrderSummary) {
  if (order.storeLatitude && order.storeLongitude) {
    return `https://www.google.com/maps/dir/?api=1&destination=${order.storeLatitude},${order.storeLongitude}&travelmode=driving`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.storeAddress)}`;
}

function buildAmapNavUrl(order: OrderSummary) {
  if (order.storeLongitude && order.storeLatitude) {
    return `https://uri.amap.com/navigation?to=${order.storeLongitude},${order.storeLatitude},${encodeURIComponent(order.storeName)}&mode=car&src=membershipdeliverydriver`;
  }
  return `https://uri.amap.com/search?keyword=${encodeURIComponent(order.storeAddress)}`;
}

function formatFilterValue(values: string[]) {
  if (values.length === 0) return "全部";
  if (values.length === 1) return values[0];
  return `已選 ${values.length} 項`;
}

export function DriverHomeClient() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [acceptingOrderId, setAcceptingOrderId] = useState<string | null>(null);
  const [pickupDistricts, setPickupDistricts] = useState<string[]>([]);
  const [destinationDistricts, setDestinationDistricts] = useState<string[]>([]);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [navOrder, setNavOrder] = useState<OrderSummary | null>(null);
  const [filterModal, setFilterModal] = useState<FilterModalType>(null);
  const [photoModal, setPhotoModal] = useState<{ images: OrderSummary["orderImages"]; index: number } | null>(null);
  const [chatOrder, setChatOrder] = useState<OrderSummary | null>(null);
  const [notificationCheck, setNotificationCheck] = useState<NotificationCheck>({ permission: typeof Notification === "undefined" ? "unsupported" : Notification.permission, subscribed: false, vapidConfigured: false });
  const previousOrderStateRef = useRef<Record<string, boolean>>({});
  const hasSeenDashboardRef = useRef(false);
  const dashboardTimerRef = useRef<number | null>(null);
  const pendingDashboardReloadRef = useRef<number | null>(null);
  const dashboardLoadingRef = useRef(false);
  const dashboardLastLoadedAtRef = useRef(0);

  async function load(force = false) {
    if (!force && document.visibilityState === "hidden") return;
    if (dashboardLoadingRef.current) return;
    dashboardLoadingRef.current = true;
    try {
      const response = await fetch("/api/driver/dashboard", { cache: "no-store" });
      if (!response.ok) throw new Error("dashboard_failed");
      setData((await response.json()) as Dashboard);
      setError(null);
      dashboardLastLoadedAtRef.current = Date.now();
    } catch {
      setError("載入首頁資料失敗。");
    } finally {
      dashboardLoadingRef.current = false;
      setLoading(false);
    }
  }

  useEffect(() => {
    function clearDashboardTimer() {
      if (dashboardTimerRef.current !== null) {
        window.clearInterval(dashboardTimerRef.current);
        dashboardTimerRef.current = null;
      }
    }

    function clearPendingReload() {
      if (pendingDashboardReloadRef.current !== null) {
        window.clearTimeout(pendingDashboardReloadRef.current);
        pendingDashboardReloadRef.current = null;
      }
    }

    function startDashboardTimer() {
      clearDashboardTimer();
      if (document.visibilityState === "hidden") return;
      dashboardTimerRef.current = window.setInterval(() => {
        void load();
      }, 10000);
    }

    function scheduleReload(delay = 250, force = false) {
      if (!force && document.visibilityState === "hidden") return;
      clearPendingReload();
      const elapsed = Date.now() - dashboardLastLoadedAtRef.current;
      const throttledDelay = elapsed < 1200 ? Math.max(delay, 1200 - elapsed) : delay;
      pendingDashboardReloadRef.current = window.setTimeout(() => {
        pendingDashboardReloadRef.current = null;
        void load(force);
      }, throttledDelay);
    }

    void load(true);
    startDashboardTimer();

    const onDispatch = () => {
      scheduleReload(250);
    };
    const onFocus = () => {
      if (document.visibilityState === "visible") {
        scheduleReload(120, true);
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        startDashboardTimer();
        scheduleReload(120, true);
      } else {
        clearDashboardTimer();
      }
    };

    window.addEventListener("driver_dispatch_event", onDispatch);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearDashboardTimer();
      clearPendingReload();
      window.removeEventListener("driver_dispatch_event", onDispatch);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;

    let stopped = false;

    async function syncLocation() {
      const position = await new Promise<GeolocationPosition | null>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (nextPosition) => resolve(nextPosition),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 6000, maximumAge: 120000 }
        );
      });

      if (!position || stopped) return;
      setDriverLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
      await reportDriverLocationOnce();
    }

    void syncLocation();
    const timer = window.setInterval(() => { void syncLocation(); }, 30000);
    const onFocus = () => { void syncLocation(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  useEffect(() => {
    fetch("/api/driver/notifications/config", { cache: "no-store" })
      .then((res) => res.json())
      .then(async (payload) => {
        let subscribed = false;
        if ("serviceWorker" in navigator) {
          const reg = await navigator.serviceWorker.register("/driver-sw.js");
          subscribed = Boolean(await reg.pushManager.getSubscription());
        }
        setNotificationCheck({
          permission: typeof Notification === "undefined" ? "unsupported" : Notification.permission,
          subscribed,
          vapidConfigured: Boolean((payload as { vapidPublicKeyConfigured?: boolean }).vapidPublicKeyConfigured)
        });
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!data) return;
    const previousState = previousOrderStateRef.current;
    const currentState = Object.fromEntries(data.availableOrders.map((item) => [item.id, item.isUrgent]));

    if (hasSeenDashboardRef.current) {
      const urgentTransitions = data.availableOrders.filter((item) => previousState[item.id] === false && item.isUrgent);
      const newOrders = data.availableOrders.filter((item) => !(item.id in previousState));
      const notificationOrder = urgentTransitions[0] ?? newOrders[0] ?? null;
      if (notificationOrder) {
        const soundKey = notificationOrder.isUrgent ? "urgent_order" : "new_order";
        const notificationBody = urgentTransitions.length > 0
          ? `${notificationOrder.storeName} 已加價為急單，請立即查看。`
          : `${notificationOrder.storeName} 有新的可接訂單`;
        try {
          window.dispatchEvent(new CustomEvent("driver_play_sound", { detail: { soundKey } }));
        } catch {
          // ignore sound fallback errors
        }
        if (typeof Notification !== "undefined" && Notification.permission === "granted" && "serviceWorker" in navigator) {
          navigator.serviceWorker.ready
            .then((registration) =>
              registration.showNotification("會員配送車手", {
                body: notificationBody,
                icon: "/icons/driver-app-logo-v3-192.png",
                badge: "/icons/driver-app-logo-v3-192.png",
                data: { url: "/driver/home", soundKey },
                tag: urgentTransitions.length > 0 ? `foreground-urgent-${notificationOrder.id}` : `foreground-${notificationOrder.id}`
              })
            )
            .catch(() => undefined);
        }
      }
    }

    previousOrderStateRef.current = currentState;
    hasSeenDashboardRef.current = true;
  }, [data]);

  async function toggleAvailability() {
    if (!data || busy) return;
    const previous = data.availability;
    const next = previous === "online" ? "offline" : "online";
    setBusy(true);
    setData((current) => (current ? { ...current, availability: next } : current));
    try {
      const response = await fetch("/api/driver/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availability: next })
      });
      if (!response.ok) throw new Error("availability_failed");
      await reportDriverLocationOnce();
      await load();
    } catch {
      setData((current) => (current ? { ...current, availability: previous } : current));
      window.alert("更新上下線狀態失敗。");
    } finally {
      setBusy(false);
    }
  }

  async function acceptOrder(orderId: string) {
    if (acceptingOrderId) return;
    setAcceptingOrderId(orderId);
    try {
      const location = await captureDriverLocationPayload();
      const response = await fetch(`/api/driver/orders/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventType: "accepted", ...(location ? { location } : {}) })
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        window.alert(payload.message ?? "接單失敗，請稍後再試。");
        return;
      }
      await reportDriverLocationOnce();
      await load();
    } catch {
      window.alert("接單失敗，請稍後再試。");
    } finally {
      setAcceptingOrderId(null);
    }
  }

  function toggleFilterValue(type: Exclude<FilterModalType, null>, value: string) {
    const setter = type === "pickup" ? setPickupDistricts : setDestinationDistricts;
    setter((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));
  }

  function clearFilter(type: Exclude<FilterModalType, null>) {
    if (type === "pickup") setPickupDistricts([]);
    else setDestinationDistricts([]);
  }

  const filteredOrders = useMemo(() => {
    if (!data) return [] as OrderSummary[];
    return data.availableOrders.filter((order) => {
      const pickupOk = pickupDistricts.length === 0 || (order.pickupDistrict ? pickupDistricts.includes(order.pickupDistrict) : false);
      const destinationOk = destinationDistricts.length === 0 || (order.destinationDistrict ? destinationDistricts.includes(order.destinationDistrict) : false);
      return pickupOk && destinationOk;
    });
  }, [data, pickupDistricts, destinationDistricts]);

  const filterOptions = filterModal === "pickup" ? data?.pickupDistrictOptions ?? [] : data?.destinationDistrictOptions ?? [];
  const selectedOptions = filterModal === "pickup" ? pickupDistricts : destinationDistricts;
  const chatUnread = useDriverChatUnreadMap(filteredOrders.map((order) => ({ id: order.id, chat: order.chat })));

  function openChat(order: OrderSummary) {
    setChatOrder(order);
    chatUnread.markRead(order.id, order.chat);
  }

  if (loading) return <div className="android-card">首頁載入中...</div>;
  if (error) return <div className="android-card error">{error}</div>;
  if (!data) return <div className="android-card">沒有可用資料。</div>;

  return (
    <>
      <div className="stack gap-4 driver-home-page">
        {(notificationCheck.permission !== "granted" || !notificationCheck.subscribed || !notificationCheck.vapidConfigured) ? (
          <section className="driver-notice-banner">
            <div className="stack gap-1 grow">
              <div className="install-banner-title">推送提醒未完全開啟</div>
              <div className="install-banner-copy">
                {notificationCheck.permission !== "granted"
                  ? "目前還沒開通知權限。"
                  : !notificationCheck.vapidConfigured
                    ? "Web Push 公鑰尚未配置。"
                    : "此裝置尚未註冊推送。"}
              </div>
            </div>
            <Link className="install-banner-btn link-btn" href="/driver/notifications">去開啟</Link>
          </section>
        ) : null}

        <section className="android-status-panel">
          <div className="stack gap-1 grow">
            <div className="status-panel-title">{data.availability === "online" ? "上線" : "離線"}</div>
            <div className="status-panel-note">{busy ? "更新中..." : data.availability === "online" ? "保持上線即可即時看到新工單。" : "切換上線後才可以開始接單。"}</div>
          </div>
          <label className={busy ? "driver-switch-wrap busy" : "driver-switch-wrap"}>
            <input type="checkbox" checked={data.availability === "online"} onChange={toggleAvailability} disabled={busy} />
            <span className="driver-switch-slider" />
          </label>
        </section>

        <section className="stack gap-2">
          <div className="driver-inline-between section-heading-row">
            <div className="stack gap-1">
              <div className="driver-screen-title small">可接訂單</div>
              <div className="muted small-copy">向下拉即可即時刷新</div>
            </div>
            <div className="driver-count-chip">{filteredOrders.length} 張</div>
          </div>

          <div className="driver-filter-row compact">
            <button className="filter-select-card compact" onClick={() => setFilterModal("pickup")} type="button">
              <span className="filter-label">取貨地區</span>
              <span className="filter-value">{formatFilterValue(pickupDistricts)}</span>
            </button>
            <button className="filter-select-card compact" onClick={() => setFilterModal("destination")} type="button">
              <span className="filter-label">送達地區</span>
              <span className="filter-value">{formatFilterValue(destinationDistricts)}</span>
            </button>
          </div>
        </section>

        {filteredOrders.length === 0 ? (
          <div className="android-card muted home-empty-orders">目前沒有可接訂單</div>
        ) : (
          filteredOrders.map((order) => {
            const distanceLabel = formatDistanceKmFromCurrent(driverLocation, order) ?? "--";
            return (
              <article className="android-card order-card-android home-order-card stack gap-3" key={order.id}>
                <div className="driver-inline-between align-start">
                  <div className="stack gap-1 grow minw-0">
                    {order.isUrgent ? <div className="urgent-text">急單</div> : null}
                    <strong className="driver-order-title compact tight">{order.storeName}</strong>
                    <div className="order-subvalue tight">交易編號 {order.transactionCode ?? order.externalOrderId}</div>
                    <div className="order-subvalue tight">已派送 {order.totalSentOrders} 單</div>
                    <div className="order-subvalue tight">送達時間 {order.deliveryDeadlineText}</div>
                    <div className="order-subvalue tight">發單日期 {order.publishedAt}</div>
                  </div>
                  <div className="stack gap-2 align-end">
                    <div className={order.isUrgent ? "money-chip urgent large compact" : "money-chip large compact"}>MOP {order.amountMop.toFixed(1)}</div>
                    {order.chat?.enabled && order.chat.messagesUrl ? <DriverChatIconButton className="driver-chat-icon-under-price" hasUnread={chatUnread.hasUnread(order.id)} onClick={() => openChat(order)} /> : null}
                  </div>
                </div>

                <div className="android-soft-panel order-address-panel compact">
                  <div className="driver-soft-label">商戶地址</div>
                  <div className="address-text compact">{order.storeAddress}</div>
                  <div className="driver-soft-label">客戶地址</div>
                  <div className="address-text compact">{order.customerAddress}</div>
                  {!order.customerAddressProvided ? <div className="order-subvalue tight">此單未提供文字地址，請打開圖片查看。</div> : null}
                </div>

                {order.orderImages.length ? (
                  <div className="android-soft-panel compact stack gap-2">
                    <div className="driver-soft-label">訂單圖片</div>
                    <button className="photo-preview-btn" onClick={() => setPhotoModal({ images: order.orderImages, index: 0 })} type="button">
                      <img alt={order.orderImages[0]?.label ?? "order image"} className="driver-proof-preview" src={order.orderImages[0]?.url} />
                    </button>
                  </div>
                ) : null}

                <div className="inline-meta-pills compact">
                  <span className="meta-pill green">{order.paymentTag}</span>
                  <span className="meta-pill">取貨區：{order.pickupDistrict ?? "-"}</span>
                  <span className="meta-pill">送達區：{order.destinationDistrict ?? "-"}</span>
                </div>

                <div className="order-bottom-meta compact">{distanceLabel} · {order.deliveryDeadlineText.replace(/.*\s/, "") || order.promisedAt || "--"}</div>

                <div className="driver-inline-between action-buttons-row compact-row">
                  <button className="android-outline-link as-button nav-btn-large compact" onClick={() => setNavOrder(order)} type="button">前往商戶</button>
                  <button
                    className={acceptingOrderId === order.id ? "android-primary-btn order-accept-btn compact loading" : "android-primary-btn order-accept-btn compact"}
                    disabled={acceptingOrderId !== null || data.availability !== "online"}
                    onClick={() => acceptOrder(order.id)}
                    type="button"
                  >
                    {acceptingOrderId === order.id ? <span className="btn-spinner" aria-hidden="true" /> : null}
                    {acceptingOrderId === order.id ? "接單中..." : data.availability === "online" ? "接單" : "請先上線"}
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>

      {filterModal ? (
        <div className="driver-modal-backdrop" onClick={() => setFilterModal(null)}>
          <div className="driver-modal-card stack gap-3" onClick={(event) => event.stopPropagation()}>
            <div className="driver-screen-title small">{filterModal === "pickup" ? "取貨地區" : "送達地區"}</div>
            <div className="filter-modal-list compact-list">
              {filterOptions.map((item) => (
                <label className="filter-check-row compact" key={item}>
                  <input type="checkbox" checked={selectedOptions.includes(item)} onChange={() => toggleFilterValue(filterModal, item)} />
                  <span>{item}</span>
                </label>
              ))}
            </div>
            <div className="driver-auth-actions-row single-mobile-row">
              <button className="android-secondary-btn" onClick={() => clearFilter(filterModal)} type="button">清除</button>
              <button className="android-primary-btn" onClick={() => setFilterModal(null)} type="button">完成</button>
            </div>
          </div>
        </div>
      ) : null}

      {navOrder ? (
        <div className="driver-modal-backdrop" onClick={() => setNavOrder(null)}>
          <div className="driver-modal-card stack gap-3" onClick={(event) => event.stopPropagation()}>
            <div className="driver-screen-title small">選擇導航</div>
            <a className="android-secondary-btn no-underline" href={buildGoogleNavUrl(navOrder)} rel="noreferrer" target="_blank">Google 地圖</a>
            <a className="android-secondary-btn no-underline" href={buildAmapNavUrl(navOrder)} rel="noreferrer" target="_blank">高德地圖</a>
            <button className="android-danger-btn" onClick={() => setNavOrder(null)} type="button">取消</button>
          </div>
        </div>
      ) : null}

      {photoModal ? (
        <PhotoViewerModal images={photoModal.images} initialIndex={photoModal.index} onClose={() => setPhotoModal(null)} />
      ) : null}

      {chatOrder ? (
        <DriverOrderChatModal
          orderId={chatOrder.id}
          orderLabel={chatOrder.transactionCode ?? chatOrder.externalOrderId}
          chat={chatOrder.chat}
          onClose={() => setChatOrder(null)}
          onRead={(latestMessageAt) => chatUnread.markRead(chatOrder.id, chatOrder.chat, latestMessageAt)}
        />
      ) : null}

    </>
  );
}
