import { NextResponse } from "next/server";

import { createServiceRoleSupabaseClient, createUserSupabaseClient } from "@/lib/supabase";

async function verifyDriver(accessToken: string) {
  const userClient = createUserSupabaseClient(accessToken);
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

  return {
    authUserId: userData.user.id,
    driverId: driver.id
  };
}

export async function POST(request: Request) {
  const accessToken = request.headers.get("x-supabase-access-token")?.trim();
  if (!accessToken) {
    return NextResponse.json(
      { message: "Missing x-supabase-access-token header." },
      { status: 401 }
    );
  }

  const body = (await request.json()) as {
    fcmToken?: string;
    platform?: string;
    deviceLabel?: string;
    appVersion?: string;
  };

  if (!body.fcmToken?.trim()) {
    return NextResponse.json({ message: "fcmToken is required." }, { status: 400 });
  }

  const verified = await verifyDriver(accessToken);
  if (!verified) {
    return NextResponse.json(
      { message: "Driver verification failed." },
      { status: 403 }
    );
  }

  try {
    const supabase = createServiceRoleSupabaseClient();
    const { error } = await supabase
      .from("driver_push_tokens")
      .upsert(
        {
          auth_user_id: verified.authUserId,
          driver_id: verified.driverId,
          fcm_token: body.fcmToken.trim(),
          platform: body.platform?.trim() || "android",
          device_label: body.deviceLabel?.trim() || null,
          app_version: body.appVersion?.trim() || null,
          last_seen_at: new Date().toISOString()
        },
        { onConflict: "fcm_token" }
      );

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Push token registration failed."
      },
      { status: 500 }
    );
  }
}
