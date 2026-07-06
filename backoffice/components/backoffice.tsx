"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import type { CallbackLog, IncomingCallbackReceipt, Metric, Order, PushTokenRegistration, Rider, RiderApplication, SettingRow } from "../lib/data";
import type { SessionUser } from "../lib/auth";

const navItems = [
  { href: "/dashboard", label: "儀表板" },
  { href: "/testing", label: "建立測試訂單" },
  { href: "/push-tokens", label: "推播裝置" },
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

function canShopConfirm(rawStatus: string) {
  return !["delivered", "canceled", "failed"].includes(rawStatus);
}

function canAdminCancel(rawStatus: string) {
  return !["delivered", "canceled", "failed"].includes(rawStatus);
}

function canShopOwnerConfirmDriverCancel(rawStatus: string, alreadyConfirmed?: string | null) {
  return rawStatus === "canceled" && !alreadyConfirmed;
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
  const [quickCreateBusy, setQuickCreateBusy] = useState<number | null>(null);
  const [quickCreateMessage, setQuickCreateMessage] = useState("");
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

  async function handleQuickCreateOrders(count: number) {
    setQuickCreateBusy(count);
    setQuickCreateMessage("");

    try {
      const response = await fetch("/api/testing/random-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count })
      });

      const payload = (await response.json()) as {
        message?: string;
        created?: Array<{ externalOrderId: string; siteBOrderId: string; status: string }>;
      };

      if (!response.ok) {
        throw new Error(payload.message ?? "建立測試訂單失敗。");
      }

      setQuickCreateMessage(`已建立 ${payload.created?.length ?? 0} 筆測試訂單。`);
      router.refresh();
    } catch (error) {
      setQuickCreateMessage(error instanceof Error ? error.message : "建立測試訂單失敗。");
    } finally {
      setQuickCreateBusy(null);
    }
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
          <div className="header-copy">
            <div className="eyebrow">營運後台</div>
            <h1 className="page-title">騎手審核、訂單監控與回調處理</h1>
            <p className="page-subtitle">
              使用真實 Supabase 資料管理騎手帳號、查看訂單流轉與重試 callback。
            </p>
            {quickCreateMessage ? <div className="hint">{quickCreateMessage}</div> : null}
          </div>

          <div className="header-actions">
            <div className="header-quick-actions">
              <button
                className="btn btn-primary"
                disabled={quickCreateBusy !== null}
                onClick={() => handleQuickCreateOrders(1)}
                type="button"
              >
                {quickCreateBusy === 1 ? "建立中..." : "建立 1 筆"}
              </button>
              <button
                className="btn btn-secondary"
                disabled={quickCreateBusy !== null}
                onClick={() => handleQuickCreateOrders(5)}
                type="button"
              >
                {quickCreateBusy === 5 ? "建立中..." : "建立 5 筆"}
              </button>
              <Link className="btn btn-secondary" href="/testing">
                建立測試訂單
              </Link>
            </div>
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
  const [account, setAccount] = useState("");
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
        body: JSON.stringify({ account, password })
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
        <label htmlFor="account">管理員帳號</label>
        <input
          id="account"
          autoComplete="username"
          onChange={(event) => setAccount(event.target.value)}
          placeholder="63936541"
          required
          type="text"
          value={account}
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
                      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {application.documents.map((doc) =>
                          doc.url ? (
                            <a
                              key={`${application.id}-${doc.type}`}
                              className="btn btn-secondary"
                              href={doc.url}
                              target="_blank"
                              rel="noreferrer"
                              style={{ padding: "6px 10px", fontSize: 12 }}
                            >
                              查看{doc.label}
                            </a>
                          ) : (
                            <span
                              key={`${application.id}-${doc.type}`}
                              className="badge badge-warning"
                              style={{ fontSize: 12 }}
                            >
                              缺少{doc.label}
                            </span>
                          )
                        )}
                      </div>
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
  const router = useRouter();
  const [busyAction, setBusyAction] = useState<string | null>(null);

  async function runOrderAction(orderId: string, action: "shop-confirm" | "cancel") {
    const actionLabel = action === "shop-confirm" ? "確認訂單" : "取消訂單";
    if (action === "cancel" && !window.confirm("確定要取消這張訂單嗎？")) {
      return;
    }

    setBusyAction(`${orderId}:${action}`);
    try {
      const response = await fetch(`/api/orders/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body:
          action === "cancel"
            ? JSON.stringify({ orderId, reason: "backoffice_manual_cancel" })
            : JSON.stringify({ orderId })
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? `${actionLabel}失敗。`);
      }
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : `${actionLabel}失敗。`);
    } finally {
      setBusyAction(null);
    }
  }

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
                <th>操作</th>
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
                  <td>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {canShopConfirm(order.rawStatus) ? (
                        <button
                          className="btn btn-secondary"
                          disabled={busyAction === `${order.id}:shop-confirm`}
                          onClick={() => runOrderAction(order.id, "shop-confirm")}
                          type="button"
                        >
                          {busyAction === `${order.id}:shop-confirm` ? "確認中..." : "商戶確認"}
                        </button>
                      ) : null}
                      {canAdminCancel(order.rawStatus) ? (
                        <button
                          className="btn btn-secondary"
                          disabled={busyAction === `${order.id}:cancel`}
                          onClick={() => runOrderAction(order.id, "cancel")}
                          type="button"
                        >
                          {busyAction === `${order.id}:cancel` ? "取消中..." : "取消訂單"}
                        </button>
                      ) : null}
                    </div>
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

export function OrderDetailActions({
  orderId,
  rawStatus,
  shopOwnerCancelConfirmedAt
}: {
  orderId: string;
  rawStatus: string;
  shopOwnerCancelConfirmedAt?: string | null;
}) {
  const router = useRouter();
  const [busyAction, setBusyAction] = useState<"shop-confirm" | "cancel" | "shop-owner-cancel-confirm" | null>(null);

  async function runOrderAction(action: "shop-confirm" | "cancel" | "shop-owner-cancel-confirm") {
    const actionLabel =
      action === "shop-confirm"
        ? "確認訂單"
        : action === "shop-owner-cancel-confirm"
          ? "商戶確認取消"
          : "取消訂單";
    if (action === "cancel" && !window.confirm("確定要取消這張訂單嗎？")) {
      return;
    }

    setBusyAction(action);
    try {
      const response = await fetch(`/api/orders/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body:
          action === "cancel"
            ? JSON.stringify({ orderId, reason: "backoffice_manual_cancel" })
            : JSON.stringify({ orderId })
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? `${actionLabel}失敗。`);
      }
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : `${actionLabel}失敗。`);
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {canShopConfirm(rawStatus) ? (
        <button
          className="btn btn-secondary"
          disabled={busyAction !== null}
          onClick={() => runOrderAction("shop-confirm")}
          type="button"
        >
          {busyAction === "shop-confirm" ? "確認中..." : "商戶確認"}
        </button>
      ) : null}
      {canAdminCancel(rawStatus) ? (
        <button
          className="btn btn-secondary"
          disabled={busyAction !== null}
          onClick={() => runOrderAction("cancel")}
          type="button"
        >
          {busyAction === "cancel" ? "取消中..." : "取消訂單"}
        </button>
      ) : null}
      {canShopOwnerConfirmDriverCancel(rawStatus, shopOwnerCancelConfirmedAt) ? (
        <button
          className="btn btn-secondary"
          disabled={busyAction !== null}
          onClick={() => runOrderAction("shop-owner-cancel-confirm")}
          type="button"
        >
          {busyAction === "shop-owner-cancel-confirm" ? "確認中..." : "商戶確認取消"}
        </button>
      ) : null}
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

export function PushTokensBoard({
  tokens
}: {
  tokens: PushTokenRegistration[];
}) {
  return (
    <div className="section-stack">
      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">已註冊推播裝置</h2>
            <p className="muted">只有在這裡出現的騎手裝置，後台才能真正收到 Firebase 推播。</p>
          </div>
          <span className={getBadgeClass(tokens.length ? "positive" : "warning")}>
            {tokens.length} 台裝置
          </span>
        </div>

        {!tokens.length ? (
          <EmptyState text="目前尚未收到任何騎手裝置的 FCM token。請先安裝新 APK 並登入一次。" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>騎手</th>
                  <th>電話</th>
                  <th>平台</th>
                  <th>裝置</th>
                  <th>App 版本</th>
                  <th>最後回報</th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((token) => (
                  <tr key={token.id}>
                    <td><strong>{token.riderName}</strong></td>
                    <td>{token.phone}</td>
                    <td>
                      <span className={getBadgeClass("positive")}>{token.platform}</span>
                    </td>
                    <td>{token.deviceLabel}</td>
                    <td>{token.appVersion}</td>
                    <td>{token.lastSeenAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export function DashboardCreateOrderPanel() {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  async function generateRandomOrders(count: number) {
    setBusy(count);
    setMessage("");

    try {
      const response = await fetch("/api/testing/random-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count })
      });

      const payload = (await response.json()) as {
        message?: string;
        created?: Array<{ externalOrderId: string; siteBOrderId: string; status: string }>;
      };

      if (!response.ok) {
        throw new Error(payload.message ?? "建立測試訂單失敗。");
      }

      setMessage(`已成功建立 ${payload.created?.length ?? 0} 筆測試訂單。`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "建立測試訂單失敗。");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card">
      <div className="card-header">
        <div>
          <h2 className="card-title">建立測試訂單</h2>
          <p className="muted">直接在首頁建立測試工單，立即驗證接單、推播與 callback 流程。</p>
        </div>
      </div>

      <div className="btn-row">
        <button
          className="btn btn-primary"
          disabled={busy !== null}
          onClick={() => generateRandomOrders(1)}
          type="button"
        >
          {busy === 1 ? "建立中..." : "建立 1 筆測試訂單"}
        </button>
        <button
          className="btn btn-secondary"
          disabled={busy !== null}
          onClick={() => generateRandomOrders(5)}
          type="button"
        >
          {busy === 5 ? "建立中..." : "建立 5 筆測試訂單"}
        </button>
        <Link className="btn btn-secondary" href="/testing">
          打開完整測試頁
        </Link>
      </div>

      {message ? (
        <div
          style={{
            marginTop: 16,
            padding: "12px 14px",
            borderRadius: 14,
            background: "rgba(96, 165, 250, 0.10)",
            color: "#dbeafe"
          }}
        >
          {message}
        </div>
      ) : null}
    </section>
  );
}

export function BackofficeTestingPanel({ receipts = [] }: { receipts?: IncomingCallbackReceipt[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [pushBusy, setPushBusy] = useState(false);
  const [pushPhone, setPushPhone] = useState("63936541");
  const [pushTitle, setPushTitle] = useState("測試推播");
  const [pushBody, setPushBody] = useState("這是一則從配送後台送出的測試通知。");
  const [createdOrders, setCreatedOrders] = useState<
    Array<{ externalOrderId: string; siteBOrderId: string; status: string }>
  >([]);

  async function generateRandomOrders(count: number) {
    setBusy(count);
    setMessage("");

    try {
      const response = await fetch("/api/testing/random-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count })
      });

      const payload = (await response.json()) as {
        message?: string;
        created?: Array<{ externalOrderId: string; siteBOrderId: string; status: string }>;
      };

      if (!response.ok) {
        throw new Error(payload.message ?? "建立測試訂單失敗。");
      }

      setCreatedOrders(payload.created ?? []);
      setMessage(`已成功建立 ${payload.created?.length ?? 0} 筆測試訂單。`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "建立測試訂單失敗。");
    } finally {
      setBusy(null);
    }
  }

  async function sendTestPush() {
    setPushBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/testing/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: pushPhone,
          title: pushTitle,
          message: pushBody,
        }),
      });

      const payload = (await response.json()) as {
        message?: string;
        driverName?: string;
        successCount?: number;
        failureCount?: number;
      };

      if (!response.ok) {
        throw new Error(payload.message ?? "發送測試推播失敗。");
      }

      setMessage(
        `已向 ${payload.driverName ?? pushPhone} 發送測試推播，成功 ${payload.successCount ?? 0}，失敗 ${payload.failureCount ?? 0}。`
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "發送測試推播失敗。");
    } finally {
      setPushBusy(false);
    }
  }

  return (
    <div className="section-stack">
      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">快速建立測試訂單</h2>
            <p className="muted">
              直接寫入真實資料表，模擬 SiteA 傳入的新工單，方便先測試騎手 app、後台與 callback 流程。
            </p>
          </div>
        </div>

        <div className="btn-row">
          <button
            className="btn btn-primary"
            disabled={busy !== null}
            onClick={() => generateRandomOrders(1)}
            type="button"
          >
            {busy === 1 ? "建立中..." : "建立 1 筆"}
          </button>
          <button
            className="btn btn-secondary"
            disabled={busy !== null}
            onClick={() => generateRandomOrders(5)}
            type="button"
          >
            {busy === 5 ? "建立中..." : "建立 5 筆"}
          </button>
        </div>

        <div className="muted" style={{ marginTop: 14 }}>
          這些工單會帶入隨機商戶、客戶、金額、送達時間，並把 callback 指向目前後台的
          <code style={{ marginLeft: 6 }}>/api/integration/delivery/siteb/callback</code>，刷新後可在訂單管理、rider app 與下方接收紀錄中看到。
        </div>

        {message ? (
          <div
            style={{
              marginTop: 16,
              padding: "12px 14px",
              borderRadius: 14,
              background: "rgba(96, 165, 250, 0.10)",
              color: "#dbeafe"
            }}
          >
            {message}
          </div>
        ) : null}
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">最近收到的 SiteB 回調</h2>
            <p className="muted">這個後台現在可以模擬 SiteA 接收 webhook，收到後會立即回覆 200 並記錄在這裡。</p>
          </div>
        </div>

        {!receipts.length ? (
          <EmptyState text="暫時未收到任何 callback。" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>事件</th>
                  <th>外部訂單號</th>
                  <th>狀態</th>
                  <th>時間</th>
                  <th>摘要</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.event}</strong>
                      <div className="muted">{item.id}</div>
                    </td>
                    <td>{item.externalOrderId}</td>
                    <td>
                      <span className={getBadgeClass(item.status === "received" ? "positive" : "danger")}>
                        {item.status === "received" ? "已收到" : "已拒絕"}
                      </span>
                    </td>
                    <td>{item.receivedAt}</td>
                    <td>{item.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">推播測試</h2>
            <p className="muted">
              對指定騎手發送真實 Firebase 推播。請先用 app 登入一次，讓裝置把 FCM token 註冊到後台。
            </p>
          </div>
        </div>

        <div className="grid two-column">
          <div className="field">
            <label htmlFor="push-phone">騎手電話</label>
            <input
              id="push-phone"
              onChange={(event) => setPushPhone(event.target.value)}
              placeholder="63936541"
              value={pushPhone}
            />
          </div>
          <div className="field">
            <label htmlFor="push-title">通知標題</label>
            <input
              id="push-title"
              onChange={(event) => setPushTitle(event.target.value)}
              placeholder="測試推播"
              value={pushTitle}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="push-body">通知內容</label>
          <textarea
            id="push-body"
            onChange={(event) => setPushBody(event.target.value)}
            placeholder="這是一則測試通知。"
            rows={3}
            value={pushBody}
          />
        </div>

        <div className="btn-row">
          <button
            className="btn btn-primary"
            disabled={pushBusy}
            onClick={sendTestPush}
            type="button"
          >
            {pushBusy ? "發送中..." : "發送測試推播"}
          </button>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">最近建立的測試訂單</h2>
            <p className="muted">方便你立刻到 app 或訂單頁面核對資料。</p>
          </div>
        </div>

        {!createdOrders.length ? (
          <EmptyState text="尚未建立新的測試訂單。" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>外部訂單編號</th>
                  <th>SiteB 訂單 ID</th>
                  <th>狀態</th>
                </tr>
              </thead>
              <tbody>
                {createdOrders.map((order) => (
                  <tr key={order.siteBOrderId}>
                    <td>
                      <strong>{order.externalOrderId}</strong>
                    </td>
                    <td>{order.siteBOrderId}</td>
                    <td>
                      <span className={getBadgeClass(order.status === "new" ? "warning" : "default")}>
                        {translateStatus(order.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
