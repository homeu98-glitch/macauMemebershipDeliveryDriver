"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Dashboard = { todayEarningsMop: number; weekEarningsMop: number; completedToday: number; availability: string; approvalStatus: string; availableOrders: Array<{ id: string; externalOrderId: string; status: string; storeName: string; storeAddress: string; customerName: string; customerAddress: string; amountMop: number; createdAt: string; promisedAt: string | null; etaMinutes: number; isUrgent: boolean; }>; };

export function DriverHomeClient() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  async function toggleAvailability() {
    if (!data) return;
    setBusy(true);
    try {
      const next = data.availability === "online" ? "offline" : "online";
      const response = await fetch("/api/driver/availability", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ availability: next }) });
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
      const response = await fetch(`/api/driver/orders/${orderId}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "accepted" }) });
      if (!response.ok) throw new Error("accept_failed");
      window.location.href = `/driver/orders/${orderId}`;
    } catch {
      window.alert("接單失敗，請稍後再試。");
    }
  }

  if (loading) return <div className="card">首頁載入中...</div>;
  if (error) return <div className="card error">{error}</div>;
  if (!data) return <div className="card">沒有可用資料。</div>;

  return (
    <div className="stack gap-4">
      <section className="android-summary-hero stack gap-3"><div className="driver-brand-chip">接單面板</div><div className="driver-hero-heading">今天繼續加油</div><div className="driver-hero-note">保持頁面開啟，新單通知會更穩定。</div><div className="driver-summary-grid">
        <div className="card driver-summary-card"><div className="muted">今日收入</div><strong>MOP {data.todayEarningsMop.toFixed(1)}</strong></div>
        <div className="card driver-summary-card"><div className="muted">本週收入</div><strong>MOP {data.weekEarningsMop.toFixed(1)}</strong></div>
        <div className="card driver-summary-card"><div className="muted">今日完成</div><strong>{data.completedToday} 單</strong></div>
      </div></section>
      <section className="android-card stack gap-3">
        <div className="driver-inline-between"><div><div className="driver-section-title">接單狀態</div><div className="muted">目前為 {data.availability === "online" ? "上線中" : "離線中"}</div></div><button className={data.availability === "online" ? "btn-secondary" : "btn-primary"} disabled={busy} onClick={toggleAvailability} type="button">{busy ? "更新中..." : data.availability === "online" ? "切換離線" : "切換上線"}</button></div>
      </section>
      <section className="stack gap-3">
        <div className="driver-inline-between"><div className="driver-section-title">可接訂單</div><button className="btn btn-secondary" onClick={load} type="button">刷新</button></div>
        {data.availableOrders.length === 0 ? <div className="card muted">暫時沒有新訂單。</div> : data.availableOrders.map((order) => (
          <article className="android-card driver-order-card stack gap-3" key={order.id}>
            <div className="driver-inline-between"><div className="stack gap-1"><strong className="driver-order-title">{order.storeName}</strong><div className="muted">訂單編號：{order.externalOrderId}</div></div><span className={order.isUrgent ? "driver-badge urgent" : "driver-badge"}>{order.isUrgent ? "加急單" : "可接單"}</span></div>
            <div className="android-soft-panel"><div className="driver-soft-label">商戶取貨點</div><div>{order.storeAddress}</div><div className="driver-soft-label">客戶送達點</div><div>{order.customerAddress}</div></div>
            <div className="driver-inline-between"><span className="driver-amount">MOP {order.amountMop.toFixed(1)}</span><span className="muted">{order.promisedAt ?? order.createdAt}</span></div>
            <div className="driver-inline-between"><Link className="btn btn-secondary" href={`/driver/orders/${order.id}`}>查看詳情</Link><button className="btn-primary" onClick={() => acceptOrder(order.id)} type="button">接單</button></div>
          </article>
        ))}
      </section>
    </div>
  );
}
