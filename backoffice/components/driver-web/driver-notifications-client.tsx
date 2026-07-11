"use client";

import { useEffect, useState } from "react";

export function DriverNotificationsClient() {
  const [permission, setPermission] = useState<NotificationPermission>(typeof Notification === "undefined" ? "default" : Notification.permission);
  const [swReady, setSwReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/driver-sw.js").then(() => setSwReady(true)).catch(() => setSwReady(false));
  }, []);

  async function requestPermission() {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }

  function sendTest() {
    if (typeof Notification === "undefined" || permission !== "granted") return;
    new Notification("會員配送車手", { body: "這是一則測試通知，之後可用來提示新訂單。" });
  }

  return (
    <div className="stack gap-4">
      <section className="card stack gap-3">
        <h1 className="driver-screen-title">通知</h1>
        <div className="muted">通知權限：{permission}</div>
        <div className="muted">Service Worker：{swReady ? "已註冊" : "未註冊"}</div>
        <button className="btn-primary" onClick={requestPermission} type="button">開啟通知權限</button>
        <button className="btn-secondary" disabled={permission !== "granted"} onClick={sendTest} type="button">發送測試通知</button>
      </section>
      <section className="card stack gap-2">
        <div className="driver-section-title">使用建議</div>
        <div>工作時請保持頁面開啟，並允許通知與聲音提示。</div>
        <div>iPhone 建議從 Safari 加到主畫面後使用。</div>
      </section>
    </div>
  );
}
