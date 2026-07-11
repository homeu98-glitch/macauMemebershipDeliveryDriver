"use client";

import { useEffect, useState } from "react";

type ConfigPayload = {
  supported: boolean;
  vapidPublicKeyConfigured: boolean;
  publicKey: string | null;
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function DriverNotificationsClient() {
  const [permission, setPermission] = useState<NotificationPermission>(typeof Notification === "undefined" ? "default" : Notification.permission);
  const [swReady, setSwReady] = useState(false);
  const [config, setConfig] = useState<ConfigPayload | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/driver/notifications/config", { cache: "no-store" })
      .then((res) => res.json())
      .then((payload) => setConfig(payload as ConfigPayload))
      .catch(() => undefined);

    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/driver-sw.js").then(async (registration) => {
      setSwReady(true);
      const sub = await registration.pushManager.getSubscription();
      setSubscribed(Boolean(sub));
    }).catch(() => setSwReady(false));
  }, []);

  async function requestPermission() {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }

  async function subscribePush() {
    if (!("serviceWorker" in navigator) || !config?.publicKey) {
      setMessage("未配置 Web Push 公鑰，暫時不能正式註冊。");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.publicKey)
      });
      const payload = subscription.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      const response = await fetch("/api/driver/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, deviceLabel: navigator.userAgent })
      });
      if (!response.ok) throw new Error("subscribe_failed");
      setSubscribed(true);
      setMessage("已完成此裝置的通知註冊。");
    } catch {
      setMessage("通知註冊失敗，請檢查瀏覽器支援與權限。");
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribePush() {
    if (!("serviceWorker" in navigator)) return;
    setBusy(true);
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/driver/notifications/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint })
        });
        await subscription.unsubscribe();
      }
      setSubscribed(false);
      setMessage("已取消此裝置的通知註冊。");
    } catch {
      setMessage("取消通知註冊失敗。");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    if (!("serviceWorker" in navigator)) return;
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification("會員配送車手", {
      body: "這是一則測試通知，之後可用來提示新訂單。",
      data: { url: "/driver/home" }
    });
  }

  return (
    <div className="stack gap-4">
      <section className="android-summary-hero stack gap-3">
        <div className="driver-brand-chip">通知</div>
        <div className="driver-hero-heading">把通知打開</div>
        <div className="driver-hero-note">工作時保持頁面開啟，通知與聲音提示會更穩定。</div>
      </section>

      <section className="android-card stack gap-3">
        <div className="driver-status-grid">
          <div className="android-soft-panel"><div className="driver-soft-label">通知權限</div><div>{permission}</div></div>
          <div className="android-soft-panel"><div className="driver-soft-label">Service Worker</div><div>{swReady ? "已註冊" : "未註冊"}</div></div>
          <div className="android-soft-panel"><div className="driver-soft-label">Web Push 公鑰</div><div>{config?.vapidPublicKeyConfigured ? "已配置" : "未配置"}</div></div>
          <div className="android-soft-panel"><div className="driver-soft-label">裝置註冊</div><div>{subscribed ? "已註冊" : "未註冊"}</div></div>
        </div>
        {message ? <div className="android-soft-panel">{message}</div> : null}
        <div className="driver-action-grid">
          <button className="android-primary-btn" onClick={requestPermission} type="button">開啟通知權限</button>
          <button className="android-secondary-btn" disabled={permission !== "granted" || busy || !config?.vapidPublicKeyConfigured} onClick={subscribePush} type="button">{busy ? "處理中..." : "註冊此裝置通知"}</button>
          <button className="android-secondary-btn" disabled={busy || !subscribed} onClick={unsubscribePush} type="button">取消此裝置通知</button>
          <button className="android-secondary-btn" disabled={permission !== "granted"} onClick={sendTest} type="button">發送測試通知</button>
        </div>
      </section>
    </div>
  );
}
