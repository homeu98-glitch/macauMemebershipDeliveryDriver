"use client";

import { useEffect, useState } from "react";

type CompletedOrder = {
  id: string;
  externalOrderId: string;
  transactionCode: string | null;
  storeName: string;
  customerName: string;
  customerAddress: string;
  amountMop: number;
  deliveredAt: string;
};

export function DriverCompletedClient() {
  const [orders, setOrders] = useState<CompletedOrder[]>([]);
  const [hiddenProofIds, setHiddenProofIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/driver/orders/completed", { cache: "no-store" })
      .then((res) => res.json())
      .then((payload) => setOrders(((payload as { orders?: CompletedOrder[] }).orders ?? []) as CompletedOrder[]))
      .catch(() => undefined);
  }, []);

  return (
    <div className="stack gap-3">
      <div className="driver-screen-title">完成訂單</div>
      {orders.length === 0 ? <div className="android-card muted">暫時沒有完成訂單。</div> : null}
      {orders.map((order) => (
        <section className="android-card stack gap-3" key={order.id}>
          <div className="driver-inline-between align-start">
            <div className="stack gap-1 grow minw-0">
              <div className="driver-order-title compact">{order.storeName}</div>
              <div className="order-subvalue tight">訂單號 {order.transactionCode ?? order.externalOrderId}</div>
              <div className="order-subvalue tight">客戶 {order.customerName}</div>
              <div className="order-subvalue tight">地址 {order.customerAddress}</div>
              <div className="order-subvalue tight">完成時間 {order.deliveredAt}</div>
            </div>
            <div className="money-chip large compact">MOP {order.amountMop.toFixed(1)}</div>
          </div>
          {!hiddenProofIds[order.id] ? (
            <div className="stack gap-2">
              <div className="driver-soft-label">送達照片</div>
              <img
                alt="delivery proof"
                className="driver-proof-preview"
                loading="lazy"
                onError={() => setHiddenProofIds((prev) => ({ ...prev, [order.id]: true }))}
                src={`/api/driver/orders/${order.id}/proof?ts=${Date.now()}`}
              />
            </div>
          ) : (
            <div className="muted">送達照片：已上傳</div>
          )}
        </section>
      ))}
    </div>
  );
}
