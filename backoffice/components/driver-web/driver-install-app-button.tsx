"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice?: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function DriverInstallAppButton(props: { className?: string }) {
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setInstallPromptEvent(null);
      setInstalling(false);
      try { window.localStorage.setItem("driver-pwa-installed", "1"); } catch {}
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  async function handleInstall() {
    if (installing) return;
    setInstalling(true);
    try {
      if (installPromptEvent) {
        await installPromptEvent.prompt();
        const result = await installPromptEvent.userChoice;
        if (result?.outcome === "accepted") {
          try { window.localStorage.setItem("driver-pwa-install-accepted", "1"); } catch {}
        }
        if (result?.outcome === "dismissed") {
          try { window.localStorage.setItem("driver-pwa-install-dismissed", "1"); } catch {}
        }
      } else {
        window.location.href = "/driver/install";
        return;
      }
    } catch {
      window.location.href = "/driver/install";
      return;
    } finally {
      setInstalling(false);
    }
  }

  return (
    <button className={props.className ?? "android-outline-link"} disabled={installing} onClick={handleInstall} type="button">
      {installing ? "處理中..." : "安裝APP"}
    </button>
  );
}
