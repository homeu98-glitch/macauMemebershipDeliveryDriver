"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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

function buildGoogleNavUrl(label: string, address: string, lat: number, lng: number) {
  if (lat && lng) return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${label} ${address}`)}`;
}

function statusText(status: string) {
  switch (status) {
    case "assigned":
    case "accepted":
    case "heading_to_shop":
      return "前往商戶中";
    case "picked_up":
    case "arrived_customer":
      return "配送中";
    case "canceled":
      return "訂單已取消";
    default:
      return status;
  }
}

function statusHint(status: string) {
  switch (status) {
    case "assigned":
    case "accepted":
    case "heading_to_shop":
      return "請先到商戶取貨。";
    case "picked_up":
    case "arrived_customer":
      return "請盡快送達客戶。";
    case "canceled":
      return "此訂單已取消配送。";
    default:
      return "請按訂單狀態繼續處理。";
  }
}

export function DriverOrdersClient() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const response = await fetch("/api/driver/orders/active", { cache: "no-store" });
      if (!response.ok) throw new Error("active_failed");
      setOrders(((await response.json()) as { orders: OrderSummary[] }).orders);
      setError(null);
    } catch {
      setError("載入進行中訂單失敗。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 15000);
    return () => window.clearInterval(timer);
  }, []);

  if (loading) return <div className="android-card">載入進行中訂單...</div>;
  if (error) return <div className="android-card error">{error}</div>;

  return (
    <div className="stack gap-3">
      <div className="driver-inline-between">
        <div className="stack gap-1">
          <div className="driver-screen-title">訂單</div>
          <div className="muted">進行中的配送訂單</div>
        </div>
        <button className="android-secondary-btn small" onClick={load} type="button">刷新</button>
      </div>

      {orders.length === 0 ? (
        <div className="android-card muted">目前沒有進行中訂單。</div>
      ) : (
        orders.map((order) => (
          <article className="android-card active-order-card stack gap-3" key={order.id}>
            <div className={order.status === "canceled" ? "stage-strip canceled" : "stage-strip"}>{statusText(order.status)}</div>

            <div className="driver-inline-between align-start">
              <div className="stack gap-1 grow minw-0">
                <strong className="driver-order-title compact tight">{order.storeName}</strong>
                <div className="order-subvalue tight">交易編號 {order.transactionCode ?? order.externalOrderId}</div>
                <div className="order-subvalue tight">送達時間 {order.deliveryDeadlineText}</div>
                <div className="order-subvalue tight">已派送 {order.totalSentOrders} 單</div>
              </div>
              <div className="money-chip large compact">MOP {order.amountMop.toFixed(1)}</div>
            </div>

            <div className="android-soft-panel order-address-panel compact stack gap-2">
              <div className="location-row-web">
                <div className="grow minw-0">
                  <div className="driver-soft-label">商戶</div>
                  <div className="location-title">{order.storeName}</div>
                  <div className="address-text compact">{order.storeAddress}</div>
                </div>
                <a className="location-action-btn" href={buildGoogleNavUrl(order.storeName, order.storeAddress, order.storeLatitude, order.storeLongitude)} rel="noreferrer" target="_blank">導航</a>
              </div>
              <div className="location-row-web">
                <div className="grow minw-0">
                  <div className="driver-soft-label">客戶</div>
                  <div className="location-title">{order.customerName}</div>
                  <div className="address-text compact">{order.customerAddress}</div>
                </div>
                <a className="location-action-btn" href={buildGoogleNavUrl(order.customerName, order.customerAddress, order.customerLatitude, order.customerLongitude)} rel="noreferrer" target="_blank">導航</a>
              </div>
            </div>

            <div className="inline-meta-pills compact">
              <span className="meta-pill green">{order.paymentTag}</span>
              <span className="meta-pill">取貨區：{order.pickupDistrict ?? "未分區"}</span>
              <span className="meta-pill">送達區：{order.destinationDistrict ?? "未分區"}</span>
            </div>

            <div className="order-bottom-meta compact">{statusHint(order.status)}</div>

            <div className="driver-auth-actions-row driver-actions-3col">
              <a className="android-outline-link no-underline" href={buildGoogleNavUrl(order.storeName, order.storeAddress, order.storeLatitude, order.storeLongitude)} rel="noreferrer" target="_blank">前往商戶</a>
              <a className="android-outline-link no-underline" href={buildGoogleNavUrl(order.customerName, order.customerAddress, order.customerLatitude, order.customerLongitude)} rel="noreferrer" target="_blank">前往客戶</a>
              <Link className="android-primary-btn small no-underline" href={`/driver/orders/${order.id}`}>打開訂單</Link>
            </div>
          </article>
        ))
      )}
    </div>
  );
}
