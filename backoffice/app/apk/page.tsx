"use client";

import QRCode from "qrcode";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

type DriverApkConfig = {
  apkUrl: string;
  version: string;
  releaseNotes: string;
  updatedAt: string | null;
};

type ConfigResponse = {
  success: boolean;
  message?: string;
  config: DriverApkConfig | null;
  landingPageUrl: string;
  stableDownloadUrl: string;
};

export default function ApkManagerPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const [apkUrl, setApkUrl] = useState("");
  const [version, setVersion] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");

  const origin = useMemo(() => (typeof window === "undefined" ? "" : window.location.origin), []);
  const fallbackLandingPageUrl = origin ? `${origin}/apkdownload` : "";
  const fallbackStableDownloadUrl = origin ? `${origin}/apkdownload/latest` : "";

  const [landingPageUrl, setLandingPageUrl] = useState(fallbackLandingPageUrl);
  const [stableDownloadUrl, setStableDownloadUrl] = useState(fallbackStableDownloadUrl);
  const [currentConfig, setCurrentConfig] = useState<DriverApkConfig | null>(null);

  async function loadConfig() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/apk/config");
      const json = (await response.json()) as ConfigResponse | { message?: string };
      if (!response.ok) {
        throw new Error((json as { message?: string }).message || "載入失敗。");
      }

      const payload = json as ConfigResponse;
      setLandingPageUrl(payload.landingPageUrl || fallbackLandingPageUrl);
      setStableDownloadUrl(payload.stableDownloadUrl || fallbackStableDownloadUrl);
      setCurrentConfig(payload.config);
      setApkUrl(payload.config?.apkUrl || "");
      setVersion(payload.config?.version || "最新版本");
      setReleaseNotes(payload.config?.releaseNotes || "請下載並安裝最新 APK。");
    } catch (e) {
      setError(e instanceof Error ? e.message : "載入失敗。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function updateQr() {
      const url = landingPageUrl || fallbackLandingPageUrl;
      if (!url) return;
      const dataUrl = await QRCode.toDataURL(url, { margin: 1, width: 260 });
      setQrDataUrl(dataUrl);
    }
    void updateQr();
  }, [stableDownloadUrl, fallbackStableDownloadUrl]);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/apk/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apkUrl, version, releaseNotes })
      });

      const json = (await response.json()) as ConfigResponse | { message?: string };
      if (!response.ok) {
        throw new Error((json as { message?: string }).message || "儲存失敗。");
      }

      const payload = json as ConfigResponse;
      setLandingPageUrl(payload.landingPageUrl || fallbackLandingPageUrl);
      setStableDownloadUrl(payload.stableDownloadUrl || fallbackStableDownloadUrl);
      setCurrentConfig(payload.config);
      setMessage("APK 連結已儲存。下載頁與 QR Code 已更新。")
    } catch (e) {
      setError(e instanceof Error ? e.message : "儲存失敗。");
    } finally {
      setSaving(false);
    }
  }

  function copy(text: string) {
    if (!text) return;
    void navigator.clipboard.writeText(text);
  }

  return (
    <div className="section-stack">
      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">安裝設置</h2>
            <p className="muted">把 Supabase Storage 的 APK 連結貼到這裡，系統會自動提供固定下載連結與 QR Code。</p>
          </div>
        </div>

        {error ? <div className="error">{error}</div> : null}
        {message ? <div className="hint">{message}</div> : null}

        <div className="list">
          <div className="list-item">
            <div>
              <strong>下載頁面</strong>
              <div className="muted">建議分享給車手的頁面。</div>
            </div>
            <div className="btn-row">
              <a className="btn btn-secondary" href={landingPageUrl} target="_blank" rel="noreferrer">開啟</a>
              <button className="btn btn-secondary" type="button" onClick={() => copy(landingPageUrl)}>複製連結</button>
            </div>
          </div>

          <div className="list-item">
            <div>
              <strong>直接下載連結（固定）</strong>
              <div className="muted">這個連結永遠不變，只會轉向你最新設定的 APK URL。</div>
            </div>
            <div className="btn-row">
              <a className="btn btn-primary" href={stableDownloadUrl} target="_blank" rel="noreferrer">下載</a>
              <button className="btn btn-secondary" type="button" onClick={() => copy(stableDownloadUrl)}>複製連結</button>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 18, marginTop: 18 }}>
          <strong>QR Code</strong>
          <div className="muted">掃描後會先打開公開下載頁，再由車手按按鈕下載 APK。</div>
          {qrDataUrl ? (
            <div style={{ marginTop: 12, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              <img src={qrDataUrl} alt="Driver APK QR" style={{ width: 220, height: 220, borderRadius: 14, border: "1px solid var(--panel-border)" }} />
              <div className="muted" style={{ maxWidth: 420 }}>
                連結：<span className="code">{landingPageUrl}</span>
              </div>
            </div>
          ) : (
            <div className="muted" style={{ marginTop: 12 }}>正在產生 QR Code…</div>
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">設定 APK 連結</h2>
            <p className="muted">先把 APK 上傳到 Supabase Storage，再把公開連結貼到下面。</p>
          </div>
        </div>

        <form className="list" onSubmit={onSave}>
          <div className="field">
            <label htmlFor="apk-url">APK 直接連結</label>
            <input
              id="apk-url"
              type="url"
              placeholder="https://xxxx.supabase.co/storage/v1/object/public/app-downloads/driver/latest.apk"
              value={apkUrl}
              onChange={(event) => setApkUrl(event.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="apk-version">版本</label>
            <input
              id="apk-version"
              type="text"
              placeholder="例如：1.0.3"
              value={version}
              onChange={(event) => setVersion(event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="apk-notes">更新說明</label>
            <input
              id="apk-notes"
              type="text"
              placeholder="例如：最新 MQTT 版本"
              value={releaseNotes}
              onChange={(event) => setReleaseNotes(event.target.value)}
            />
          </div>

          <div className="btn-row">
            <button className="btn btn-primary" type="submit" disabled={saving || loading}>
              {saving ? "儲存中…" : "儲存設定"}
            </button>
            <button className="btn btn-secondary" type="button" onClick={() => loadConfig()} disabled={saving || loading}>
              {loading ? "載入中…" : "重新讀取"}
            </button>
          </div>
        </form>

        <div className="card" style={{ padding: 18, marginTop: 18 }}>
          <strong>目前設定</strong>
          {loading ? (
            <div className="muted" style={{ marginTop: 8 }}>載入中…</div>
          ) : currentConfig ? (
            <div className="muted" style={{ marginTop: 8 }}>
              版本：<span className="code">{currentConfig.version}</span>
              <br />
              更新說明：{currentConfig.releaseNotes}
              <br />
              APK URL：<a href={currentConfig.apkUrl} target="_blank" rel="noreferrer">{currentConfig.apkUrl}</a>
              <br />
              最後更新：{currentConfig.updatedAt || "-"}
            </div>
          ) : (
            <div className="muted" style={{ marginTop: 8 }}>尚未設定任何 APK 連結。</div>
          )}
        </div>
      </section>
    </div>
  );
}
