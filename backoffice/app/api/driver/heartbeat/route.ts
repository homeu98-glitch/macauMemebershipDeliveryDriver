import { NextResponse } from "next/server";

import { withDriverSession } from "@/app/api/driver/_shared";
import { createServiceRoleSupabaseClient } from "@/lib/supabase";

export async function POST() {
  return withDriverSession(async (session) => {
    const supabase = createServiceRoleSupabaseClient();
    const now = new Date().toISOString();

    const { error } = await supabase
      .from("driver_profiles")
      .update({ last_heartbeat_at: now })
      .eq("id", session.driverId);

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, lastHeartbeatAt: now });
  });
}
