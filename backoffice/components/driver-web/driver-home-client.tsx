"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { formatDistanceKmFromCurrent } from "@/lib/driver-web-data";

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

export function DriverHomeClient() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pickupDistrict, setPickupDistrict] = useState("");
  const [destinationDistrict, setDestinationDistrict] = useState("");
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [navOrder, setNavOrder] = useState<OrderSummary | null>(null);

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

  async function toggleAvailability() {
    if (!data) return;
    setBusy(true);
    try {
      const next = data.availability === "online" ? "offline" : "online";
      const response = await fetch("/api/driver/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availability: next })
      });
      if (!response.ok) throw new Error("availability_failed");
      await load();
    } catch {
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

  const filteredOrders = useMemo(() => {
    if (!data) return [] as OrderSummary[];
    return data.availableOrders.filter((order) => {
      const pickupOk = !pickupDistrict || order.pickupDistrict === pickupDistrict;
      const destinationOk = !destinationDistrict || order.destinationDistrict === destinationDistrict;
      return pickupOk && destinationOk;
    });
  }, [data, pickupDistrict, destinationDistrict]);

  if (loading) return <div className="android-card">首頁載入中...</div>;
  if (error) return <div className="android-card error">{error}</div>;
  if (!data) return <div className="android-card">沒有可用資料。</div>;

  return (
    <>
      <div className="stack gap-4">
        <section className="android-status-panel">
          <div className="stack gap-1 grow">
            <div className="status-panel-title">接單狀態</div>
            <div className="status-panel-value">{data.availability === "online" ? "上線中" : "離線中"}</div>
            <div className="status-panel-note">{data.availability === "online" ? "保持上線即可即時看到新工單。" : "切換上線後才可以開始接單。"}</div>
          </div>
          <label className="driver-switch-wrap">
            <input type="checkbox" checked={data.availability === "online"} onChange={toggleAvailability} disabled={busy} />
            <span className="driver-switch-slider" />
          </label>
        </section>

        <section className="driver-filter-panel stack gap-3">
          <div className="driver-screen-title small">可接訂單</div>
          <div className="driver-filter-grid">
            <label className="driver-field compact-field">
              <span>取貨地區</span>
              <select value={pickupDistrict} onChange={(event) => setPickupDistrict(event.target.value)}>
                <option value="">全部</option>
                {data.pickupDistrictOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="driver-field compact-field">
              <span>送達地區</span>
              <select value={destinationDistrict} onChange={(event) => setDestinationDistrict(event.target.value)}>
                <option value="">全部</option>
                {data.destinationDistrictOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
          </div>
        </section>

        {filteredOrders.length === 0 ? (
          <div className="android-card muted">目前沒有可接訂單</div>
        ) : (
          filteredOrders.map((order) => {
            const distanceLabel = formatDistanceKmFromCurrent(driverLocation, order) ?? "--";
            return (
              <article className="android-card driver-order-card stack gap-4" key={order.id}>
                <div className="driver-inline-between align-start card-top-gap">
                  <div className="stack gap-1 grow">
                    {order.isUrgent ? <div className="urgent-text">急單</div> : null}
                    <strong className="driver-order-title">{order.storeName}</strong>
                    <div className="muted">{order.totalSentOrders} 單</div>
                  </div>
                  <div className={order.isUrgent ? "money-chip urgent" : "money-chip"}>MOP {order.amountMop.toFixed(1)}</div>
                </div>

                <section className="driver-order-meta-grid">
                  <div><span className="meta-label">發單日期</span><span className="meta-value">{order.publishedAt}</span></div>
                  <div><span className="meta-label">支付方式</span><span className="meta-value">{order.paymentTag}</span></div>
                  <div><span className="meta-label">取貨地區</span><span className="meta-value">{order.pickupDistrict ?? "-"}</span></div>
                  <div><span className="meta-label">送達地區</span><span className="meta-value">{order.destinationDistrict ?? "-"}</span></div>
                  <div><span className="meta-label">距離</span><span className="meta-value">{distanceLabel}</span></div>
                  <div><span className="meta-label">時間</span><span className="meta-value">{order.deliveryDeadlineText}</span></div>
                </section>

                <div className="android-soft-panel stack gap-2">
                  <div>
                    <div className="driver-soft-label">商戶地址</div>
                    <div>{order.storeAddress}</div>
                  </div>
                  <div>
                    <div className="driver-soft-label">客戶地址</div>
                    <div>{order.customerAddress}</div>
                  </div>
                  <div className="muted">交易編號 {order.transactionCode ?? order.externalOrderId}</div>
                </div>

                <div className="driver-inline-between mobile-actions-row order-actions-gap">
                  <button className="android-outline-link as-button" onClick={() => setNavOrder(order)} type="button">前往商戶</button>
                  <button className="android-primary-btn small" onClick={() => acceptOrder(order.id)} type="button">{data.availability === "online" ? "接單" : "請先上線"}</button>
                </div>
              </article>
            );
          })
        )}
      </div>

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
