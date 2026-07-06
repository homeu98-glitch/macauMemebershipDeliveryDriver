import { NextResponse } from "next/server";

import {
  createSessionValue,
  SESSION_COOKIE_NAME,
  type SessionUser
} from "../../../../lib/auth";
import {
  createAnonSupabaseClient,
  createServiceRoleSupabaseClient,
  hasServiceRoleKey,
  hasSessionSecretConfigured,
  isSupabaseConfigured
} from "../../../../lib/supabase";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    account?: string;
    email?: string;
    password?: string;
  };

  const account = body.account?.trim() || body.email?.trim() || "";
  const password = body.password?.trim() ?? "";
  const staticAdminAccount = "63936541";
  const staticAdminPassword = "1234";

  if (!account || !password) {
    return NextResponse.json(
      { message: "請輸入帳號與密碼。" },
      { status: 400 }
    );
  }

  if (account === staticAdminAccount && password === staticAdminPassword) {
    const sessionUser: SessionUser = {
      id: "local-admin-63936541",
      email: staticAdminAccount,
      name: "後台管理員",
      role: "admin"
    };

    const response = NextResponse.json({ success: true });
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: createSessionValue(sessionUser),
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12
    });

    return response;
  }

  if (!isSupabaseConfigured() || !hasServiceRoleKey() || !hasSessionSecretConfigured()) {
    return NextResponse.json(
      { message: "後台環境變數未完成設定，請重新匯入 Vercel 的 .env 並重新部署。" },
      { status: 500 }
    );
  }

  try {
    const anonClient = createAnonSupabaseClient();
    const adminClient = createServiceRoleSupabaseClient();

    const { data: authData, error: authError } = await anonClient.auth.signInWithPassword({
      email: account.toLowerCase(),
      password
    });

    if (authError || !authData.user) {
      const authMessage = authError?.message?.toLowerCase() ?? "";
      const message = authMessage.includes("invalid api key") ||
        authMessage.includes("api key")
        ? "後台環境變數未完成設定，請檢查 Vercel 的 Supabase 金鑰。"
        : "登入失敗，請確認帳號密碼。";

      return NextResponse.json(
        { message },
        { status: 401 }
      );
    }

    const { data: adminRow, error: adminError } = await adminClient
      .from("admin_users")
      .select("user_id")
      .eq("user_id", authData.user.id)
      .maybeSingle();

    if (adminError || !adminRow) {
      return NextResponse.json(
        { message: "此帳號沒有後台管理權限。" },
        { status: 403 }
      );
    }

    const sessionUser: SessionUser = {
      id: authData.user.id,
      email: authData.user.email ?? account,
      name:
        (authData.user.user_metadata?.full_name as string | undefined) ??
        (authData.user.email?.split("@")[0] ?? "後台管理員"),
      role: "admin"
    };

    const response = NextResponse.json({ success: true });
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: createSessionValue(sessionUser),
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12
    });

    return response;
  } catch {
    return NextResponse.json(
      { message: "後台登入服務暫時不可用，請確認 Vercel 環境變數後重新部署。" },
      { status: 500 }
    );
  }
}
