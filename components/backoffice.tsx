"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import type { CallbackLog, Metric, Order, Rider, RiderApplication, SettingRow } from "@/lib/data";
import type { SessionUser } from "@/lib/auth";

const navItems = [
  { href: "/dashboard", label: "儀表板" },
  { href: "/riders/applications", label: "騎手審核" },
  { href: "/riders", label: "騎手列表" },
  { href: "/orders", label: "訂單管理" },
  { href: "/callbacks", label: "回調紀錄" },
  { href: "/settings", label: "系統設定" }
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-Hant-MO", {
    style: "currency",
    currency: "MOP",
    maximumFractionDigits: 0
  }).format(value);
}

function getBadgeClass(
  status:
    | "default"
    | "positive"
    | "warning"
    | "danger"
    | "success"
    | "retrying"
    | "failed"
) {
  switch (status) {
    case "positive":
    case "success":
      return "badge badge-positive";
    case "warning":
    case "retrying":
      return "badge badge-warning";
    case "danger":
    case "failed":
      return "badge badge-danger";
    default:
      return "badge badge-default";
  }
}

function translateStatus(value: string) {
  const map: Record<string, string> = {
    pending: "待審核",
    approved: "已核准",
    rejected: "已拒絕",
    online: "在線",
    offline: "離線",
    suspended: "停用",
    new: "新訂單",
    assigned: "已指派",
    picked_up: "已取餐",
    delivered: "已送達",
    issue: "異常",
    success: "成功",
    retrying: "重試中",
    failed: "失敗",
    default: "一般"
  };

  return map[value] ?? value.replaceAll("_", " ");
}

function EmptyState({ text }: { text: string }) {
  return <div className="muted" style={{ padding: "14px 4px" }}>{text}</div>;
}

export function AppShell({
  user,
  children
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const initials = useMemo(
    () =>
      user.name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    [user.name]
  );

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-row">
          <div className="brand-mark">管</div>
          <div>
            <strong>配送後台</strong>
            <div className="muted">澳門會員配送系統</div>
          </div>
        </div>

        <nav>
          {navItems.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                className={`nav-link${active ? " active" : ""}`}
                href={item.href}
              >
                <span>{item.label}</span>
                <span className="muted">›</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer card">
          <div className="muted">目前角色</div>
          <p style={{ margin: "8px 0 16px" }}>{user.email}</p>
          <button className="btn btn-secondary" onClick={handleLogout} type="button">
            登出
          </button>
        </div>
      </aside>

      <main className="content">
        <div className="card header-card">
          <div>
            <div className="eyebrow">營運後台</div>
            <h1 className="page-title">騎手審核、訂單監控與回調處理</h1>
            <p className="page-subtitle">
              使用真實 Supabase 資料管理騎手帳號、查看訂單流轉與重試 callback。
            </p>
          </div>

          <div className="header-actions">
            <div>
              <div className="muted">目前登入</div>
              <strong>{user.email}</strong>
            </div>
            <div className="avatar" aria-hidden="true">
              {initials}
            </div>
          </div>
        </div>

        {children}
      </main>
    </div>
  );
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        throw new Error(payload.message ?? "登入失敗。");
      }

      const nextPath = searchParams.get("next") || "/dashboard";
      router.push(nextPath);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "登入失敗。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error ? <div className="error">{error}</div> : null}

      <div className="field">
        <label htmlFor="email">管理員電郵</label>
        <input
          id="email"
          autoComplete="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="admin@example.com"
          required
          type="email"
          value={email}
        />
      </div>

      <div className="field">
        <label htmlFor="password">密碼</label>
        <input
          id="password"
          autoComplete="current-password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </div>

      <button className="btn btn-primary" disabled={loading} type="submit">
        {loading ? "登入中..." : "登入後台"}
      </button>
    </form>
  );
}

