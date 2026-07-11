"use client";

import { useEffect, useMemo, useState } from "react";

type OrderDetail = { id: string; externalOrderId: string; status: string; storeName: string; storeAddress: string; customerName: string; customerAddress: string; amountMop: number; createdAt: string; promisedAt: string | null; items: string[]; timeline: Array<{ label: string; timestamp: string; note: string }>; hasProof: boolean; };

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

  useEffect(() => { load(); }, [orderId]);

  const canAccept = order?.status === "new";
  const canPickUp = order?.status === "accepted" || order?.status === "arrived_shop" || order?.status === "assigned";
  const canDeliver = order?.status === "picked_up" || order?.status === "arrived_customer";

  async function sendStatus(event: string) {
    setActionBusy(event);
    try {
      const response = await fetch(`/api/driver/orders/${orderId}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event }) });
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

  if (loading) return <div className="card">載入訂單中...</div>;
  if (!order) return <div className="card error">找不到訂單資料。</div>;

  return (
    <div className="stack gap-4">
      <section className="card stack gap-2"><div className="driver-inline-between"><h1 className="driver-screen-title">訂單 {order.externalOrderId}</h1><span className="driver-badge">{order.status}</span></div><div className="muted">建立時間：{order.createdAt}</div><div className="muted">應送達：{order.promisedAt ?? "未設定"}</div><div>MOP {order.amountMop.toFixed(1)}</div></section>
      <section className="card stack gap-2"><div className="driver-section-title">商戶</div><strong>{order.storeName}</strong><div>{order.storeAddress}</div></section>
      <section className="card stack gap-2"><div className="driver-section-title">客戶</div><strong>{order.customerName}</strong><div>{order.customerAddress}</div></section>
      <section className="card stack gap-2"><div className="driver-section-title">商品清單</div>{order.items.length === 0 ? <div className="muted">沒有商品明細。</div> : order.items.map((item) => <div key={item}>{item}</div>)}</section>
      <section className="card stack gap-3"><div className="driver-section-title">操作</div><div className="driver-action-grid">{canAccept ? <button className="btn-primary" disabled={Boolean(actionBusy)} onClick={() => sendStatus("accepted")} type="button">{actionBusy === "accepted" ? "處理中..." : "接單"}</button> : null}{canPickUp ? <button className="btn-primary" disabled={Boolean(actionBusy)} onClick={() => sendStatus("picked_up")} type="button">{actionBusy === "picked_up" ? "處理中..." : "已取貨"}</button> : null}{canDeliver ? <button className="btn-primary" disabled={Boolean(actionBusy) || !order.hasProof} onClick={() => sendStatus("delivered")} type="button">{actionBusy === "delivered" ? "處理中..." : "完成訂單"}</button> : null}{(order.status === "accepted" || order.status === "picked_up" || order.status === "arrived_customer") ? <button className="btn btn-danger" disabled={Boolean(actionBusy)} onClick={() => sendStatus("canceled")} type="button">取消訂單</button> : null}</div></section>
      <section className="card stack gap-3"><div className="driver-section-title">送達證明</div>{proofPreviewUrl ? <img alt="delivery proof" className="driver-proof-preview" src={proofPreviewUrl} /> : <div className="muted">尚未上傳證明。</div>}<input accept="image/*" capture="environment" onChange={(event) => setProofFile(event.target.files?.[0] ?? null)} type="file" /><button className="btn-secondary" disabled={!proofFile || actionBusy === "proof"} onClick={uploadProof} type="button">{actionBusy === "proof" ? "上傳中..." : "上傳送達證明"}</button></section>
      <section className="card stack gap-2"><div className="driver-section-title">時間線</div>{order.timeline.length === 0 ? <div className="muted">暫無事件。</div> : order.timeline.map((item, index) => <div className="driver-timeline-item" key={`${item.label}-${index}`}><strong>{item.label}</strong><div className="muted">{item.timestamp}</div><div>{item.note}</div></div>)}</section>
    </div>
  );
}
