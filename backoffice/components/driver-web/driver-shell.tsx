"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type LegalState = { serviceTerms: string; mustAccept: boolean };

const navItems = [
  { href: "/driver/home", label: "首頁" },
  { href: "/driver/orders", label: "訂單" },
  { href: "/driver/completed", label: "完成" },
  { href: "/driver/profile", label: "我的" }
];

export function DriverShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [legalState, setLegalState] = useState<LegalState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const plainMode = useMemo(() => pathname === "/driver/login" || pathname === "/driver/register" || pathname === "/driver/install" || pathname.startsWith("/driver/pending"), [pathname]);

  useEffect(() => {
    if (plainMode) return;
    let active = true;
    fetch("/api/driver/legal", { cache: "no-store" })
      .then(async (res) => (res.ok ? ((await res.json()) as LegalState) : null))
      .then((data) => {
        if (active && data) setLegalState(data);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [plainMode, pathname]);

  async function acceptLegal() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/driver/legal/accept", { method: "POST" });
      if (!res.ok) throw new Error("accept_failed");
      setLegalState((prev) => (prev ? { ...prev, mustAccept: false } : prev));
    } catch {
      window.alert("同意條款失敗，請稍後再試。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {plainMode ? (
        <div className="driver-plain-layout"><div className="driver-auth-wrap">{children}</div></div>
      ) : (
        <div className="driver-mobile-shell android-like-shell no-top-copy-shell">
          <main className="driver-mobile-main">{children}</main>
          <nav className="driver-bottom-nav android-like-bottom-nav">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return <Link key={item.href} href={item.href} className={active ? "driver-nav-item active" : "driver-nav-item"}><span>{item.label}</span></Link>;
            })}
          </nav>
        </div>
      )}
      {legalState?.mustAccept ? (
        <div className="driver-modal-backdrop">
          <div className="driver-modal-card">
            <h2>服務條款與隱私政策</h2>
            <div className="driver-legal-scroll">{legalState.serviceTerms || "目前尚未設定內容。"}</div>
            <button className="android-primary-btn" type="button" disabled={submitting} onClick={acceptLegal}>{submitting ? "處理中..." : "同意並繼續"}</button>
          </div>
        </div>
      ) : null}
    </>
  );
}
