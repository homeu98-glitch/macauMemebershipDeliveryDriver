"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Dashboard = {
  todayEarningsMop: number;
  weekEarningsMop: number;
  completedToday: number;
  availability: string;
  approvalStatus: string;
  availableOrders: Array<{
    id: string; externalOrderId: string; status: string; storeName: string; storeAddress: string; customerName: string; customerAddress: string; amountMop: number; createdAt: string; promisedAt: string | null; etaMinutes: number; isUrgent: boolean;
  }>;
};

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

  if (loading) return <div className="android-card">首頁載入中...</div>;
  if (error) return <div className="android-card error">{error}</div>;
  if (!data) return <div className="android-card">沒有可用資料。</div>;

  return (
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

      <section className="driver-inline-between">
        <div className="stack gap-1">
          <div className="driver-screen-title small">可接訂單</div>
          <div className="muted">向下拉即可即時刷新</div>
        </div>
        <div className="driver-count-chip">{data.availableOrders.length} 張</div>
      </section>

      {data.availableOrders.length === 0 ? (
        <div className="android-card muted">暫時還沒有新單</div>
      ) : (
        data.availableOrders.map((order) => (
          <article className="android-card driver-order-card stack gap-3" key={order.id}>
            <div className="driver-inline-between">
              <div className="stack gap-1">
                {order.isUrgent ? <div className="urgent-text">急單</div> : null}
                <strong className="driver-order-title">{order.storeName}</strong>
                <div className="muted">交易編號 {order.externalOrderId}</div>
                <div className="muted">送達時間 {order.promisedAt ?? order.createdAt}</div>
              </div>
              <div className={order.isUrgent ? "money-chip urgent" : "money-chip"}>MOP {order.amountMop.toFixed(1)}</div>
            </div>
            <div className="android-soft-panel">
              <div className="driver-soft-label">商戶地址</div>
              <div>{order.storeAddress}</div>
              <div className="driver-soft-label">客戶地址</div>
              <div>{order.customerAddress}</div>
            </div>
            <div className="driver-inline-between mobile-actions-row">
              <Link className="android-outline-link" href={`/driver/orders/${order.id}`}>前往商戶</Link>
              <button className="android-primary-btn small" onClick={() => acceptOrder(order.id)} type="button">{data.availability === "online" ? "接單" : "請先上線"}</button>
            </div>
          </article>
        ))
      )}
    </div>
  );
}
