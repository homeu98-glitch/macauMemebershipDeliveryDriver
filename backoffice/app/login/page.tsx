import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { LoginForm } from "../../components/backoffice";
import { SESSION_COOKIE_NAME } from "../../lib/auth";

export default function LoginPage() {
  const session = cookies().get(SESSION_COOKIE_NAME)?.value;

  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="page-shell auth-shell">
      <section className="auth-panel">
        <div className="auth-brand">
          <div className="eyebrow">已連接 Supabase 的後台管理</div>
          <h1 className="hero-title">集中處理騎手審核、訂單追蹤與回調狀態。</h1>
          <p className="hero-copy">
            這個後台提供管理員登入、騎手申請審核、即時訂單查閱、回調紀錄追蹤與系統設定檢視，
            並直接使用 Supabase 真實資料。
          </p>

          <div className="auth-highlights">
            <div className="stat-card">
              <div className="muted">騎手審核</div>
              <strong>即時資料</strong>
              <div className="muted">直接讀取資料庫待審案件</div>
            </div>
            <div className="stat-card">
              <div className="muted">訂單監控</div>
              <strong>真實同步</strong>
              <div className="muted">顯示實際訂單與回調狀態</div>
            </div>
            <div className="stat-card">
              <div className="muted">回調重送</div>
              <strong>可操作</strong>
              <div className="muted">可從後台直接重試 callback</div>
            </div>
          </div>
        </div>

        <div className="muted">
          上線前請在 Vercel 補齊環境變數，並使用正式的管理員帳號登入。
        </div>
      </section>

      <section className="auth-form-panel">
        <div className="card login-card">
          <div className="card-header">
            <div>
              <h2 className="card-title" style={{ fontSize: "1.5rem" }}>
                管理員登入
              </h2>
              <p className="muted">
                請使用已建立的後台帳號登入系統。
              </p>
            </div>
          </div>

          <Suspense fallback={<div className="muted">正在載入登入表單...</div>}>
            <LoginForm />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
