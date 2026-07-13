"use client";

import Link from "next/link";

export function DriverPendingActions(props: { showResubmit: boolean }) {
  async function logoutAndGoLogin() {
    try {
      await fetch("/api/driver/auth/logout", { method: "POST" });
    } catch {
      // ignore
    } finally {
      window.location.href = "/driver/login";
    }
  }

  return (
    <div className="driver-auth-links inline">
      <button className="android-outline-link" onClick={logoutAndGoLogin} type="button">
        返回登入
      </button>
      {props.showResubmit ? <Link href="/driver/register">重新提交資料</Link> : null}
    </div>
  );
}
