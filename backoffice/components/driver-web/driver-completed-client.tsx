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
        <h1 className="driver-screen-title">已完成訂單</h1>
        <select value={range} onChange={(event) => setRange(event.target.value as "today" | "week" | "history")}>
          <option value="today">今天</option>
          <option value="week">本週</option>
          <option value="history">歷史</option>
        </select>
      </div>
      {loading ? <div className="card">載入中...</div> : orders.length === 0 ? <div className="card muted">沒有已完成訂單。</div> : orders.map((order) => (
        <article className="card stack gap-2" key={order.id}>
          <div className="driver-inline-between"><strong>{order.storeName}</strong><span>MOP {order.amountMop.toFixed(1)}</span></div>
          <div>{order.customerName} · {order.customerAddress}</div>
          <div className="muted">訂單編號：{order.externalOrderId}</div>
          <div className="muted">完成時間：{order.deliveredAt}</div>
        </article>
      ))}
    </div>
  );
}
