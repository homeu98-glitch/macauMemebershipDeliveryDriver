import { NextResponse } from "next/server";

import { applyDriverSessionCookie, buildDriverSession, driverEmailFromPhone, driverPasswordFromPin, getDriverProfileByAuthUserId, isValidMacauMobile, normalizeLocalPhone } from "@/lib/driver-web-auth";
import { createAnonSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase";

async function ensureAuthUser(fullName: string, localPhone: string, pin: string) {
  const supabase = createServiceRoleSupabaseClient();
  const email = driverEmailFromPhone(localPhone);
  const password = driverPasswordFromPin(pin);
  const created = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone: localPhone }
  });

  if (created.error && !String(created.error.message).toLowerCase().includes("already")) {
    throw created.error;
  }

  const anon = createAnonSupabaseClient();
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) {
    throw error ?? new Error("註冊成功，但登入失敗。");
  }
  return data;
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const fullName = String(form.get("fullName") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    const localPhone = normalizeLocalPhone(phone);
    const pin = String(form.get("pin") ?? "").trim();
    const selfie = form.get("selfie");
    const macauId = form.get("macau_id");
    const drivingLicence = form.get("driving_licence");

    if (!fullName || !isValidMacauMobile(localPhone) || !/^\d{4}$/.test(pin)) {
      return NextResponse.json({ message: "請檢查姓名、電話與 PIN。" }, { status: 400 });
    }
    if (!(selfie instanceof File) || !(macauId instanceof File) || !(drivingLicence instanceof File)) {
      return NextResponse.json({ message: "請上傳自拍照、澳門身份證與駕駛執照。" }, { status: 400 });
    }

    const authData = await ensureAuthUser(fullName, localPhone, pin);
    const accessToken = authData.session.access_token;
    const authUserId = authData.user.id;
    const supabase = createServiceRoleSupabaseClient();

    let profile = await getDriverProfileByAuthUserId(authUserId);
    let driverId = profile?.id as string | undefined;
    if (driverId) {
      const { error } = await supabase
        .from("driver_profiles")
        .update({ full_name: fullName, phone: localPhone, vehicle_type: "電單車", approval_status: "pending_review", availability: "offline" })
        .eq("id", driverId);
      if (error) throw error;
    } else {
      const { data, error } = await supabase
        .from("driver_profiles")
        .insert({ auth_user_id: authUserId, full_name: fullName, phone: localPhone, vehicle_type: "電單車", approval_status: "pending_review", availability: "offline" })
        .select("id")
        .single();
      if (error) throw error;
      driverId = data.id as string;
    }

    const { data: latestApplication } = await supabase
      .from("driver_applications")
      .select("id")
      .eq("driver_id", driverId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!latestApplication) {
      const { error } = await supabase.from("driver_applications").insert({ driver_id: driverId });
      if (error) throw error;
    }

    const uploads: Array<{ type: string; file: File; path: string }> = [
      { type: "selfie", file: selfie, path: `${authUserId}/selfie.jpg` },
      { type: "macau_id", file: macauId, path: `${authUserId}/macau-id.jpg` },
      { type: "driving_licence", file: drivingLicence, path: `${authUserId}/driving-licence.jpg` }
    ];

    for (const item of uploads) {
      const bytes = new Uint8Array(await item.file.arrayBuffer());
      const { error } = await supabase.storage.from("driver-documents").upload(item.path, bytes, { contentType: item.file.type || "image/jpeg", upsert: true });
      if (error) throw error;
    }

    const { error: deleteDocsError } = await supabase.from("driver_documents").delete().eq("driver_id", driverId);
    if (deleteDocsError) throw deleteDocsError;
    const { error: insertDocsError } = await supabase.from("driver_documents").insert(uploads.map((item) => ({ driver_id: driverId, document_type: item.type, storage_path: item.path, verification_status: "pending_review" })));
    if (insertDocsError) throw insertDocsError;

    profile = await getDriverProfileByAuthUserId(authUserId);
    if (!profile) throw new Error("找不到新建立的車手資料。")

    const session = buildDriverSession({ authUserId, accessToken, refreshToken: authData.session.refresh_token, expiresInSeconds: authData.session.expires_in ?? 3600, profile });
    const response = NextResponse.json({ success: true, driverId, approvalStatus: session.approvalStatus });
    applyDriverSessionCookie(response, session);
    return response;
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "註冊失敗。" }, { status: 500 });
  }
}
