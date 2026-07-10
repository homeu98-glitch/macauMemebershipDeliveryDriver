"use client";

import { useState } from "react";

function normalizeLocalPhone(phone: string) {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.startsWith("853") ? digits.slice(3) : digits;
}

export function ResetRiderPin() {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function handleReset() {
    setBusy(true);
    setMessage("");
    try {
      const local = normalizeLocalPhone(phone);
      const res = await fetch("/api/riders/reset-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: local })
      });
      const json = (await res.json()) as { message?: string; success?: boolean; defaultPin?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.message ?? "重設密碼失敗。")
      }
      setMessage(`已重設密碼。預設密碼為 ${json.defaultPin ?? "1234"}。`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "重設密碼失敗。")
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <h2 style={{ marginTop: 0 }}>重設車手密碼</h2>
      <p className="muted">輸入車手電話號碼（8 位數，6 字開頭），系統會把密碼重設為 1234。</p>

      <div className="form-row">
        <label>電話號碼</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="例如：6xxxxxxx"
        />
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
        <button className="btn btn-primary" onClick={handleReset} disabled={busy}>
          {busy ? "處理中..." : "重設為 1234"}
        </button>
      </div>

      {message ? <div className="hint" style={{ marginTop: 12 }}>{message}</div> : null}
    </div>
  );
}
