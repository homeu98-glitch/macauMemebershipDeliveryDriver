import { NextResponse } from "next/server";

import { getSessionUser } from "../../../../lib/auth";
import { createServiceRoleSupabaseClient } from "../../../../lib/supabase";

function normalizeLocalPhone(phone: string) {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.startsWith("853") ? digits.slice(3) : digits;
}

function isValidMacauMobile(local: string) {
  return /^6\d{7}$/.test(local);
}

function passwordFromPin(pin: string) {
  return `DriverPin#${pin}@2026`;
}

export async function POST(request: Request) {
  const user = getSessionUser();
  if (!user) return NextResponse.json({ message: "未登入。" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { phone?: string } | null;
  const localPhone = normalizeLocalPhone(body?.phone?.trim() ?? "");
  if (!isValidMacauMobile(localPhone)) {
    return NextResponse.json({ message: "電話號碼必須為澳門 8 位數並以 6 開頭。" }, { status: 400 });
  }

  try {
    const supabase = createServiceRoleSupabaseClient();

    const { data: driver, error } = await supabase
      .from("driver_profiles")
      .select("id,auth_user_id,phone")
      .or(`phone.eq.${localPhone},phone.eq.853${localPhone}`)
      .maybeSingle();

    if (error) throw error;
    if (!driver?.auth_user_id) {
      return NextResponse.json({ message: "找不到該電話對應的車手帳號。" }, { status: 404 });
    }

    const updated = await supabase.auth.admin.updateUserById(String(driver.auth_user_id), {
      password: passwordFromPin("1234")
    });

    if (updated.error) {
      return NextResponse.json({ message: updated.error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, defaultPin: "1234" });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Reset pin failed." },
      { status: 500 }
    );
  }
}
