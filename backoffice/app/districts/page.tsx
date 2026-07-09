"use client";

import { useEffect, useState } from "react";

type StatusResponse =
  | { success: true; districtCount: number; districts: string[] }
  | { success: false; message: string };

type BackfillResponse =
  | { success: true; districtCount: number; updatedShops: number; updatedCustomers: number }
  | { success: false; message: string };

export default function DistrictsPage() {
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [districts, setDistricts] = useState<string[]>([]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/districts/backfill");
      const json = (await res.json()) as StatusResponse | { message?: string };
      if (!res.ok) throw new Error((json as { message?: string }).message || "載入失敗。");
      const payload = json as StatusResponse;
      if (!payload.success) throw new Error(payload.message);
      setDistricts(payload.districts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "載入失敗。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function runBackfill() {
    setRunning(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/districts/backfill", { method: "POST" });
      const json = (await res.json()) as BackfillResponse | { message?: string };
      if (!res.ok) throw new Error((json as { message?: string }).message || "回填失敗。");
      const payload = json as BackfillResponse;
      if (!payload.success) throw new Error(payload.message);
      setMessage(`完成：已更新 ${payload.updatedShops} 個商戶、${payload.updatedCustomers} 個客戶地區。`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "回填失敗。");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="section-stack">
      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">地區同步</h2>
            <p className="muted">把澳門 GeoJSON 區域資料同步到系統，並回填現有商戶與客戶 district 欄位。</p>
          </div>
        </div>

        {error ? <div className="error">{error}</div> : null}
        {message ? <div className="hint">{message}</div> : null}

        <div className="btn-row">
          <button className="btn btn-primary" type="button" disabled={running || loading} onClick={runBackfill}>
            {running ? "回填中…" : "回填現有資料"}
          </button>
          <button className="btn btn-secondary" type="button" disabled={running || loading} onClick={() => load()}>
            {loading ? "載入中…" : "重新讀取"}
          </button>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">澳門地區列表</h2>
            <p className="muted">目前 GeoJSON 已載入的區域名稱。</p>
          </div>
        </div>
        <div className="list">
          {districts.map((district) => (
            <div key={district} className="list-item"><span>{district}</span></div>
          ))}
          {!districts.length && !loading ? <div className="muted">沒有載入到任何地區。</div> : null}
        </div>
      </section>
    </div>
  );
}
