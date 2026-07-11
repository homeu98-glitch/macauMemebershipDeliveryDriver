"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type LegalState = { serviceTerms: string; mustAccept: boolean };

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice?: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const navItems = [
  { href: "/driver/home", label: "首頁" },
  { href: "/driver/orders", label: "訂單" },
  { href: "/driver/completed", label: "完成" },
  { href: "/driver/profile", label: "我的" }
];

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)")?.matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function DriverShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [legalState, setLegalState] = useState<LegalState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [hideInstallBanner, setHideInstallBanner] = useState(false);
  const plainMode = useMemo(() => pathname === "/driver/login" || pathname === "/driver/register" || pathname === "/driver/install" || pathname.startsWith("/driver/pending"), [pathname]);

  useEffect(() => {
    try {
      const dismissed = window.localStorage.getItem("driver-pwa-install-dismissed");
      const installed = window.localStorage.getItem("driver-pwa-installed");
      setHideInstallBanner(dismissed === "1" || installed === "1");
    } catch {
      setHideInstallBanner(false);
    }
  }, []);

  useEffect(() => {
    setStandalone(isStandaloneMode());

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/driver-sw.js").catch(() => undefined);
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onModeChange = () => setStandalone(isStandaloneMode());
    const onAppInstalled = () => {
      setStandalone(true);
      setHideInstallBanner(true);
      setInstallPromptEvent(null);
      try {
        window.localStorage.setItem("driver-pwa-installed", "1");
        window.localStorage.setItem("driver-pwa-installed-at", new Date().toISOString());
      } catch {}
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    window.matchMedia?.("(display-mode: standalone)")?.addEventListener?.("change", onModeChange);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      window.matchMedia?.("(display-mode: standalone)")?.removeEventListener?.("change", onModeChange);
    };
  }, []);

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

  async function triggerInstall() {
    if (installPromptEvent) {
      await installPromptEvent.prompt();
      const result = await installPromptEvent.userChoice;
      if (result?.outcome === "accepted") {
        setHideInstallBanner(true);
        try {
          window.localStorage.setItem("driver-pwa-install-accepted", "1");
        } catch {}
      }
      if (result?.outcome === "dismissed") {
        try {
          window.localStorage.setItem("driver-pwa-install-dismissed", "1");
        } catch {}
      }
      return;
    }
    window.location.href = "/driver/install";
  }

  function dismissInstallBanner() {
    setHideInstallBanner(true);
    try {
      window.localStorage.setItem("driver-pwa-install-dismissed", "1");
    } catch {}
  }

  const showInstallBanner = !plainMode && !standalone && !hideInstallBanner;

  return (
    <>
      {plainMode ? (
        <div className="driver-plain-layout"><div className="driver-auth-wrap">{children}</div></div>
      ) : (
        <div className="driver-mobile-shell android-like-shell no-top-copy-shell">
          {showInstallBanner ? (
            <div className="driver-install-banner">
              <div className="stack gap-1 grow">
                <div className="install-banner-title">可安裝到主畫面</div>
                <div className="install-banner-copy">安裝後會直接從首頁打開，並以獨立 App 模式運行。如你以前裝過舊捷徑，請先刪除舊圖示再重新安裝。</div>
              </div>
              <div className="install-banner-actions">
                <button className="install-banner-btn" onClick={triggerInstall} type="button">安裝</button>
                <button className="install-banner-close" onClick={dismissInstallBanner} type="button">稍後</button>
              </div>
            </div>
          ) : null}
          <main className="driver-mobile-main">{children}</main>
          <nav className="driver-bottom-nav web-floating-nav" aria-label="Driver navigation">
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
