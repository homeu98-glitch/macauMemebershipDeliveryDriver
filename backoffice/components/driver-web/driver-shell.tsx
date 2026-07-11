"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type LegalState = { serviceTerms: string; mustAccept: boolean };

const navItems = [
  { href: "/driver/home", label: "首頁" },
  { href: "/driver/orders", label: "進行中" },
  { href: "/driver/completed", label: "已完成" },
  { href: "/driver/earnings", label: "收益" },
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
    return () => {
      active = false;
    };
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
        <div className="driver-plain-layout">{children}</div>
      ) : (
        <div className="driver-mobile-shell">
          <header className="driver-mobile-header">
            <div className="driver-mobile-title">車手工作台</div>
            <div className="driver-mobile-subtitle">保持頁面開啟，接單會更穩定</div>
          </header>
          <main className="driver-mobile-main">{children}</main>
          <nav className="driver-bottom-nav">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link key={item.href} href={item.href} className={active ? "driver-nav-item active" : "driver-nav-item"}>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      )}
      {legalState?.mustAccept ? (
        <div className="driver-modal-backdrop">
          <div className="driver-modal-card">
            <h2>服務條款與隱私政策</h2>
            <div className="driver-legal-scroll">{legalState.serviceTerms || "目前尚未設定內容。"}</div>
            <button className="btn-primary" type="button" disabled={submitting} onClick={acceptLegal}>
              {submitting ? "處理中..." : "同意並繼續"}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
