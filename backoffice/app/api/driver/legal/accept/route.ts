import { NextResponse } from "next/server";

import { withDriverSession } from "@/app/api/driver/_shared";
import { getLegalConfig } from "@/lib/legal-config";
import { createServiceRoleSupabaseClient } from "@/lib/supabase";

export async function POST() {
  return withDriverSession(async (session) => {
    const supabase = createServiceRoleSupabaseClient();
    const config = await getLegalConfig();
    const { error } = await supabase.from("driver_profiles").update({ accepted_terms_version: config.version, accepted_terms_at: new Date().toISOString() }).eq("id", session.driverId);
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });
    return NextResponse.json({ success: true, version: config.version });
  });
}
