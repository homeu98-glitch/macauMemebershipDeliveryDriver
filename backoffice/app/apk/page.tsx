"use client";

import type { PutBlobResult } from "@vercel/blob";
import { upload } from "@vercel/blob/client";
import QRCode from "qrcode";
import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

type LatestApkResponse =
  | {
      success: true;
      stableDownloadUrl: string;
      landingPageUrl: string;
      blob: {
        url: string;
        pathname: string;
        size: number;
        uploadedAt: string;
      };
    }
  | {
      success: false;
      message: string;
      stableDownloadUrl: string;
      landingPageUrl: string;
    };

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes)) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

function sanitizeFilename(name: string) {
  // keep it simple and safe for pathname
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function makeTimestampPath() {
  // ISO but file-path safe (lexicographically sortable)
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export default function ApkManagerPage() {
  const fileRef = useRef<HTMLInputElement>(null);

  const [loadingLatest, setLoadingLatest] = useState(true);
  const [latest, setLatest] = useState<LatestApkResponse | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<PutBlobResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const origin = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.origin;
  }, []);

  const landingPageUrl = origin ? `${origin}/download/driver` : "";
  const stableDownloadUrl = origin ? `${origin}/download/driver/latest` : "";

  async function refreshLatest() {
    setLoadingLatest(true);
    try {
      const response = await fetch("/api/apk/latest", { method: "GET" });
      const json = (await response.json()) as LatestApkResponse;
      setLatest(json);
    } catch (e) {
      setLatest({
        success: false,
        message: e instanceof Error ? e.message : "Failed to load latest APK",
        stableDownloadUrl,
        landingPageUrl
      });
    } finally {
      setLoadingLatest(false);
    }
  }

  useEffect(() => {
    void refreshLatest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function updateQr() {
      if (!stableDownloadUrl) return;
      const url = stableDownloadUrl;
      const dataUrl = await QRCode.toDataURL(url, { margin: 1, width: 260 });
      setQrDataUrl(dataUrl);
    }
    void updateQr();
  }, [stableDownloadUrl]);

  async function onUpload(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setUploaded(null);

    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("請先選擇 APK 檔案。");
      return;
    }

    const safeName = sanitizeFilename(file.name || "driver.apk");
    const pathname = `driver-apk/${makeTimestampPath()}_${safeName}`;

    setUploading(true);
    try {
      const blob = await upload(pathname, file, {
        access: "public",
        handleUploadUrl: "/api/apk/upload"
      });
      setUploaded(blob);
      await refreshLatest();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
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
            <h2 className="card-title">APK 管理</h2>
            <p className="muted">上傳最新 APK，並取得下載連結與 QR Code（方便分享給車手）。</p>
          </div>
        </div>

        <div className="list">
          <div className="list-item">
            <div>
              <strong>下載頁面</strong>
              <div className="muted">給車手用的下載頁（建議分享這個）。</div>
            </div>
            <div className="btn-row">
              <a className="btn btn-secondary" href={landingPageUrl} target="_blank" rel="noreferrer">
                開啟
              </a>
              <button className="btn btn-secondary" type="button" onClick={() => copy(landingPageUrl)}>
                複製連結
              </button>
            </div>
          </div>

          <div className="list-item">
            <div>
              <strong>直接下載連結（固定）</strong>
              <div className="muted">這個連結永遠指向最新 APK（不需要每次換新連結）。</div>
            </div>
            <div className="btn-row">
              <a className="btn btn-primary" href={stableDownloadUrl} target="_blank" rel="noreferrer">
                下載
              </a>
              <button className="btn btn-secondary" type="button" onClick={() => copy(stableDownloadUrl)}>
                複製連結
              </button>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 18, marginTop: 18 }}>
          <strong>QR Code</strong>
          <div className="muted">掃描後直接下載最新 APK。</div>
          {qrDataUrl ? (
            <div style={{ marginTop: 12, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              <img src={qrDataUrl} alt="Driver APK QR" style={{ width: 220, height: 220, borderRadius: 14, border: "1px solid var(--panel-border)" }} />
              <div className="muted" style={{ maxWidth: 420 }}>
                連結：<span className="code">{stableDownloadUrl}</span>
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
            <h2 className="card-title">上傳新 APK</h2>
            <p className="muted">檔案會直接從瀏覽器上傳到 Vercel Blob（適用大檔案）。</p>
          </div>
        </div>

        {error ? <div className="error">{error}</div> : null}

        <form className="list" onSubmit={onUpload}>
          <div className="list-item">
            <div>
              <strong>選擇 APK 檔案</strong>
              <div className="muted">建議檔名包含版本號，例如：membership-driver-1.0.3.apk</div>
            </div>
            <input ref={fileRef} type="file" accept=".apk" />
          </div>

          <div className="list-item">
            <div>
              <strong>開始上傳</strong>
              <div className="muted">上傳完成後，最新下載連結會自動更新。</div>
            </div>
            <div className="btn-row">
              <button className="btn btn-primary" type="submit" disabled={uploading}>
                {uploading ? "上傳中…" : "上傳"}
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => refreshLatest()} disabled={loadingLatest}>
                重新讀取最新版本
              </button>
            </div>
          </div>
        </form>

        {uploaded ? (
          <div className="hint" style={{ marginTop: 18 }}>
            <strong>上傳完成</strong>
            <div className="muted" style={{ marginTop: 6 }}>
              Blob URL：<a href={uploaded.url} target="_blank" rel="noreferrer">{uploaded.url}</a>
              <br />
              下載 URL：<a href={uploaded.downloadUrl} target="_blank" rel="noreferrer">{uploaded.downloadUrl}</a>
            </div>
          </div>
        ) : null}

        <div className="card" style={{ padding: 18, marginTop: 18 }}>
          <strong>目前最新 APK</strong>
          {loadingLatest ? (
            <div className="muted" style={{ marginTop: 8 }}>載入中…</div>
          ) : latest?.success ? (
            <div className="muted" style={{ marginTop: 8 }}>
              檔案：<span className="code">{latest.blob.pathname}</span>
              <br />
              大小：{formatBytes(latest.blob.size)}
              <br />
              上傳時間：{latest.blob.uploadedAt}
              <br />
              Blob URL：<a href={latest.blob.url} target="_blank" rel="noreferrer">{latest.blob.url}</a>
            </div>
          ) : (
            <div className="muted" style={{ marginTop: 8 }}>
              {latest?.message || "尚未找到任何已上傳的 APK。"}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
