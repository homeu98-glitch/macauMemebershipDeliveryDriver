"use client";

import { useEffect, useMemo, useState } from "react";

type AnnouncementItem = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
};

type MePayload = {
  fullName: string;
  maskedPhone: string;
  approvalStatus: string;
  availability: string;
  acceptedTermsAt: string | null;
  announcements?: AnnouncementItem[];
};

type LegalPayload = {
  disclaimer: string;
  serviceTerms: string;
  acceptedAt: string | null;
  mustAccept: boolean;
};

type EarningsPayload = {
  todayTotal: number;
  weekTotal: number;
  historyTotal: number;
  historyOrders: Array<{
    id: string;
    transactionCode: string | null;
    amountMop: number;
    deliveredAt: string;
    storeName: string;
  }>;
};

type LeaderboardEntry = {
  rank?: number;
  driverName?: string;
  driver_name?: string;
  amountMop?: number;
  amount_mop?: number;
  orderCount?: number;
  order_count?: number;
};

type LeaderboardPayload = {
  entries?: LeaderboardEntry[];
  leaderboard?: LeaderboardEntry[];
  rows?: LeaderboardEntry[];
  currentDriver?: LeaderboardEntry | null;
  me?: LeaderboardEntry | null;
};

function labelApprovalStatus(value: string | null | undefined) {
  switch ((value ?? "").toLowerCase()) {
    case "approved":
      return "已核准";
    case "pending_review":
    case "pending":
      return "待審核";
    case "rejected":
      return "未通過";
    case "suspended":
      return "已停用";
    default:
      return value ?? "-";
  }
}

function labelAvailability(value: string | null | undefined) {
  switch ((value ?? "").toLowerCase()) {
    case "online":
      return "上線";
    case "offline":
      return "離線";
    default:
      return value ?? "-";
  }
}

function firstAnnouncement(items: AnnouncementItem[] | undefined) {
  const first = (items ?? [])[0];
  if (!first) return { title: "車手公告", content: "暫時沒有新的車手公告。" };
  return {
    title: first.title?.trim() ? first.title : "車手公告",
    content: (first.content ?? "").trim() || "暫時沒有新的車手公告。"
  };
}

