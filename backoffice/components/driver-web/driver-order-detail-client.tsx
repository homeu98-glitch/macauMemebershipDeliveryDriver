"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type OrderDetail = {
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
  items: string[];
  timeline: Array<{ label: string; timestamp: string; note: string }>;
  hasProof: boolean;
};

function buildGoogleNavUrl(label: string, address: string, lat: number, lng: number) {
  if (lat && lng) return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${label} ${address}`)}`;
}

function dialHref(phone: string | null) {
  return phone ? `tel:${phone}` : undefined;
}

function formatCountdown(etaMinutes: number) {
  if (etaMinutes <= 0) return "已到時";
  return `${etaMinutes} 分鐘`;
}

function graceSecondsLeft(pickedUpAt: string | null) {
  if (!pickedUpAt) return 0;
  const time = new Date(pickedUpAt).getTime();
  if (Number.isNaN(time)) return 0;
  return Math.max(0, 180 - Math.floor((Date.now() - time) / 1000));
}

function formatGraceCountdown(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function DetailStageStrip({ status }: { status: string }) {
  if (status === "canceled") return <div className="detail-canceled-strip">此訂單已取消配送</div>;

  const stages = ["前往商戶", "已取貨", "前往客戶"];
  const activeIndex = status === "picked_up" ? 1 : status === "arrived_customer" || status === "delivered" ? 2 : 0;

  return (
    <div className="order-stage-strip-web single-active">
      {stages.map((label, index) => (
        <div key={label} className={activeIndex === index ? "order-stage-chip current" : "order-stage-chip"}>
          {label}
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status, amount, urgent }: { status: string; amount: number; urgent: boolean }) {
  const statusLabel =
    status === "picked_up"
      ? "已取貨"
      : status === "arrived_customer"
        ? "前往客戶"
        : status === "accepted" || status === "assigned" || status === "heading_to_shop"
          ? "前往商戶"
          : status === "canceled"
            ? "已取消"
            : status;

  return (
    <div className="detail-top-badges">
      <span className={status === "canceled" ? "detail-status-badge canceled" : "detail-status-badge"}>{statusLabel}</span>
      <span className={urgent ? "money-chip urgent large compact" : "money-chip large compact"}>MOP {amount.toFixed(1)}</span>
    </div>
  );
}

function IconButtonLink({ href, label, type, disabled = false }: { href?: string; label: string; type: "call" | "nav"; disabled?: boolean }) {
  const content =
    type === "call" ? (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6.6 10.8a15.5 15.5 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.24c1.08.36 2.22.54 3.4.54a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C11.85 21 3 12.15 3 1a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.18.18 2.32.54 3.4a1 1 0 0 1-.24 1l-2.2 2.4Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ) : (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z" stroke="currentColor" strokeWidth="1.8"/>
        <circle cx="12" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.8"/>
      </svg>
    );

  if (!href || disabled) return <span className="mini-icon-btn disabled" aria-label={label}>{content}</span>;
  return <a className="mini-icon-btn" aria-label={label} href={href} rel={type === "nav" ? "noreferrer" : undefined} target={type === "nav" ? "_blank" : undefined}>{content}</a>;
}

export function DriverOrderDetailClient({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [completeAfterUpload, setCompleteAfterUpload] = useState(false);
  const [showCancelPanel, setShowCancelPanel] = useState(false);
  const [cancelReason, setCancelReason] = useState("customer_request");
  const [cancelOtherReason, setCancelOtherReason] = useState("");
  const [cancelHandling, setCancelHandling] = useState<"return_to_shop" | "not_returning">("return_to_shop");
  const proofInputRef = useRef<HTMLInputElement | null>(null);

  async function load() {
    try {
      const response = await fetch(`/api/driver/orders/${orderId}`, { cache: "no-store" });
      if (!response.ok) throw new Error("detail_failed");
      setOrder((await response.json()) as OrderDetail);
    } catch {
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [orderId]);

  const canAccept = order?.status === "new";
  const canPickUp = order?.status === "accepted" || order?.status === "assigned" || order?.status === "heading_to_shop";
  const canDeliver = order?.status === "picked_up" || order?.status === "arrived_customer";
  const graceLeft = graceSecondsLeft(order?.pickedUpAt ?? null);
  const inGraceCancel = Boolean(order && order.status === "picked_up" && graceLeft > 0);

  async function sendStatus(eventType: string, redirectAfter = false, extra: Record<string, unknown> = {}) {
    setActionBusy(eventType);
    try {
      const response = await fetch(`/api/driver/orders/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventType, ...extra })
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        window.alert(payload.message ?? "更新訂單狀態失敗。");
        return;
      }
      if (eventType === "canceled" && extra.action === "grace_release") {
        window.setTimeout(() => {
          window.location.href = "/driver/home";
        }, 120);
        return;
      }
      if (redirectAfter && eventType === "delivered") {
        try {
          window.dispatchEvent(new CustomEvent("driver_play_sound", { detail: { soundKey: "order_completed" } }));
        } catch {}
        window.setTimeout(() => {
          window.location.href = "/driver/completed";
        }, 220);
        return;
      }
      await load();
    } catch {
      window.alert("更新訂單狀態失敗。");
    } finally {
      setActionBusy(null);
    }
  }

  async function uploadProofFile(file: File, deliverAfter = false) {
    setActionBusy(deliverAfter ? "proof-deliver" : "proof");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`/api/driver/orders/${orderId}/proof`, { method: "POST", body: formData });
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        window.alert(payload.message ?? "上傳送達證明失敗。");
        return;
      }
      if (deliverAfter) {
        await sendStatus("delivered", true);
        return;
      }
      await load();
    } catch {
      window.alert("上傳送達證明失敗。");
    } finally {
      setActionBusy(null);
      setCompleteAfterUpload(false);
    }
  }

  function handleCompleteClick() {
    if (!order) return;
    if (order.hasProof) {
      void sendStatus("delivered", true);
      return;
    }
    setCompleteAfterUpload(true);
    proofInputRef.current?.click();
  }

  function handleManualUploadClick() {
    setCompleteAfterUpload(false);
    proofInputRef.current?.click();
  }

  async function handleCancelSubmit() {
    if (!order) return;
    if (inGraceCancel) {
      await sendStatus("canceled", false, { action: "grace_release" });
      setShowCancelPanel(false);
      return;
    }
    await sendStatus("canceled", false, {
      cancelReason,
      cancelOtherReason,
      cancelHandling
    });
    setShowCancelPanel(false);
  }

  async function handleProofInputChange(event: any) {
    const file = event.target?.files?.[0] as File | undefined;
    if (!file) return;
    await uploadProofFile(file, completeAfterUpload);
    event.target.value = "";
  }

  const proofPreviewUrl = useMemo(() => (order?.hasProof ? `/api/driver/orders/${orderId}/proof?ts=${Date.now()}` : null), [order?.hasProof, orderId]);

  if (loading) return <div className="android-card">載入訂單中...</div>;
  if (!order) return <div className="android-card error">找不到訂單資料。</div>;

  const toShop = buildGoogleNavUrl(order.storeName, order.storeAddress, order.storeLatitude, order.storeLongitude);
  const toCustomer = buildGoogleNavUrl(order.customerName, order.customerAddress, order.customerLatitude, order.customerLongitude);

  return (
    <>
      <div className="stack gap-4">
        <section className="android-card detail-main-card stack gap-3 no-overflow-card full-width-card">
          <div className="driver-inline-between align-start gap-3 orders-header-row">
            <div className="stack gap-1 grow minw-0">
              {order.isUrgent ? <div className="urgent-text">急單</div> : null}
              <div className="driver-screen-title">{order.storeName}</div>
              <div className="order-subvalue tight">訂單號 {order.transactionCode ?? order.externalOrderId}</div>
              <div className="order-subvalue tight">倒計時 {formatCountdown(order.etaMinutes)}</div>
              <div className="order-subvalue tight">已派送 {order.totalSentOrders} 張單</div>
              <div className="order-subvalue tight">送達時間 {order.deliveryDeadlineText}</div>
              <div className="order-subvalue tight">發單日期 {order.publishedAt}</div>
            </div>
            <StatusBadge status={order.status} amount={order.amountMop} urgent={order.isUrgent} />
          </div>

          <DetailStageStrip status={order.status} />

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

          <div className="order-bottom-meta compact">{order.deliveryDeadlineText} · 請盡快完成本單</div>

          <div className="stack gap-2">
            {order.status === "canceled" ? <div className="muted">此訂單已取消配送。</div> : null}
            {canAccept ? <button className="android-primary-btn" disabled={Boolean(actionBusy)} onClick={() => sendStatus("accepted")} type="button">{actionBusy === "accepted" ? "接單中..." : "接單"}</button> : null}
            {canPickUp ? <button className="android-primary-btn" disabled={Boolean(actionBusy)} onClick={() => sendStatus("picked_up")} type="button">{actionBusy === "picked_up" ? "處理中..." : "已取貨"}</button> : null}
            {canDeliver ? <button className="android-primary-btn" disabled={Boolean(actionBusy)} onClick={handleCompleteClick} type="button">{actionBusy === "proof-deliver" || actionBusy === "delivered" ? "處理中..." : "拍照後完成訂單"}</button> : null}
            {inGraceCancel ? <div className="grace-cancel-hint">可在 {formatGraceCountdown(graceLeft)} 內取消並釋出回首頁</div> : null}
            {order.status !== "delivered" ? <button className="android-danger-btn" disabled={Boolean(actionBusy)} onClick={() => setShowCancelPanel(true)} type="button">{inGraceCancel ? "立即取消並釋出" : "取消訂單"}</button> : null}
          </div>
        </section>

        <section className="android-card stack gap-3 full-width-card">
          <div className="driver-section-title">商品清單</div>
          {order.items.length === 0 ? <div className="muted">沒有商品明細。</div> : order.items.map((item) => <div className="driver-list-line" key={item}>• {item}</div>)}
        </section>

        <section className="android-card stack gap-3 full-width-card">
          <div className="driver-section-title">送達證明</div>
          <div className="muted">{proofPreviewUrl ? "已上傳送達照片，可重新上傳。" : "請上傳送達照片，作為已完成配送的證明。"}</div>
          {proofPreviewUrl ? <img alt="delivery proof" className="driver-proof-preview" src={proofPreviewUrl} /> : null}
          <input accept="image/*" capture="environment" onChange={handleProofInputChange} ref={proofInputRef} type="file" hidden />
          <button className="android-secondary-btn" disabled={Boolean(actionBusy)} onClick={handleManualUploadClick} type="button">{actionBusy === "proof" ? "上傳中..." : proofPreviewUrl ? "重新上傳照片" : "上傳送達照片"}</button>
        </section>
      </div>

      {showCancelPanel ? (
        <div className="driver-modal-backdrop" onClick={() => setShowCancelPanel(false)}>
          <div className="driver-modal-card stack gap-3" onClick={(event) => event.stopPropagation()}>
            <div className="driver-screen-title small">取消訂單</div>
            {inGraceCancel ? (
              <>
                <div className="muted">目前仍在 grace period，可直接取消並釋出訂單。</div>
                <div className="order-bottom-meta compact">剩餘時間 {formatGraceCountdown(graceLeft)}</div>
              </>
            ) : (
              <>
                <label className="driver-field compact-field">
                  <span>取消原因</span>
                  <select value={cancelReason} onChange={(event) => setCancelReason(event.target.value)}>
                    <option value="customer_request">客戶要求取消</option>
                    <option value="shop_issue">商戶問題</option>
                    <option value="traffic_or_vehicle">交通或車輛問題</option>
                    <option value="other">其他原因</option>
                  </select>
                </label>
                {cancelReason === "other" ? (
                  <label className="driver-field compact-field">
                    <span>其他原因</span>
                    <input value={cancelOtherReason} onChange={(event) => setCancelOtherReason(event.target.value)} type="text" />
                  </label>
                ) : null}
                <label className="driver-field compact-field">
                  <span>處理方式</span>
                  <select value={cancelHandling} onChange={(event) => setCancelHandling(event.target.value as "return_to_shop" | "not_returning")}>
                    <option value="return_to_shop">退回商戶</option>
                    <option value="not_returning">不退回商戶</option>
                  </select>
                </label>
                <div className="muted">提交後會按目前後端流程處理取消與回調。</div>
              </>
            )}
            <div className="driver-auth-actions-row single-mobile-row">
              <button className="android-secondary-btn" onClick={() => setShowCancelPanel(false)} type="button">返回</button>
              <button className="android-danger-btn" disabled={Boolean(actionBusy)} onClick={handleCancelSubmit} type="button">{actionBusy === "canceled" ? "處理中..." : inGraceCancel ? "立即取消並釋出" : "確認取消"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
