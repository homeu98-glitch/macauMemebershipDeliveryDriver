"use client";

import { useEffect, useState } from "react";

type MePayload = { fullName: string; maskedPhone: string; approvalStatus: string; availability: string; acceptedTermsAt: string | null; };
type LegalPayload = { disclaimer: string; serviceTerms: string; acceptedAt: string | null; mustAccept: boolean; };

export function DriverProfileClient() {
  const [me, setMe] = useState<MePayload | null>(null);
  const [legal, setLegal] = useState<LegalPayload | null>(null);

  useEffect(() => {
    fetch("/api/driver/me", { cache: "no-store" }).then((res) => res.json()).then((payload) => setMe(payload as MePayload)).catch(() => undefined);
    fetch("/api/driver/legal", { cache: "no-store" }).then((res) => res.json()).then((payload) => setLegal(payload as LegalPayload)).catch(() => undefined);
  }, []);

  async function logout() {
    await fetch("/api/driver/auth/logout", { method: "POST" });
    window.location.href = "/driver/login";
  }

  return (
    <div className="stack gap-4">
      <section className="android-card stack gap-3">
        <div className="driver-screen-title">我的資料</div>
        <div><strong>{me?.fullName ?? "未登入"}</strong></div>
        <div className="muted">電話：{me?.maskedPhone ?? "-"}</div>
        <div className="muted">狀態：{me?.approvalStatus ?? "-"}</div>
        <div className="muted">接單：{me?.availability ?? "-"}</div>
      </section>
      <section className="android-card stack gap-3">
        <div className="muted">條款同意時間：{legal?.acceptedAt ?? "尚未同意"}</div>
        <details className="driver-detail-box"><summary>免責條款</summary><div className="driver-legal-scroll small">{legal?.disclaimer ?? "目前沒有內容。"}</div></details>
        <details className="driver-detail-box"><summary>服務條款與隱私政策</summary><div className="driver-legal-scroll small">{legal?.serviceTerms ?? "目前沒有內容。"}</div></details>
      </section>
      <section className="android-card stack gap-3">
        <a className="android-secondary-btn no-underline" href="https://macau-delivery.vercel.app/apkdownload" rel="noreferrer" target="_blank">手動下載新版本</a>
        <button className="android-danger-btn" onClick={logout} type="button">登出</button>
      </section>
    </div>
  );
}
