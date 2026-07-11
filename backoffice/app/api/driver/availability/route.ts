import { NextResponse } from "next/server";

import { withDriverSession } from "@/app/api/driver/_shared";
import { createServiceRoleSupabaseClient } from "@/lib/supabase";

export async function POST(request: Request) {
  return withDriverSession(async (session) => {
    if (session.approvalStatus !== "approved") return NextResponse.json({ message: "只有已通過審核的車手可以切換接單狀態。" }, { status: 403 });
    const body = (await request.json()) as { availability?: "online" | "offline" };
    if (!body.availability || !["online", "offline"].includes(body.availability)) return NextResponse.json({ message: "缺少有效的接單狀態。" }, { status: 400 });
    const supabase = createServiceRoleSupabaseClient();
    const { error } = await supabase.from("driver_profiles").update({ availability: body.availability }).eq("id", session.driverId);
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });
    return NextResponse.json({ success: true, availability: body.availability });
  });
}
