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
  isUrgent: boolean;
  paymentTag: string;
};

function buildGoogleNavUrl(label: string, address: string, lat: number, lng: number) {
  if (lat && lng) return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${label} ${address}`)}`;
}

function dialHref(phone: string | null) {
  return phone ? `tel:${phone}` : undefined;
}

function StageStrip({ status }: { status: string }) {
  const stages = ["前往商戶", "已取貨", "前往客戶"];
  const activeIndex = status === "picked_up" || status === "arrived_customer" ? 2 : status === "accepted" || status === "assigned" || status === "heading_to_shop" ? 1 : 0;
  return (
    <div className="order-stage-strip-web">
      {stages.map((label, index) => {
        const current = index === activeIndex;
        const done = index < activeIndex;
        return (
          <div className={current ? "order-stage-chip current" : done ? "order-stage-chip done" : "order-stage-chip"} key={label}>{label}</div>
        );
      })}
    </div>
  );
}

function IconButtonLink({ href, label, type, disabled = false }: { href?: string; label: string; type: "call" | "nav"; disabled?: boolean }) {
  const content = (
    <>
      {type === "call" ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6.6 10.8a15.5 15.5 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.24c1.08.36 2.22.54 3.4.54a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C11.85 21 3 12.15 3 1a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.18.18 2.32.54 3.4a1 1 0 0 1-.24 1l-2.2 2.4Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.8"/></svg>
      )}
    </>
  );

  if (!href || disabled) return <span className="mini-icon-btn disabled" aria-label={label}>{content}</span>;
  return <a className="mini-icon-btn" aria-label={label} href={href} rel={type === "nav" ? "noreferrer" : undefined} target={type === "nav" ? "_blank" : undefined}>{content}</a>;
}

function statusHint(status: string) {
  switch (status) {
    case "accepted":
    case "assigned":
    case "heading_to_shop":
      return "請先到商戶取貨。";
    case "picked_up":
    case "arrived_customer":
      return "已取貨，請盡快送達客戶。";
    default:
      return "請按訂單狀態繼續處理。";
  }
}

export function DriverOrdersClient() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

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

  async function sendStatus(orderId: string, eventType: string) {
    setBusyOrderId(orderId + eventType);
    try {
      const response = await fetch(`/api/driver/orders/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventType })
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        window.alert(payload.message ?? "更新訂單狀態失敗。");
        return;
      }
      if (eventType === "delivered") {
        window.location.href = `/driver/orders/${orderId}`;
        return;
      }
      await load();
    } catch {
      window.alert("更新訂單狀態失敗。");
    } finally {
      setBusyOrderId(null);
    }
  }

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
        orders.map((order) => {
          const toShop = buildGoogleNavUrl(order.storeName, order.storeAddress, order.storeLatitude, order.storeLongitude);
          const toCustomer = buildGoogleNavUrl(order.customerName, order.customerAddress, order.customerLatitude, order.customerLongitude);
          const canPickUp = order.status === "accepted" || order.status === "assigned" || order.status === "heading_to_shop";
          const canDeliver = order.status === "picked_up" || order.status === "arrived_customer";
          return (
            <article className="android-card active-order-card stack gap-3 no-overflow-card" key={order.id}>
              <StageStrip status={order.status} />

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
                  <div className="mini-icon-actions">
                    <IconButtonLink href={dialHref(order.storePhone)} label="致電商戶" type="call" disabled={!order.storePhone} />
                    <IconButtonLink href={toShop} label="導航到商戶" type="nav" />
                  </div>
                </div>
                <div className="location-row-web">
                  <div className="grow minw-0">
                    <div className="driver-soft-label">客戶</div>
                    <div className="location-title">{order.customerName}</div>
                    <div className="address-text compact">{order.customerAddress}</div>
                  </div>
                  <div className="mini-icon-actions">
                    <IconButtonLink href={dialHref(order.customerPhone)} label="致電客戶" type="call" disabled={!order.customerPhone} />
                    <IconButtonLink href={toCustomer} label="導航到客戶" type="nav" />
                  </div>
                </div>
              </div>

              <div className="inline-meta-pills compact wrap-safe">
                <span className="meta-pill green">{order.paymentTag}</span>
                <span className="meta-pill">取貨區：{order.pickupDistrict ?? "未分區"}</span>
                <span className="meta-pill">送達區：{order.destinationDistrict ?? "未分區"}</span>
              </div>

              <div className="order-bottom-meta compact">{statusHint(order.status)}</div>

              <div className="stack gap-2">
                {canPickUp ? (
                  <button className="android-primary-btn" disabled={busyOrderId === order.id + "picked_up"} onClick={() => sendStatus(order.id, "picked_up")} type="button">{busyOrderId === order.id + "picked_up" ? "處理中..." : "已取貨"}</button>
                ) : null}
                {canDeliver ? (
                  <Link className="android-primary-btn no-underline" href={`/driver/orders/${order.id}`}>拍照後完成訂單</Link>
                ) : null}
                <button className="android-danger-btn" disabled={busyOrderId === order.id + "canceled"} onClick={() => sendStatus(order.id, "canceled")} type="button">{busyOrderId === order.id + "canceled" ? "處理中..." : "取消訂單"}</button>
              </div>
            </article>
          );
        })
      )}
    </div>
  );
}
