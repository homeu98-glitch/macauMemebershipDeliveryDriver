"use client";

import QRCode from "qrcode";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

type Release = {
  id: string;
  version: string;
  apkUrl: string;
  releaseNotes: string;
  createdAt: string;
  isActive: boolean;
};

type ListResponse =
  | { success: true; releases: Release[] }
  | { success: false; message: string };

type CreateResponse =
  | { success: true; release: Release }
  | { success: false; message: string };

type ActivateResponse =
  | { success: true; active: Release }
  | { success: false; message: string };

type DeleteResponse =
  | { success: true }
  | { success: false; message: string };

function formatDate(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

export default function ApkManagerPage() {
  const origin = useMemo(() => (typeof window === "undefined" ? "" : window.location.origin), []);
  const landingPageUrl = origin ? `${origin}/apkdownload` : "";
  const stableDownloadUrl = origin ? `${origin}/apkdownload/latest` : "";

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [releases, setReleases] = useState<Release[]>([]);

  const [version, setVersion] = useState("");
  const [apkUrl, setApkUrl] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const active = releases.find((r) => r.isActive) || null;

  async function loadReleases() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/apk/releases");
      const json = (await res.json()) as ListResponse | { message?: string };
      if (!res.ok) throw new Error((json as any).message || "載入失敗。");

      const payload = json as ListResponse;
      if (!payload.success) throw new Error(payload.message);

      setReleases(payload.releases);
    } catch (e) {
      setError(e instanceof Error ? e.message : "載入失敗。"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReleases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function updateQr() {
      if (!landingPageUrl) return;
      const dataUrl = await QRCode.toDataURL(landingPageUrl, { margin: 1, width: 260 });
      setQrDataUrl(dataUrl);
    }
    void updateQr();
  }, [landingPageUrl]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/apk/releases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version, apkUrl, releaseNotes })
      });
      const json = (await res.json()) as CreateResponse | { message?: string };
      if (!res.ok) throw new Error((json as any).message || "建立版本失敗。"
      );

      const payload = json as CreateResponse;
      if (!payload.success) throw new Error(payload.message);

      setVersion("");
      setApkUrl("");
      setReleaseNotes("");
      setMessage("已新增版本。你可以選擇設定為最新版本（Active）。");
      await loadReleases();
    } catch (e) {
      setError(e instanceof Error ? e.message : "建立版本失敗。"
      );
    } finally {
      setSaving(false);
    }
  }

  async function activate(id: string) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/apk/releases/${id}/activate`, { method: "POST" });
      const json = (await res.json()) as ActivateResponse | { message?: string };
      if (!res.ok) throw new Error((json as any).message || "設定最新版本失敗。"
      );

      const payload = json as ActivateResponse;
      if (!payload.success) throw new Error(payload.message);

      setMessage(`已把 ${payload.active.version} 設定為最新版本。`);
      await loadReleases();
    } catch (e) {
      setError(e instanceof Error ? e.message : "設定最新版本失敗。"
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeRelease(release: Release) {
    const confirmed = window.confirm(`確定要刪除版本 ${release.version} 嗎？此操作無法還原。`);
    if (!confirmed) return;

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/apk/releases/${release.id}`, { method: "DELETE" });
      const json = (await res.json()) as DeleteResponse | { message?: string };
      if (!res.ok) throw new Error((json as any).message || "刪除版本失敗。");

      const payload = json as DeleteResponse;
      if (!payload.success) throw new Error(payload.message);

      setMessage(`已刪除版本 ${release.version}。`);
      await loadReleases();
    } catch (e) {
      setError(e instanceof Error ? e.message : "刪除版本失敗。");
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
            <h2 className="card-title">安裝設置（版本管理）</h2>
            <p className="muted">新增多個 APK 版本，並選擇哪一個是最新版本（可回滾）。</p>
          </div>
        </div>

        {error ? <div className="error">{error}</div> : null}
        {message ? <div className="hint">{message}</div> : null}

        <div className="list">
          <div className="list-item">
            <div>
              <strong>固定下載頁（給 QR Code 用）</strong>
              <div className="muted">掃碼後會進入此頁，再由車手按按鈕下載。</div>
            </div>
            <div className="btn-row">
              <a className="btn btn-secondary" href={landingPageUrl} target="_blank" rel="noreferrer">開啟</a>
              <button className="btn btn-secondary" type="button" onClick={() => copy(landingPageUrl)}>複製連結</button>
            </div>
          </div>

          <div className="list-item">
            <div>
              <strong>固定直接下載連結</strong>
              <div className="muted">永遠指向你設定的 Active 版本。</div>
            </div>
            <div className="btn-row">
              <a className="btn btn-primary" href={stableDownloadUrl} target="_blank" rel="noreferrer">下載</a>
              <button className="btn btn-secondary" type="button" onClick={() => copy(stableDownloadUrl)}>複製連結</button>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 18, marginTop: 18 }}>
          <strong>QR Code</strong>
          <div className="muted">掃描後會打開固定下載頁。</div>
          {qrDataUrl ? (
            <div style={{ marginTop: 12, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              <img
                src={qrDataUrl}
                alt="Driver APK QR"
                style={{ width: 220, height: 220, borderRadius: 14, border: "1px solid var(--panel-border)" }}
              />
              <div className="muted" style={{ maxWidth: 420 }}>
                連結：<span className="code">{landingPageUrl}</span>
              </div>
            </div>
          ) : (
            <div className="muted" style={{ marginTop: 12 }}>正在產生 QR Code…</div>
          )}
        </div>

        <div className="card" style={{ padding: 18, marginTop: 18 }}>
          <strong>目前最新版本（Active）</strong>
          <div className="muted" style={{ marginTop: 8 }}>
            {active ? (
              <>
                版本：<span className="code">{active.version}</span>
                <br />
                更新說明：{active.releaseNotes || "-"}
                <br />
                APK URL：<a href={active.apkUrl} target="_blank" rel="noreferrer">{active.apkUrl}</a>
                <br />
                建立時間：{formatDate(active.createdAt)}
              </>
            ) : (
              <>尚未選擇任何 Active 版本。請先新增版本並設定為最新。</>
            )}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">新增 APK 版本</h2>
            <p className="muted">版本號請用你想顯示給車手看的格式，例如：1.0.3</p>
          </div>
        </div>

        <form className="list" onSubmit={onCreate}>
          <div className="field">
            <label htmlFor="version">版本號</label>
            <input id="version" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.0.3" required />
          </div>

          <div className="field">
            <label htmlFor="apkUrl">APK 連結（Supabase Storage）</label>
            <input
              id="apkUrl"
              type="url"
              value={apkUrl}
              onChange={(e) => setApkUrl(e.target.value)}
              placeholder="https://xxxx.supabase.co/storage/v1/object/public/app-downloads/driver/1.0.3.apk"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="notes">更新說明</label>
            <input id="notes" value={releaseNotes} onChange={(e) => setReleaseNotes(e.target.value)} placeholder="例如：修正定位與新增公告" />
          </div>

          <div className="btn-row">
            <button className="btn btn-primary" type="submit" disabled={saving || loading}>
              {saving ? "處理中…" : "新增版本"}
            </button>
            <button className="btn btn-secondary" type="button" onClick={() => loadReleases()} disabled={saving || loading}>
              {loading ? "載入中…" : "重新讀取"}
            </button>
          </div>
        </form>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">版本列表</h2>
            <p className="muted">你可以切換舊版本成 Active（rollback），也可以刪除不再需要的舊版本。</p>
          </div>
        </div>

        {loading ? <div className="muted">載入中…</div> : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>狀態</th>
                <th>版本</th>
                <th>建立時間</th>
                <th>APK</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {releases.length ? (
                releases.map((r) => (
                  <tr key={r.id}>
                    <td>{r.isActive ? "Active" : ""}</td>
                    <td><span className="code">{r.version}</span></td>
                    <td>{formatDate(r.createdAt)}</td>
                    <td><a href={r.apkUrl} target="_blank" rel="noreferrer">連結</a></td>
                    <td>
                      <div className="btn-row">
                        <button className="btn btn-secondary" type="button" disabled={saving || r.isActive} onClick={() => activate(r.id)}>
                          設為最新
                        </button>
                        <button className="btn btn-secondary" type="button" disabled={saving || r.isActive} onClick={() => removeRelease(r)}>
                          刪除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={5} className="muted">尚未建立任何版本。</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