export function DriverProfileClient() {
  const [me, setMe] = useState<MePayload | null>(null);
  const [legal, setLegal] = useState<LegalPayload | null>(null);
  const [earnings, setEarnings] = useState<EarningsPayload | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardPayload | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    fetch("/api/driver/me", { cache: "no-store" }).then((res) => res.json()).then((payload) => setMe(payload as MePayload)).catch(() => undefined);
    fetch("/api/driver/legal", { cache: "no-store" }).then((res) => res.json()).then((payload) => setLegal(payload as LegalPayload)).catch(() => undefined);
    fetch("/api/driver/earnings", { cache: "no-store" }).then((res) => res.json()).then((payload) => setEarnings(payload as EarningsPayload)).catch(() => undefined);
    fetch("/api/driver/leaderboard", { cache: "no-store" }).then((res) => res.json()).then((payload) => setLeaderboard(payload as LeaderboardPayload)).catch(() => undefined);
  }, []);

  async function logout() {
    await fetch("/api/driver/auth/logout", { method: "POST" });
    window.location.href = "/driver/login";
  }

  async function updatePassword() {
    if (!/^\d{4}$/.test(password)) {
      window.alert("請輸入 4 位數字新密碼。");
      return;
    }
    if (password !== confirmPassword) {
      window.alert("兩次輸入的新密碼不一致。");
      return;
    }
    setSavingPassword(true);
    try {
      const response = await fetch("/api/driver/me/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        window.alert(payload.message ?? "更改密碼失敗。");
        return;
      }
      setPassword("");
      setConfirmPassword("");
      window.alert("密碼已更新。");
    } catch {
      window.alert("更改密碼失敗。");
    } finally {
      setSavingPassword(false);
    }
  }

  const announcement = useMemo(() => firstAnnouncement(me?.announcements), [me?.announcements]);
  const leaderboardRows = (leaderboard?.entries ?? leaderboard?.leaderboard ?? leaderboard?.rows ?? []).slice(0, 5);
  const myRank = leaderboard?.currentDriver ?? leaderboard?.me ?? null;

  return (
    <div className="stack gap-4 profile-page-wrap">
      <section className="android-card stack gap-3 profile-section">
        <div className="driver-screen-title">我的資料</div>
        <div><strong>{me?.fullName ?? "未登入"}</strong></div>
        <div className="muted">電話：{me?.maskedPhone ?? "-"}</div>
        <div className="muted">狀態：{labelApprovalStatus(me?.approvalStatus)}</div>
        <div className="muted">接單：{labelAvailability(me?.availability)}</div>
      </section>

      <section className="android-card stack gap-3 profile-section">
        <div className="driver-section-title">車手公告</div>
        <div className="driver-notice-card">
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{announcement.title}</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{announcement.content}</div>
        </div>
      </section>

      <section className="android-card stack gap-3 profile-section">
        <div className="driver-section-title">收入記錄</div>
        <div className="profile-summary-grid">
          <div className="profile-summary-card"><span>今日收入</span><strong>MOP {(earnings?.todayTotal ?? 0).toFixed(1)}</strong></div>
          <div className="profile-summary-card"><span>本週收入</span><strong>MOP {(earnings?.weekTotal ?? 0).toFixed(1)}</strong></div>
          <div className="profile-summary-card"><span>累計收入</span><strong>MOP {(earnings?.historyTotal ?? 0).toFixed(1)}</strong></div>
        </div>
        <div className="stack gap-2">
          {(earnings?.historyOrders ?? []).slice(0, 5).map((item) => (
            <div className="driver-list-row" key={item.id}>
              <div className="stack gap-1 grow minw-0">
                <div className="order-subvalue tight">{item.transactionCode ?? item.id}</div>
                <div className="muted small-text">{item.storeName} · {item.deliveredAt}</div>
              </div>
              <div className="money-chip compact">MOP {item.amountMop.toFixed(1)}</div>
            </div>
          ))}
          {(earnings?.historyOrders ?? []).length === 0 ? <div className="muted">暫時沒有收入記錄。</div> : null}
        </div>
      </section>

      <section className="android-card stack gap-3 profile-section">
        <div className="driver-section-title">更改密碼</div>
        <label className="driver-field compact-field">
          <span>新密碼（4 位數字）</span>
          <input inputMode="numeric" maxLength={4} onChange={(event) => setPassword(event.target.value.replace(/\D/g, "").slice(0, 4))} type="password" value={password} />
        </label>
        <label className="driver-field compact-field">
          <span>確認新密碼</span>
          <input inputMode="numeric" maxLength={4} onChange={(event) => setConfirmPassword(event.target.value.replace(/\D/g, "").slice(0, 4))} type="password" value={confirmPassword} />
        </label>
        <button className="android-primary-btn" disabled={savingPassword} onClick={updatePassword} style={{ marginTop: 8 }} type="button">{savingPassword ? "處理中..." : "更改密碼"}</button>
      </section>

      <section className="android-card stack gap-3 profile-section">
        <div className="driver-section-title">車手排名</div>
        {myRank ? (
          <div className="driver-notice-card">
            我的排名：#{myRank.rank ?? "-"} · {myRank.driverName ?? myRank.driver_name ?? me?.fullName ?? "我"}
          </div>
        ) : null}
        <div className="stack gap-2">
          {leaderboardRows.map((entry, index) => (
            <div className="driver-list-row" key={`${entry.driverName ?? entry.driver_name ?? "driver"}-${index}`}>
              <div className="stack gap-1 grow minw-0">
                <div className="order-subvalue tight">#{entry.rank ?? index + 1} {entry.driverName ?? entry.driver_name ?? "未命名車手"}</div>
                <div className="muted small-text">完成 {entry.orderCount ?? entry.order_count ?? 0} 單</div>
              </div>
              <div className="money-chip compact">MOP {Number(entry.amountMop ?? entry.amount_mop ?? 0).toFixed(1)}</div>
            </div>
          ))}
          {leaderboardRows.length === 0 ? <div className="muted">暫時沒有排名資料。</div> : null}
        </div>
      </section>

      <section className="android-card stack gap-3 profile-section">
        <div className="muted">條款同意時間：{legal?.acceptedAt ?? "尚未同意"}</div>
        <details className="driver-detail-box"><summary>免責條款</summary><div className="driver-legal-scroll small">{legal?.disclaimer ?? "目前沒有內容。"}</div></details>
        <details className="driver-detail-box"><summary>服務條款與隱私政策</summary><div className="driver-legal-scroll small">{legal?.serviceTerms ?? "目前沒有內容。"}</div></details>
      </section>

      <section className="android-card stack gap-3 profile-section">
        <button className="android-danger-btn" onClick={logout} type="button">登出</button>
      </section>
    </div>
  );
}
