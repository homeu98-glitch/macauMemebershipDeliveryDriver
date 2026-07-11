import { NextResponse } from "next/server";

import { withDriverSession } from "@/app/api/driver/_shared";
import { createServiceRoleSupabaseClient } from "@/lib/supabase";

export async function POST(request: Request) {
  return withDriverSession(async () => {
    const body = (await request.json()) as { endpoint?: string };
    if (!body.endpoint?.trim()) {
      return NextResponse.json({ message: "缺少 endpoint。" }, { status: 400 });
    }
    const supabase = createServiceRoleSupabaseClient();
    const { error } = await supabase.from("driver_web_push_subscriptions").delete().eq("endpoint", body.endpoint.trim());
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  });
}
