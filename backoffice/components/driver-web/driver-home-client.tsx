"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type OrderSummary = {
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
  const [pickupDistricts, setPickupDistricts] = useState<string[]>([]);
  const [destinationDistricts, setDestinationDistricts] = useState<string[]>([]);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [navOrder, setNavOrder] = useState<OrderSummary | null>(null);
  const [filterModal, setFilterModal] = useState<FilterModalType>(null);
  const [notificationCheck, setNotificationCheck] = useState<NotificationCheck>({ permission: typeof Notification === "undefined" ? "unsupported" : Notification.permission, subscribed: false, vapidConfigured: false });
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const previousOrderIdsRef = useRef<string[]>([]);

  async function load() {
    try {
      const response = await fetch("/api/driver/dashboard", { cache: "no-store" });
      if (!response.ok) throw new Error("dashboard_failed");
      setData((await response.json()) as Dashboard);
      setError(null);
    } catch {
      setError("載入首頁資料失敗。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 15000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (position) => setDriverLocation({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => undefined,
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 120000 }
    );
  }, []);

  useEffect(() => {
    const unlockAudio = async () => {
      if (audioContextRef.current) {
        await audioContextRef.current.resume().catch(() => undefined);
        setAudioUnlocked(true);
        return;
      }
      const AudioCtx = window.AudioContext || (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;
      await ctx.resume().catch(() => undefined);
      setAudioUnlocked(true);
    };

    window.addEventListener("pointerdown", unlockAudio, { once: true });
    return () => window.removeEventListener("pointerdown", unlockAudio);
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
    const currentIds = data.availableOrders.map((item) => item.id);
    const previousIds = previousOrderIdsRef.current;
    if (previousIds.length > 0) {
      const newOrders = data.availableOrders.filter((item) => !previousIds.includes(item.id));
      if (newOrders.length > 0) {
        const firstNew = newOrders[0];
        if (audioContextRef.current && audioUnlocked) {
          const now = audioContextRef.current.currentTime;
          const toneA = audioContextRef.current.createOscillator();
          const gainA = audioContextRef.current.createGain();
          toneA.type = "sine";
          toneA.frequency.setValueAtTime(880, now);
          gainA.gain.setValueAtTime(0.0001, now);
          gainA.gain.exponentialRampToValueAtTime(0.14, now + 0.02);
          gainA.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
          toneA.connect(gainA).connect(audioContextRef.current.destination);
          toneA.start(now);
          toneA.stop(now + 0.22);

          const toneB = audioContextRef.current.createOscillator();
          const gainB = audioContextRef.current.createGain();
          toneB.type = "sine";
          toneB.frequency.setValueAtTime(988, now + 0.25);
          gainB.gain.setValueAtTime(0.0001, now + 0.25);
          gainB.gain.exponentialRampToValueAtTime(0.18, now + 0.27);
          gainB.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
          toneB.connect(gainB).connect(audioContextRef.current.destination);
          toneB.start(now + 0.25);
          toneB.stop(now + 0.5);
        }

        if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.visibilityState === "visible") {
          new Notification("會員配送車手", { body: `${firstNew.storeName} 有新的可接訂單` });
        }
      }
    }
    previousOrderIdsRef.current = currentIds;
  }, [audioUnlocked, data]);

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
      await load();
    } catch {
      setData((current) => (current ? { ...current, availability: previous } : current));
      window.alert("更新上下線狀態失敗。");
    } finally {
      setBusy(false);
    }
  }

  async function acceptOrder(orderId: string) {
    try {
      const response = await fetch(`/api/driver/orders/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "accepted" })
      });
      if (!response.ok) throw new Error("accept_failed");
      window.location.href = `/driver/orders/${orderId}`;
    } catch {
      window.alert("接單失敗，請稍後再試。");
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
          <div className="android-card muted">目前沒有可接訂單</div>
        ) : (
          filteredOrders.map((order) => {
            const distanceLabel = formatDistanceKmFromCurrent(driverLocation, order) ?? "--";
            return (
              <article className="android-card order-card-android stack gap-3 order-gap-5" key={order.id}>
                <div className="driver-inline-between align-start">
                  <div className="stack gap-1 grow minw-0">
                    <strong className="driver-order-title compact tight">{order.storeName}</strong>
                    <div className="order-subvalue tight">交易編號 {order.transactionCode ?? order.externalOrderId}</div>
                    <div className="order-subvalue tight">已派送 {order.totalSentOrders} 單</div>
                    <div className="order-subvalue tight">送達時間 {order.deliveryDeadlineText}</div>
                    <div className="order-subvalue tight">發單日期 {order.publishedAt}</div>
                  </div>
                  <div className={order.isUrgent ? "money-chip urgent large compact" : "money-chip large compact"}>MOP {order.amountMop.toFixed(1)}</div>
                </div>

                <div className="android-soft-panel order-address-panel compact">
                  <div className="driver-soft-label">商戶地址</div>
                  <div className="address-text compact">{order.storeAddress}</div>
                  <div className="driver-soft-label">客戶地址</div>
                  <div className="address-text compact">{order.customerAddress}</div>
                </div>

                <div className="inline-meta-pills compact">
                  <span className="meta-pill green">{order.paymentTag}</span>
                  <span className="meta-pill">取貨區：{order.pickupDistrict ?? "-"}</span>
                  <span className="meta-pill">送達區：{order.destinationDistrict ?? "-"}</span>
                </div>

                <div className="order-bottom-meta compact">{distanceLabel} · {order.deliveryDeadlineText.replace(/.*\s/, "") || order.promisedAt || "--"}</div>

                <div className="driver-inline-between action-buttons-row compact-row">
                  <button className="android-outline-link as-button nav-btn-large compact" onClick={() => setNavOrder(order)} type="button">前往商戶</button>
                  <button className="android-primary-btn order-accept-btn compact" onClick={() => acceptOrder(order.id)} type="button">{data.availability === "online" ? "接單" : "請先上線"}</button>
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
    </>
  );
}
