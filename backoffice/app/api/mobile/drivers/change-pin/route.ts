import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { ENV_PLACEHOLDERS } from "../../../../../lib/data";
import { createServiceRoleSupabaseClient } from "../../../../../lib/supabase";

function passwordFromPin(pin: string) {
  return `DriverPin#${pin}@2026`;
}

function isValidPin(pin: string) {
  return /^\d{4}$/.test(pin);
}

function createDriverUserClient(accessToken: string) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? ENV_PLACEHOLDERS.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ENV_PLACEHOLDERS.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  });
}

async function verifyAuthUser(accessToken: string) {
  const userClient = createDriverUserClient(accessToken);
  const { data, error } = await userClient.auth.getUser(accessToken);
  if (error || !data.user) return null;
  return { authUserId: data.user.id };
}

export async function POST(request: Request) {
  const accessToken = request.headers.get("x-supabase-access-token")?.trim();
  if (!accessToken) {
    return NextResponse.json(
      { message: "Missing x-supabase-access-token header." },
      { status: 401 }
    );
  }

  const verified = await verifyAuthUser(accessToken);
  if (!verified) {
    return NextResponse.json({ message: "Driver access verification failed." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { pin?: string } | null;
  const pin = body?.pin?.trim() ?? "";
  if (!isValidPin(pin)) {
    return NextResponse.json({ message: "PIN 必須為 4 位數字。" }, { status: 400 });
  }

  try {
    const supabase = createServiceRoleSupabaseClient();
    const updated = await supabase.auth.admin.updateUserById(verified.authUserId, {
      password: passwordFromPin(pin)
    });

    if (updated.error) {
      return NextResponse.json({ message: updated.error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Change pin failed." },
      { status: 500 }
    );
  }
}
