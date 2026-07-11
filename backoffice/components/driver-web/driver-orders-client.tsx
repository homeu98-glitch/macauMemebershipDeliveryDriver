"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type OrderSummary = { id: string; externalOrderId: string; status: string; storeName: string; customerName: string; customerAddress: string; amountMop: number; createdAt: string; };

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

  if (loading) return <div className="card">載入進行中訂單...</div>;
  if (error) return <div className="card error">{error}</div>;

  return (
    <div className="stack gap-3">
      <div className="driver-inline-between"><div className="driver-section-title">進行中訂單</div><button className="btn btn-secondary" onClick={load} type="button">刷新</button></div>
      {orders.length === 0 ? <div className="card muted">目前沒有進行中訂單。</div> : orders.map((order) => (
        <article className="card stack gap-2" key={order.id}>
          <div className="driver-inline-between"><strong>{order.storeName}</strong><span className="driver-badge">{order.status}</span></div>
          <div className="muted">訂單編號：{order.externalOrderId}</div>
          <div>{order.customerName} · {order.customerAddress}</div>
          <div className="driver-inline-between"><span>MOP {order.amountMop.toFixed(1)}</span><span>{order.createdAt}</span></div>
          <Link className="btn btn-secondary" href={`/driver/orders/${order.id}`}>打開訂單</Link>
        </article>
      ))}
    </div>
  );
}
