import { NextResponse } from "next/server";

import { createServiceRoleSupabaseClient } from "../../../../../lib/supabase";

function normalizePhone(phone: string) {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.startsWith("853") ? digits : `853${digits}`;
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
    const pin = body.pin?.trim() ?? "";

    if (!fullName || !phone || pin.length !== 4) {
      return NextResponse.json(
        { message: "Invalid payload." },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleSupabaseClient();
    const email = emailFromPhone(phone);
    const password = passwordFromPin(pin);

    const created = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, phone }
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