export function MetricsGrid({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="grid metrics-grid">
      {metrics.map((metric) => (
        <section className="card" key={metric.label}>
          <div className="muted">{metric.label}</div>
          <div className="metric-value">{metric.value}</div>
          <span className={getBadgeClass(metric.tone === "default" ? "default" : metric.tone)}>
            {metric.change}
          </span>
        </section>
      ))}
    </div>
  );
}

export function RiderApplicationsBoard({
  applications
}: {
  applications: RiderApplication[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function updateStatus(id: string, status: "approved" | "rejected") {
    setBusyId(id);
    try {
      const response = await fetch(`/api/riders/applications/${id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        throw new Error(payload.message ?? "更新失敗");
      }

      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "更新失敗");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2 className="card-title">騎手申請與審核</h2>
          <p className="muted">直接把審核結果寫回 Supabase，並同步更新騎手狀態。</p>
        </div>
      </div>

      {!applications.length ? (
        <EmptyState text="目前沒有待處理的騎手申請。" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>申請人</th>
                <th>地區</th>
                <th>車種</th>
                <th>文件</th>
                <th>送出時間</th>
                <th>狀態</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((application) => {
                const canReview = application.status === "pending";
                return (
                  <tr key={application.id}>
                    <td>
                      <strong>{application.fullName}</strong>
                      <div className="muted">{application.phone}</div>
                      <div className="muted">{application.id}</div>
                    </td>
                    <td>{application.zone}</td>
                    <td>{application.vehicleType}</td>
                    <td>
                      <span className={getBadgeClass(application.documentsComplete ? "positive" : "warning")}>
                        {application.documentsComplete ? "齊全" : "待補"}
                      </span>
                    </td>
                    <td>{application.submittedAt}</td>
                    <td>
                      <span
                        className={getBadgeClass(
                          application.status === "approved"
                            ? "positive"
                            : application.status === "rejected"
                              ? "danger"
                              : "warning"
                        )}
                      >
                        {translateStatus(application.status)}
                      </span>
                    </td>
                    <td>
                      <div className="btn-row">
                        <button
                          className="btn btn-primary"
                          disabled={!canReview || busyId === application.id}
                          onClick={() => updateStatus(application.id, "approved")}
                          type="button"
                        >
                          核准
                        </button>
                        <button
                          className="btn btn-danger"
                          disabled={!canReview || busyId === application.id}
                          onClick={() => updateStatus(application.id, "rejected")}
                          type="button"
                        >
                          拒絕
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function RidersTable({ riders }: { riders: Rider[] }) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2 className="card-title">騎手列表</h2>
          <p className="muted">顯示已建立的騎手帳號、審核狀態與目前在線情況。</p>
        </div>
      </div>

      {!riders.length ? (
        <EmptyState text="目前尚未建立任何騎手資料。" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>騎手</th>
                <th>地區</th>
                <th>在線狀態</th>
                <th>審核</th>
                <th>評分</th>
                <th>完成訂單</th>
              </tr>
            </thead>
            <tbody>
              {riders.map((rider) => (
                <tr key={rider.id}>
                  <td>
                    <strong>{rider.name}</strong>
                    <div className="muted">{rider.phone}</div>
                    <div className="muted">{rider.id}</div>
                  </td>
                  <td>{rider.zone}</td>
                  <td>
                    <span className={getBadgeClass(rider.status === "online" ? "positive" : rider.status === "offline" ? "default" : "danger")}>
                      {translateStatus(rider.status)}
                    </span>
                  </td>
                  <td>
                    <span className={getBadgeClass(rider.approval === "approved" ? "positive" : rider.approval === "rejected" ? "danger" : "warning")}>
                      {translateStatus(rider.approval)}
                    </span>
                  </td>
                  <td>{rider.rating > 0 ? `${rider.rating.toFixed(1)} / 5.0` : "尚無"}</td>
                  <td>{rider.completedOrders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function OrdersTable({ orders }: { orders: Order[] }) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2 className="card-title">訂單列表</h2>
          <p className="muted">即時讀取真實訂單資料，點擊可查看明細。</p>
        </div>
      </div>

      {!orders.length ? (
        <EmptyState text="目前沒有訂單資料。" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>訂單</th>
                <th>店舖</th>
                <th>客戶</th>
                <th>騎手</th>
                <th>狀態</th>
                <th>配送費</th>
                <th>預估</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <Link href={`/orders/${order.id}`}>
                      <strong>{order.code}</strong>
                    </Link>
                    <div className="muted">{order.createdAt}</div>
                  </td>
                  <td>{order.storeName}</td>
                  <td>{order.customerName}</td>
                  <td>{order.riderName}</td>
                  <td>
                    <span className={getBadgeClass(order.status === "delivered" ? "positive" : order.status === "issue" ? "danger" : order.status === "new" ? "warning" : "default")}>
                      {translateStatus(order.status)}
                    </span>
                  </td>
                  <td>{formatCurrency(order.amountMop)}</td>
                  <td>{order.etaMinutes > 0 ? `${order.etaMinutes} 分鐘` : "已完成 / 未設定"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function CallbackLogsTable({ logs }: { logs: CallbackLog[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function retryCallback(id: string) {
    setBusyId(id);
    try {
      const response = await fetch(`/api/callbacks/${id}/retry`, { method: "POST" });
      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        throw new Error(payload.message ?? "重試失敗");
      }
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "重試失敗");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2 className="card-title">回調紀錄</h2>
          <p className="muted">從資料庫載入 callback_logs，並支援手動重送。</p>
        </div>
      </div>

      {!logs.length ? (
        <EmptyState text="目前沒有任何回調紀錄。" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>事件</th>
                <th>端點</th>
                <th>狀態</th>
                <th>回應碼</th>
                <th>次數</th>
                <th>最後時間</th>
                <th>摘要</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>
                    <strong>{log.event}</strong>
                    <div className="muted">{log.id}</div>
                  </td>
                  <td>{log.endpoint}</td>
                  <td>
                    <span className={getBadgeClass(log.status)}>
                      {translateStatus(log.status)}
                    </span>
                  </td>
                  <td>{log.responseCode || "未回應"}</td>
                  <td>{log.attempts}</td>
                  <td>{log.lastAttemptAt}</td>
                  <td>{log.summary}</td>
                  <td>
                    <button
                      className="btn btn-secondary"
                      disabled={busyId === log.id}
                      onClick={() => retryCallback(log.id)}
                      type="button"
                    >
                      重送
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function SettingsOverview({
  settings,
  supabaseConfigured
}: {
  settings: SettingRow[];
  supabaseConfigured: boolean;
}) {
  return (
    <div className="section-stack">
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">環境與整合設定</h2>
            <p className="muted">請確認 Vercel 上的伺服器端與前端環境變數都已正確設定。</p>
          </div>
          <span className={getBadgeClass(supabaseConfigured ? "positive" : "warning")}>
            {supabaseConfigured ? "可連接資料庫" : "設定未完成"}
          </span>
        </div>

        {settings.map((setting) => (
          <div className="setting-row" key={setting.key}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <strong>{setting.key}</strong>
              <span className={getBadgeClass(setting.configured ? "positive" : "warning")}>
                {setting.configured ? "已設定" : "未設定"}
              </span>
            </div>
            <div className="code">{setting.value}</div>
            <div className="muted">{setting.description}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">部署提醒</h2>
          </div>
        </div>
        <div className="list">
          <div className="list-item">
            <div>
              <strong>Vercel 環境變數</strong>
              <div className="muted">請把 `.env.example` 裡的所有值補到 Vercel 專案。</div>
            </div>
          </div>
          <div className="list-item">
            <div>
              <strong>後台登入</strong>
              <div className="muted">後台登入已改用真實 Supabase Auth 管理員帳號。</div>
            </div>
          </div>
          <div className="list-item">
            <div>
              <strong>回調重送</strong>
              <div className="muted">若要從後台重送 callback，請設定 `NEXT_PUBLIC_API_BASE_URL` 與 `JWT_SHARED_SECRET`。</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
