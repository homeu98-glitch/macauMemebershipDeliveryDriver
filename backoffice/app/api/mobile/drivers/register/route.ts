import { NextResponse } from "next/server";

import { createServiceRoleSupabaseClient } from "../../../../../lib/supabase";

function normalizeLocalPhone(phone: string) {
  const digits = (phone ?? "").replace(/\D/g, "");
  const local = digits.startsWith("853") ? digits.slice(3) : digits;
  return local;
}

function normalizePhone(phone: string) {
  const local = normalizeLocalPhone(phone);
  return local.startsWith("853") ? local : `853${local}`;
}

function isValidMacauMobile(local: string) {
  return /^6\d{7}$/.test(local);
}

function emailFromPhone(phone: string) {
  return `${normalizePhone(phone)}@driver.membership.local`;
}

function passwordFromPin(pin: string) {
  return `DriverPin#${pin}@2026`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      fullName?: string;
      phone?: string;
      pin?: string;
    };

    const fullName = body.fullName?.trim() ?? "";
    const phone = body.phone?.trim() ?? "";
    const localPhone = normalizeLocalPhone(phone);
    const pin = body.pin?.trim() ?? "";

    if (!fullName || !phone || pin.length !== 4 || !isValidMacauMobile(localPhone)) {
      return NextResponse.json(
        { message: "Invalid payload." },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleSupabaseClient();
    const email = emailFromPhone(localPhone);
    const password = passwordFromPin(pin);

    const created = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, phone: localPhone }
    });

    if (created.error && !String(created.error.message).toLowerCase().includes("already")) {
      return NextResponse.json(
        { message: created.error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      created: !created.error
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Register driver failed." },
      { status: 500 }
    );
  }
}
