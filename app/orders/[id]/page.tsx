import Link from "next/link";
import { notFound } from "next/navigation";

import { getOrderById } from "@/lib/server-data";

export default async function OrderDetailPage({
  params
}: {
  params: { id: string };
}) {
  const order = await getOrderById(params.id);

  if (!order) {
    notFound();
  }

  return (
    <div className="section-stack">
      <section className="card">
        <div className="card-header">
          <div>
            <div className="eyebrow">訂單詳情</div>
            <h2 className="page-title" style={{ marginTop: 12, marginBottom: 6 }}>
              {order.code}
            </h2>
            <p className="page-subtitle">
              {order.storeName} → {order.customerName}
            </p>
          </div>
          <Link className="btn btn-secondary" href="/orders">
            返回訂單列表
          </Link>
        </div>

        <div className="inline-pills" style={{ marginBottom: 20 }}>
          <span className="pill">狀態：{order.status.replace("_", " ")}</span>
          <span className="pill">騎手：{order.riderName}</span>
          <span className="pill">預估：{order.etaMinutes} 分鐘</span>
          <span className="pill">配送費：MOP {order.amountMop}</span>
        </div>

        <div className="grid two-column">
          <section className="card" style={{ padding: 18 }}>
            <div className="card-header">
              <div>
                <h3 className="card-title">配送資訊</h3>
              </div>
            </div>
            <div className="list">
              <div className="list-item">
                <div>
                  <strong>客戶</strong>
                  <div className="muted">{order.customerName}</div>
                </div>
              </div>
              <div className="list-item">
                <div>
                  <strong>送貨地址</strong>
                  <div className="muted">{order.address}</div>
                </div>
              </div>
              <div className="list-item">
                <div>
                  <strong>品項</strong>
                  <div className="inline-pills" style={{ marginTop: 8 }}>
                    {order.items.length ? order.items.map((item) => (
                      <span className="pill" key={item}>
                        {item}
                      </span>
                    )) : <span className="muted">目前沒有品項資料</span>}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="card" style={{ padding: 18 }}>
            <div className="card-header">
              <div>
                <h3 className="card-title">時間線</h3>
              </div>
            </div>
            <div className="timeline">
              {order.timeline.length ? order.timeline.map((entry) => (
                <div className="timeline-item" key={`${entry.label}-${entry.timestamp}`}>
                  <div className="timeline-dot" />
                  <div>
                    <strong>{entry.label}</strong>
                    <div className="muted">{entry.timestamp}</div>
                    <div className="muted">{entry.note}</div>
                  </div>
                </div>
              )) : <div className="muted">目前沒有事件紀錄。</div>}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
