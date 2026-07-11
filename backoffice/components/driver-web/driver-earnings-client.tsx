"use client";

import { useEffect, useState } from "react";

type EarningsPayload = { todayTotal: number; weekTotal: number; historyTotal: number; historyOrders: Array<{ id: string; externalOrderId: string; amountMop: number; deliveredAt: string; storeName: string; }>; };

export function DriverEarningsClient() {
  const [data, setData] = useState<EarningsPayload | null>(null);

  useEffect(() => {
    fetch("/api/driver/earnings", { cache: "no-store" })
      .then((res) => res.json())
      .then((payload) => setData(payload as EarningsPayload))
      .catch(() => undefined);
  }, []);

  if (!data) return <div className="card">載入收益中...</div>;

  return (
    <div className="stack gap-4">
      <section className="driver-summary-grid">
        <div className="card driver-summary-card"><div className="muted">今日收益</div><strong>MOP {data.todayTotal.toFixed(1)}</strong></div>
        <div className="card driver-summary-card"><div className="muted">本週收益</div><strong>MOP {data.weekTotal.toFixed(1)}</strong></div>
        <div className="card driver-summary-card"><div className="muted">累積收益</div><strong>MOP {data.historyTotal.toFixed(1)}</strong></div>
      </section>
      <section className="stack gap-3">
        <h1 className="driver-screen-title">收益紀錄</h1>
        {data.historyOrders.length === 0 ? <div className="card muted">暫時沒有收益紀錄。</div> : data.historyOrders.map((item) => (
          <article className="card stack gap-2" key={item.id}>
            <div className="driver-inline-between"><strong>{item.storeName}</strong><span>MOP {item.amountMop.toFixed(1)}</span></div>
            <div className="muted">訂單編號：{item.externalOrderId}</div>
            <div className="muted">完成時間：{item.deliveredAt}</div>
          </article>
        ))}
      </section>
    </div>
  );
}
