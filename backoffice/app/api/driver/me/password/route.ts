import { NextResponse } from "next/server";

import { withDriverSession } from "@/app/api/driver/_shared";
import { createUserSupabaseClient } from "@/lib/supabase";

export async function POST(request: Request) {
  return withDriverSession(async (session) => {
    const body = (await request.json().catch(() => ({}))) as { password?: string };
    const password = (body.password ?? "").trim();

    if (!/^\d{4}$/.test(password)) {
      return NextResponse.json({ message: "請輸入 4 位數字新密碼。" }, { status: 400 });
    }

    const supabase = createUserSupabaseClient(session.accessToken);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      return NextResponse.json({ message: error.message || "更改密碼失敗。" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  });
}
