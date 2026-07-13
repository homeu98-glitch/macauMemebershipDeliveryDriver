"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
  acceptedAt: string | null;
  pickedUpAt: string | null;
  cancelReason: string | null;
  cancelOtherReason: string | null;
  cancelHandling: "return_to_shop" | "not_returning" | null;
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

function graceSecondsLeft(acceptedAt: string | null) {
  if (!acceptedAt) return 0;
  const startedAt = new Date(acceptedAt).getTime();
  if (Number.isNaN(startedAt)) return 0;
  return Math.max(0, 180 - Math.floor((Date.now() - startedAt) / 1000));
}

function formatGraceCountdown(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function formatPickupElapsed(startedAt: string | null, nowTick: number) {
  void nowTick;
  if (!startedAt) return null;
  const started = new Date(startedAt).getTime();
  if (Number.isNaN(started)) return null;
  const elapsedSec = Math.max(0, Math.floor((Date.now() - started) / 1000));
  const mins = Math.floor(elapsedSec / 60);
  const secs = elapsedSec % 60;
  return `已取貨 ${mins}:${String(secs).padStart(2, "0")}`;
}

function StageStrip({ status }: { status: string }) {
  const stages = ["前往商戶", "已取貨", "前往客戶"];
  const activeIndex = status === "picked_up" ? 1 : status === "arrived_customer" || status === "delivered" ? 2 : 0;
  return (
    <div className="order-stage-strip-web single-active">
      {stages.map((label, index) => {
        const current = index === activeIndex;
        return <div className={current ? "order-stage-chip current" : "order-stage-chip"} key={label}>{label}</div>;
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

export function DriverOrdersClient() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [cancelOrder, setCancelOrder] = useState<OrderSummary | null>(null);
  const [cancelReason, setCancelReason] = useState("臨時有事無法配送");
  const [cancelOtherReason, setCancelOtherReason] = useState("");
  const [cancelHandling, setCancelHandling] = useState<"return_to_shop" | "not_returning">("return_to_shop");
  const [nowTick, setNowTick] = useState(Date.now());
  const [completeOrderId, setCompleteOrderId] = useState<string | null>(null);
  const proofInputRef = useRef<HTMLInputElement | null>(null);

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

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function sendStatus(orderId: string, eventType: string, extra: Record<string, unknown> = {}) {
    setBusyOrderId(orderId + eventType);
    try {
      const response = await fetch(`/api/driver/orders/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventType, ...extra })
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        window.alert(payload.message ?? "更新訂單狀態失敗。");
        return false;
      }
      await load();
      return true;
    } catch {
      window.alert("更新訂單狀態失敗。");
      return false;
    } finally {
      setBusyOrderId(null);
    }
  }

  async function uploadProofAndComplete(orderId: string, file: File) {
    setBusyOrderId(orderId + "proof-delivered");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const proofResponse = await fetch(`/api/driver/orders/${orderId}/proof`, { method: "POST", body: formData });
      const proofPayload = (await proofResponse.json().catch(() => ({}))) as { message?: string };
      if (!proofResponse.ok) {
        window.alert(proofPayload.message ?? "上傳送達證明失敗。");
        return;
      }
      const ok = await sendStatus(orderId, "delivered");
      if (ok) {
        try {
          window.dispatchEvent(new CustomEvent("driver_play_sound", { detail: { soundKey: "order_completed" } }));
        } catch {}
        await load();
      }
    } catch {
      window.alert("上傳送達證明失敗。");
    } finally {
      setBusyOrderId(null);
      setCompleteOrderId(null);
    }
  }

  function triggerComplete(orderId: string) {
    setCompleteOrderId(orderId);
    proofInputRef.current?.click();
  }

  async function handleProofChange(event: any) {
    const file = event.target?.files?.[0] as File | undefined;
    if (!file || !completeOrderId) return;
    await uploadProofAndComplete(completeOrderId, file);
    event.target.value = "";
  }

  async function submitCancel() {
    if (!cancelOrder) return;
    const inGrace = (cancelOrder.status === "accepted" || cancelOrder.status === "assigned" || cancelOrder.status === "heading_to_shop") && graceSecondsLeft(cancelOrder.acceptedAt) > 0;
    const ok = inGrace
      ? await sendStatus(cancelOrder.id, "canceled", { action: "grace_release" })
      : await sendStatus(cancelOrder.id, "canceled", {
          cancelReason,
          cancelOtherReason: cancelReason === "其他" ? cancelOtherReason : "",
          cancelHandling
        });
    if (ok) {
      if (inGrace) {
        window.location.href = "/driver/home";
        return;
      }
      setCancelOrder(null);
      setCancelReason("臨時有事無法配送");
      setCancelOtherReason("");
      setCancelHandling("return_to_shop");
    }
  }

  if (loading) return <div className="android-card">載入進行中訂單...</div>;
  if (error) return <div className="android-card error">{error}</div>;

  return (
    <>
      <input accept="image/*" capture="environment" hidden onChange={handleProofChange} ref={proofInputRef} type="file" />
      <div className="stack gap-3 orders-page-wrap">
        <div className="driver-inline-between orders-header-row">
          <div className="stack gap-1">
            <div className="driver-screen-title">訂單</div>
            <div className="muted">進行中的配送訂單</div>
          </div>
          <button className="android-secondary-btn small" onClick={load} type="button">刷新</button>
        </div>

        {orders.length === 0 ? (
          <div className="android-card muted">目前沒有進行中訂單。</div>
        ) : (
          orders.map((order, index) => {
            const toShop = buildGoogleNavUrl(order.storeName, order.storeAddress, order.storeLatitude, order.storeLongitude);
            const toCustomer = buildGoogleNavUrl(order.customerName, order.customerAddress, order.customerLatitude, order.customerLongitude);
            const canPickUp = order.status === "accepted" || order.status === "assigned" || order.status === "heading_to_shop";
            const canDeliver = order.status === "picked_up" || order.status === "arrived_customer";
            const pickupElapsed = order.status === "picked_up" || order.status === "arrived_customer" ? formatPickupElapsed(order.pickedUpAt, nowTick) : null;
            const graceLeft = graceSecondsLeft(order.acceptedAt);
            const inGrace = (order.status === "accepted" || order.status === "assigned" || order.status === "heading_to_shop") && graceLeft > 0;
            return (
              <article className="android-card active-order-card stack gap-3 no-overflow-card full-width-card" key={order.id}>
                <div className="active-order-card-topbar with-pickup-timer">
                  <div className="order-card-number">訂單 {index + 1}</div>
                  <div className="pickup-elapsed-slot">{inGrace ? <div className="pickup-elapsed-chip">可取消 {formatGraceCountdown(graceLeft)}</div> : pickupElapsed ? <div className="pickup-elapsed-chip">{pickupElapsed}</div> : null}</div>
                  <div className="order-price-top-right">
                    <div className={order.isUrgent ? "money-chip urgent large compact" : "money-chip large compact"}>MOP {order.amountMop.toFixed(1)}</div>
                  </div>
                </div>

                <div className="driver-inline-between align-start orders-card-top-row">
                  <div className="stack gap-1 grow minw-0">
                    {order.isUrgent ? <div className="urgent-text">急單</div> : null}
                    <div className="order-subvalue tight">{order.transactionCode ?? order.externalOrderId}</div>
                    <div className="order-subvalue tight">送達時間 {order.deliveryDeadlineText}</div>
                    <div className="order-subvalue tight">已派送 {order.totalSentOrders} 單</div>
                  </div>
                </div>

                <div className="stage-strip-frame order-block-gap">
                  <StageStrip status={order.status} />
                </div>

                <div className="android-soft-panel order-address-panel compact stack gap-2 order-block-gap">
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

                {order.status === "canceled" ? (
                  <div className="canceled-order-frame" style={{ marginTop: 8 }}>此訂單已取消配送</div>
                ) : null}

                {inGrace ? <div className="grace-cancel-hint">可在 {formatGraceCountdown(graceLeft)} 內取消並釋出回首頁</div> : null}

                <div className="stack gap-2 action-block-gap">
                  {order.status !== "canceled" && canPickUp ? (
                    <button className="android-primary-btn action-with-margin" disabled={busyOrderId === order.id + "picked_up"} onClick={() => sendStatus(order.id, "picked_up")} type="button">{busyOrderId === order.id + "picked_up" ? "處理中..." : "已取貨"}</button>
                  ) : null}
                  {order.status !== "canceled" && canDeliver ? (
                    <button className="android-primary-btn action-with-margin" disabled={busyOrderId === order.id + "proof-delivered"} onClick={() => triggerComplete(order.id)} type="button">{busyOrderId === order.id + "proof-delivered" ? "上傳中..." : "拍照後完成訂單"}</button>
                  ) : null}
                  {order.status !== "canceled" ? (
                    <button
                      className="android-danger-btn action-with-margin"
                      disabled={busyOrderId === order.id + "canceled"}
                      onClick={() => {
                        setCancelOrder(order);
                        setCancelReason("臨時有事無法配送");
                        setCancelOtherReason("");
                        setCancelHandling("return_to_shop");
                      }}
                      type="button"
                    >
                      {busyOrderId === order.id + "canceled" ? "處理中..." : inGrace ? "立即取消並釋出" : "取消訂單"}
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })
        )}
      </div>

      {cancelOrder ? (
        <div className="driver-modal-backdrop" onClick={() => setCancelOrder(null)}>
          <div className="driver-modal-card stack gap-3" onClick={(event) => event.stopPropagation()}>
            <div className="driver-screen-title small">取消訂單</div>
            {(cancelOrder.status === "accepted" || cancelOrder.status === "assigned" || cancelOrder.status === "heading_to_shop") && graceSecondsLeft(cancelOrder.acceptedAt) > 0 ? (
              <>
                <div className="muted">可在 {formatGraceCountdown(graceSecondsLeft(cancelOrder.acceptedAt))} 內取消並釋出回首頁，無需填寫原因。</div>
              </>
            ) : (
              <>
                <div className="muted">請選擇取消原因與處理方式。</div>
                <label className="driver-field compact-field">
                  <span>取消原因</span>
                  <select value={cancelReason} onChange={(event) => setCancelReason(event.target.value)}>
                    <option value="臨時有事無法配送">臨時有事無法配送</option>
                    <option value="車輛故障">車輛故障</option>
                    <option value="身體不適">身體不適</option>
                    <option value="其他">其他</option>
                  </select>
                </label>
                {cancelReason === "其他" ? (
                  <label className="driver-field compact-field">
                    <span>請輸入原因</span>
                    <input type="text" value={cancelOtherReason} onChange={(event) => setCancelOtherReason(event.target.value)} />
                  </label>
                ) : null}
                <label className="driver-field compact-field">
                  <span>處理方式</span>
                  <select value={cancelHandling} onChange={(event) => setCancelHandling(event.target.value as "return_to_shop" | "not_returning")}>
                    <option value="return_to_shop">退回商戶</option>
                    <option value="not_returning">不退回</option>
                  </select>
                </label>
              </>
            )}
            <div className="driver-auth-actions-row single-mobile-row">
              <button className="android-secondary-btn" onClick={() => setCancelOrder(null)} type="button">返回</button>
              <button className="android-danger-btn" onClick={submitCancel} type="button">{(cancelOrder.status === "accepted" || cancelOrder.status === "assigned" || cancelOrder.status === "heading_to_shop") && graceSecondsLeft(cancelOrder.acceptedAt) > 0 ? "立即取消並釋出" : "確認取消"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
