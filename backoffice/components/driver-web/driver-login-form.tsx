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
      const response = await fetch("/api/driver/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, pin })
      });
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
    <div className="driver-auth-card android-card stack gap-5">
      <div className="driver-brand-chip">騎手登入</div>
      <h1 className="driver-screen-title">會員配送騎手</h1>

      <form className="stack gap-4" onSubmit={onSubmit}>
        <label className="driver-field modern-field">
          <span>電話號碼</span>
          <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="例如 66668888" />
        </label>
        <label className="driver-field modern-field">
          <span>密碼（4 位數字）</span>
          <input value={pin} onChange={(event) => setPin(event.target.value)} placeholder="請輸入 4 位數字" type="password" />
        </label>

        {message ? <div className="error">{message}</div> : null}

        <button className="android-primary-btn" disabled={submitting} type="submit">
          {submitting ? "登入中..." : "登入"}
        </button>
      </form>

      <div className="driver-auth-actions-row">
        <Link className="android-outline-link" href="/driver/register">立即註冊</Link>
        <Link className="android-outline-link" href="/driver/pending">查看審核</Link>
      </div>
    </div>
  );
}
