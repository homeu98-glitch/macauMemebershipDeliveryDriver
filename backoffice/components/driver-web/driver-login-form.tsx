"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function DriverLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/driver/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, pin }) });
      const payload = (await response.json()) as { message?: string; driver?: { approvalStatus?: string } };
      if (!response.ok) {
        setMessage(payload.message ?? "登入失敗，請稍後再試。");
        return;
      }
      const next = searchParams.get("next");
      if (next) {
        router.replace(next);
        return;
      }
      router.replace(payload.driver?.approvalStatus === "approved" ? "/driver/home" : "/driver/pending");
    } catch {
      setMessage("登入失敗，請檢查網絡後重試。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="driver-auth-card card stack gap-4">
      <div className="stack gap-2">
        <h1 className="driver-screen-title">車手登入</h1>
        <p className="muted">使用與安卓 App 相同的電話與 PIN 登入。</p>
      </div>
      <form className="stack gap-4" onSubmit={onSubmit}>
        <label className="driver-field"><span>電話號碼</span><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="例如 66668888" /></label>
        <label className="driver-field"><span>PIN</span><input value={pin} onChange={(event) => setPin(event.target.value)} placeholder="4 至 8 位數字" type="password" /></label>
        {message ? <div className="error">{message}</div> : null}
        <button className="btn-primary" disabled={submitting} type="submit">{submitting ? "登入中..." : "登入"}</button>
      </form>
      <div className="driver-auth-links"><Link href="/driver/register">註冊成為車手</Link><Link href="/driver/install">加入主畫面教學</Link></div>
    </div>
  );
}
