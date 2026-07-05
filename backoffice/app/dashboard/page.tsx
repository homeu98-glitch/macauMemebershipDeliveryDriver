import { DashboardCreateOrderPanel, MetricsGrid } from "@/components/backoffice";
import Link from "next/link";
import {
  getMetrics,
  listCallbackLogs,
  listOrders,
  listRiderApplications,
  listRiders
} from "@/lib/server-data";

function riderBadgeClass(status: "online" | "offline" | "suspended") {
  if (status === "online") return "badge badge-positive";
  if (status === "suspended") return "badge badge-danger";
  return "badge badge-default";
}

function riderStatusLabel(status: "online" | "offline" | "suspended") {
  if (status === "online") return "在線";
  if (status === "suspended") return "停用";
  return "離線";
}

export default async function DashboardPage() {
  const [metrics, orders, riderApplications, riders, callbackLogs] = await Promise.all([
    getMetrics(),
    listOrders(),
    listRiderApplications(),
    listRiders(),
    listCallbackLogs()
  ]);

  const liveOrders = orders.filter(
    (order) =>
      order.status === "new" ||
      order.status === "assigned" ||
      order.status === "picked_up"
  );
  const pendingApplications = riderApplications.filter(
    (item) => item.status === "pending"
  ).length;
  const callbackAttention = callbackLogs.filter(
    (item) => item.status !== "success"
  ).length;

  return (
    <div className="section-stack">
      <DashboardCreateOrderPanel />
      <MetricsGrid metrics={metrics} />

      <div className="grid two-column">
        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">營運重點</h2>
              <p className="muted">目前最需要後台優先處理的工作。</p>
            </div>
          </div>

          <div className="list">
            <div className="list-item">
              <div>
                <strong>審核騎手申請</strong>
                <div className="muted">
                  目前共有 {pendingApplications} 筆申請等待審核。
                </div>
              </div>
              <span className="badge badge-warning">待處理</span>
            </div>
            <div className="list-item">
              <div>
                <strong>追蹤回調重送</strong>
                <div className="muted">
                  {callbackAttention} 筆回調需要重試或人工檢查。
                </div>
              </div>
              <span className="badge badge-danger">需介入</span>
            </div>
            <div className="list-item">
              <div>
                <strong>監控進行中訂單</strong>
                <div className="muted">
                  目前有 {liveOrders.length} 筆訂單仍在配送流程中。
                </div>
              </div>
              <span className="badge badge-positive">即時追蹤</span>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">快速測試入口</h2>
              <p className="muted">建立測試訂單、發送測試推播，直接驗證 rider app 流程。</p>
            </div>
          </div>

          <div className="list">
            <div className="list-item">
              <div>
                <strong>建立測試訂單</strong>
                <div className="muted">
                  一鍵建立 1 筆或 5 筆假訂單，測試接單、推播和回調。
                </div>
              </div>
              <Link className="btn btn-primary" href="/testing">
                前往建立
              </Link>
            </div>
            <div className="list-item">
              <div>
                <strong>查看推播裝置</strong>
                <div className="muted">
                  檢查哪些騎手裝置已成功註冊 FCM token。
                </div>
              </div>
              <Link className="btn btn-secondary" href="/push-tokens">
                查看裝置
              </Link>
            </div>
          </div>
        </section>
      </div>

      <div className="grid two-column">
        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">最近進行中訂單</h2>
              <p className="muted">快速查看目前正在處理的配送案件。</p>
            </div>
          </div>

          <div className="list">
            {liveOrders.length ? (
              liveOrders.slice(0, 6).map((order) => (
                <div className="list-item" key={order.id}>
                  <div>
                    <strong>{order.code}</strong>
                    <div className="muted">
                      {order.storeName} → {order.customerName}
                    </div>
                    <div className="muted">{order.address}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div>{order.etaMinutes} 分鐘</div>
                    <div className="muted">{order.riderName}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="muted">目前沒有進行中的訂單。</div>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">騎手狀態</h2>
              <p className="muted">查看目前騎手可用性與帳號狀態。</p>
            </div>
          </div>

          <div className="list">
            {riders.length ? (
              riders.slice(0, 6).map((rider) => (
                <div className="list-item" key={rider.id}>
                  <div>
                    <strong>{rider.name}</strong>
                    <div className="muted">
                      {rider.zone} · 已完成 {rider.completedOrders} 筆
                    </div>
                  </div>
                  <span className={riderBadgeClass(rider.status)}>
                    {riderStatusLabel(rider.status)}
                  </span>
                </div>
              ))
            ) : (
              <div className="muted">目前尚未建立騎手資料。</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
