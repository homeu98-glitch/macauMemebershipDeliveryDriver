import { NextResponse } from "next/server";

import { applyDriverSessionCookie, buildDriverSession, driverEmailFromPhone, driverPasswordFromPin, getDriverProfileByAuthUserId, isValidMacauMobile } from "@/lib/driver-web-auth";
import { createAnonSupabaseClient } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { phone?: string; pin?: string };
    const phone = body.phone?.trim() ?? "";
    const pin = body.pin?.trim() ?? "";
    if (!isValidMacauMobile(phone)) return NextResponse.json({ message: "請輸入有效的澳門手機號碼。" }, { status: 400 });
    if (!/^\d{4,8}$/.test(pin)) return NextResponse.json({ message: "PIN 格式不正確。" }, { status: 400 });

    const anon = createAnonSupabaseClient();
    const { data, error } = await anon.auth.signInWithPassword({ email: driverEmailFromPhone(phone), password: driverPasswordFromPin(pin) });
    if (error || !data.session || !data.user) return NextResponse.json({ message: "登入失敗，請檢查電話與 PIN。" }, { status: 401 });

    const profile = await getDriverProfileByAuthUserId(data.user.id);
    if (!profile) return NextResponse.json({ message: "找不到對應車手資料。" }, { status: 404 });

    const session = buildDriverSession({ authUserId: data.user.id, accessToken: data.session.access_token, refreshToken: data.session.refresh_token, expiresInSeconds: data.session.expires_in ?? 3600, profile });
    const response = NextResponse.json({ success: true, driver: { id: session.driverId, fullName: session.fullName, approvalStatus: session.approvalStatus, availability: session.availability } });
    applyDriverSessionCookie(response, session);
    return response;
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "登入失敗。" }, { status: 500 });
  }
}
