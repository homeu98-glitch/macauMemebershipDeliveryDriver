"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type LegalState = { serviceTerms: string; mustAccept: boolean };

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice?: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type DriverSoundKey = "new_order" | "urgent_order" | "customer_hurry" | "order_completed" | "order_cancelled";

const DRIVER_SOUND_PATHS: Record<DriverSoundKey, string> = {
  new_order: "/driver-sounds/new_order.mp3",
  urgent_order: "/driver-sounds/urgent_order.mp3",
  customer_hurry: "/driver-sounds/customer_hurry.mp3",
  order_completed: "/driver-sounds/order_completed.mp3",
  order_cancelled: "/driver-sounds/order_cancelled.mp3"
};

const navItems = [
  { href: "/driver/home", label: "首頁", icon: "home" },
  { href: "/driver/orders", label: "訂單", icon: "orders" },
  { href: "/driver/completed", label: "完成", icon: "completed" },
  { href: "/driver/notifications", label: "通知", icon: "notifications" },
  { href: "/driver/profile", label: "我的", icon: "profile" }
] as const;

function NavIcon({ type, active }: { type: (typeof navItems)[number]["icon"]; active: boolean }) {
  const stroke = active ? "currentColor" : "currentColor";
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", xmlns: "http://www.w3.org/2000/svg" };
  if (type === "home") {
    return <svg {...common}><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1v-9.5Z" stroke={stroke} strokeWidth="2" strokeLinejoin="round" /></svg>;
  }
  if (type === "orders") {
    return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="2" stroke={stroke} strokeWidth="2"/><path d="M8 9h8M8 13h8M8 17h5" stroke={stroke} strokeWidth="2" strokeLinecap="round"/></svg>;
  }
  if (type === "completed") {
    return <svg {...common}><circle cx="12" cy="12" r="8" stroke={stroke} strokeWidth="2"/><path d="m8.5 12 2.2 2.2 4.8-5.2" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
  }
  if (type === "notifications") {
    return <svg {...common}><path d="M12 5a4 4 0 0 0-4 4v2.4c0 .5-.18.98-.5 1.36L6.4 14.1A1 1 0 0 0 7.16 15.8h9.68a1 1 0 0 0 .76-1.7l-1.1-1.34a2.1 2.1 0 0 1-.5-1.36V9a4 4 0 0 0-4-4Z" stroke={stroke} strokeWidth="2" strokeLinejoin="round"/><path d="M10 18a2 2 0 0 0 4 0" stroke={stroke} strokeWidth="2" strokeLinecap="round"/></svg>;
  }
  return <svg {...common}><circle cx="12" cy="8" r="3.5" stroke={stroke} strokeWidth="2"/><path d="M5 19c1.8-3 4.2-4.5 7-4.5s5.2 1.5 7 4.5" stroke={stroke} strokeWidth="2" strokeLinecap="round"/></svg>;
}

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
  const audioUnlockedRef = useRef(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
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
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/driver-sw.js").catch(() => undefined);

    const unlockAudio = () => {
      audioUnlockedRef.current = true;
    };

    const playSoundByKey = (soundKey: string | undefined) => {
      if (!audioUnlockedRef.current) return;
      if (typeof window === "undefined" || typeof window.Audio === "undefined") return;
      const key = (soundKey && soundKey in DRIVER_SOUND_PATHS ? soundKey : "new_order") as DriverSoundKey;
      const src = DRIVER_SOUND_PATHS[key];
      try {
        if (currentAudioRef.current) {
          currentAudioRef.current.pause();
          currentAudioRef.current.currentTime = 0;
        }
        const audio = new window.Audio(src);
        audio.preload = "auto";
        currentAudioRef.current = audio;
        void audio.play().catch(() => undefined);
      } catch {
        // ignore audio runtime issues on unsupported browsers
      }
    };

    const onWorkerMessage = (event: MessageEvent) => {
      try {
        if (event.data?.type !== "driver_push_sound") return;
        playSoundByKey(event.data?.soundKey);
      } catch {
        // never let sound handling crash the app
      }
    };

    const onWindowSound = (event: Event) => {
      try {
        const customEvent = event as CustomEvent<{ soundKey?: string }>;
        playSoundByKey(customEvent.detail?.soundKey);
      } catch {
        // ignore custom event errors
      }
    };

    navigator.serviceWorker?.addEventListener?.("message", onWorkerMessage);
    window.addEventListener("driver_play_sound", onWindowSound as EventListener);
    window.addEventListener("pointerdown", unlockAudio, { passive: true });
    window.addEventListener("touchstart", unlockAudio, { passive: true });

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
      navigator.serviceWorker?.removeEventListener?.("message", onWorkerMessage);
      window.removeEventListener("driver_play_sound", onWindowSound as EventListener);
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
      try {
        currentAudioRef.current?.pause();
      } catch {}
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      window.matchMedia?.("(display-mode: standalone)")?.removeEventListener?.("change", onModeChange);
    };
  }, []);

  useEffect(() => {
    if (plainMode) return;
    let active = true;
    fetch("/api/driver/legal", { cache: "no-store" }).then(async (res) => (res.ok ? ((await res.json()) as LegalState) : null)).then((data) => {
      if (active && data) setLegalState(data);
    }).catch(() => undefined);
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

  async function triggerInstall() {
    if (installPromptEvent) {
      await installPromptEvent.prompt();
      const result = await installPromptEvent.userChoice;
      if (result?.outcome === "accepted") {
        setHideInstallBanner(true);
        try { window.localStorage.setItem("driver-pwa-install-accepted", "1"); } catch {}
      }
      if (result?.outcome === "dismissed") {
        try { window.localStorage.setItem("driver-pwa-install-dismissed", "1"); } catch {}
      }
      return;
    }
    window.location.href = "/driver/install";
  }

  function dismissInstallBanner() {
    setHideInstallBanner(true);
    try { window.localStorage.setItem("driver-pwa-install-dismissed", "1"); } catch {}
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
              return (
                <Link key={item.href} href={item.href} className={active ? "driver-nav-item active" : "driver-nav-item"}>
                  <span className="driver-nav-icon"><NavIcon type={item.icon} active={active} /></span>
                  <span className="driver-nav-label">{item.label}</span>
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
            <button className="android-primary-btn" type="button" disabled={submitting} onClick={acceptLegal}>{submitting ? "處理中..." : "同意並繼續"}</button>
          </div>
        </div>
      ) : null}
    </>
  );
}
