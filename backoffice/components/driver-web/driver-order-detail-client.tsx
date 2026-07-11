"use client";

import { useEffect, useMemo, useState } from "react";

type OrderDetail = {
  id: string;
  externalOrderId: string;
  status: string;
  storeName: string;
  storeAddress: string;
  customerName: string;
  customerAddress: string;
  amountMop: number;
  createdAt: string;
  promisedAt: string | null;
  items: string[];
  timeline: Array<{ label: string; timestamp: string; note: string }>;
  hasProof: boolean;
};

export function DriverOrderDetailClient({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);

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
  const canPickUp = order?.status === "accepted" || order?.status === "arrived_shop" || order?.status === "assigned";
  const canDeliver = order?.status === "picked_up" || order?.status === "arrived_customer";

  async function sendStatus(event: string) {
    setActionBusy(event);
    try {
      const response = await fetch(`/api/driver/orders/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventType: event })
      });
      if (!response.ok) throw new Error("status_failed");
      await load();
    } catch {
      window.alert("更新訂單狀態失敗。");
    } finally {
      setActionBusy(null);
    }
  }

  async function uploadProof() {
    if (!proofFile) return;
    setActionBusy("proof");
    try {
      const formData = new FormData();
      formData.append("file", proofFile);
      const response = await fetch(`/api/driver/orders/${orderId}/proof`, { method: "POST", body: formData });
      if (!response.ok) throw new Error("proof_failed");
      await load();
      setProofFile(null);
    } catch {
      window.alert("上傳送達證明失敗。");
    } finally {
      setActionBusy(null);
    }
  }

  const proofPreviewUrl = useMemo(() => (order?.hasProof ? `/api/driver/orders/${orderId}/proof?ts=${Date.now()}` : null), [order?.hasProof, orderId]);

  if (loading) return <div className="android-card">載入訂單中...</div>;
  if (!order) return <div className="android-card error">找不到訂單資料。</div>;

  return (
    <div className="stack gap-4">
      <section className="android-card stack gap-2">
        <div className="driver-inline-between align-start">
          <div className="stack gap-1 grow">
            <div className="driver-screen-title">訂單詳情</div>
            <div className="muted">交易編號 {order.externalOrderId}</div>
            <div className="muted">送達時間 {order.promisedAt ?? order.createdAt}</div>
          </div>
          <div className="money-chip">MOP {order.amountMop.toFixed(1)}</div>
        </div>
      </section>

      <section className="android-soft-panel stack gap-2">
        <div className="driver-soft-label">商戶地址</div>
        <div>{order.storeAddress}</div>
        <div className="driver-soft-label">客戶地址</div>
        <div>{order.customerAddress}</div>
      </section>

      <section className="android-card stack gap-3">
        <div className="driver-section-title">商品清單</div>
        {order.items.length === 0 ? <div className="muted">沒有商品明細。</div> : order.items.map((item) => <div className="driver-list-line" key={item}>{item}</div>)}
      </section>

      <section className="android-card stack gap-3">
        <div className="driver-action-grid">
          {canAccept ? <button className="android-primary-btn" disabled={Boolean(actionBusy)} onClick={() => sendStatus("accepted")} type="button">{actionBusy === "accepted" ? "接單中..." : "接單"}</button> : null}
          {canPickUp ? <button className="android-primary-btn" disabled={Boolean(actionBusy)} onClick={() => sendStatus("picked_up")} type="button">{actionBusy === "picked_up" ? "處理中..." : "已取貨"}</button> : null}
          {canDeliver ? <button className="android-primary-btn" disabled={Boolean(actionBusy) || !order.hasProof} onClick={() => sendStatus("delivered")} type="button">{actionBusy === "delivered" ? "處理中..." : "拍照後完成訂單"}</button> : null}
          <button className="android-danger-btn" disabled={Boolean(actionBusy)} onClick={() => sendStatus("canceled")} type="button">取消訂單</button>
        </div>
      </section>

      <section className="android-card stack gap-3">
        <div className="driver-section-title">送達證明</div>
        {proofPreviewUrl ? <img alt="delivery proof" className="driver-proof-preview" src={proofPreviewUrl} /> : <div className="android-soft-panel muted">尚未上傳送達證明。</div>}
        <label className={proofFile ? "driver-upload-card uploaded compact" : "driver-upload-card compact"}>
          <input accept="image/*" capture="environment" onChange={(event) => setProofFile(event.target.files?.[0] ?? null)} type="file" hidden />
          <div className="driver-upload-title">拍照後完成訂單</div>
          <div className="driver-upload-copy">請選擇直接拍照，或從相簿上傳送達圖片。</div>
          <div className="driver-upload-file">{proofFile ? proofFile.name : "尚未選擇"}</div>
          <span className="driver-upload-button">選擇圖片</span>
        </label>
        <button className="android-secondary-btn" disabled={!proofFile || actionBusy === "proof"} onClick={uploadProof} type="button">
          {actionBusy === "proof" ? "上傳中..." : "上傳送達證明"}
        </button>
      </section>
    </div>
  );
}
