"use client";

import { useEffect, useState } from "react";

type CompletedOrder = { id: string; externalOrderId: string; storeName: string; customerName: string; customerAddress: string; amountMop: number; deliveredAt: string; };

export function DriverCompletedClient() {
  const [range, setRange] = useState<"today" | "week" | "history">("today");
  const [orders, setOrders] = useState<CompletedOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/driver/orders/completed?range=${range}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((payload) => setOrders((payload as { orders: CompletedOrder[] }).orders ?? []))
      .finally(() => setLoading(false));
  }, [range]);

  return (
    <div className="stack gap-3">
      <div className="driver-inline-between">
        <div className="stack gap-1">
          <div className="driver-screen-title">已完成訂單</div>
          <div className="muted">可查看送達時間、照片資訊與已完成紀錄。</div>
        </div>
        <select className="driver-range-select" value={range} onChange={(event) => setRange(event.target.value as "today" | "week" | "history")}>
          <option value="today">今天</option>
          <option value="week">本週</option>
          <option value="history">歷史</option>
        </select>
      </div>
      {loading ? <div className="android-card">載入中...</div> : orders.length === 0 ? <div className="android-card muted">這個時間範圍內還沒有已完成訂單。</div> : orders.map((order) => (
        <article className="android-card stack gap-3" key={order.id}>
          <div className="driver-inline-between"><strong className="driver-order-title">{order.storeName}</strong><span className="driver-amount">MOP {order.amountMop.toFixed(1)}</span></div>
          <div className="android-soft-panel"><div>{order.customerName}</div><div>{order.customerAddress}</div></div>
          <div className="driver-inline-between"><span className="muted">交易編號 {order.externalOrderId}</span><span className="muted">{order.deliveredAt}</span></div>
        </article>
      ))}
    </div>
  );
}
