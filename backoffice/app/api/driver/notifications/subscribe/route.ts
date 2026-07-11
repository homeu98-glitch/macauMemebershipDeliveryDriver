import { NextResponse } from "next/server";

import { withDriverSession } from "@/app/api/driver/_shared";
import { createServiceRoleSupabaseClient } from "@/lib/supabase";

export async function POST(request: Request) {
  return withDriverSession(async (session) => {
    const body = (await request.json()) as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
      deviceLabel?: string;
    };

    if (!body.endpoint?.trim() || !body.keys?.p256dh?.trim() || !body.keys?.auth?.trim()) {
      return NextResponse.json({ message: "缺少有效的 subscription 資料。" }, { status: 400 });
    }

    const supabase = createServiceRoleSupabaseClient();
    const { error } = await supabase.from("driver_web_push_subscriptions").upsert(
      {
        auth_user_id: session.authUserId,
        driver_id: session.driverId,
        endpoint: body.endpoint.trim(),
        p256dh: body.keys.p256dh.trim(),
        auth: body.keys.auth.trim(),
        device_label: body.deviceLabel?.trim() || null,
        user_agent: request.headers.get("user-agent") || null,
        last_seen_at: new Date().toISOString()
      },
      { onConflict: "endpoint" }
    );

    if (error) return NextResponse.json({ message: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  });
}
