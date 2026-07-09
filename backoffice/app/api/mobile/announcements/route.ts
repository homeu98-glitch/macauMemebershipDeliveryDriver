import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { ENV_PLACEHOLDERS } from "../../../../lib/data";
import { createServiceRoleSupabaseClient } from "../../../../lib/supabase";

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

async function verifyDriver(accessToken: string) {
  const userClient = createDriverUserClient(accessToken);
  const { data: userData, error: userError } = await userClient.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return null;
  }

  const { data: driver, error: driverError } = await userClient
    .from("driver_profiles")
    .select("id")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();

  if (driverError || !driver) {
    return null;
  }

  return { driverId: driver.id };
}

export async function GET(request: Request) {
  const accessToken = request.headers.get("x-supabase-access-token")?.trim();
  if (!accessToken) {
    return NextResponse.json(
      { message: "Missing x-supabase-access-token header." },
      { status: 401 }
    );
  }

  const verified = await verifyDriver(accessToken);
  if (!verified) {
    return NextResponse.json({ message: "Driver access verification failed." }, { status: 403 });
  }

  try {
    const supabase = createServiceRoleSupabaseClient();
    const { data, error } = await supabase
      .from("driver_announcements")
      .select("id,title,content,created_at")
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      items: (data ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        content: row.content,
        createdAt: row.created_at
      }))
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Load announcements failed." },
      { status: 500 }
    );
  }
}
