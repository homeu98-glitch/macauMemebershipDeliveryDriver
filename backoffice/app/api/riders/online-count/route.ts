import { NextResponse } from "next/server";

import { getSessionUser } from "../../../../lib/auth";
import { createServiceRoleSupabaseClient } from "../../../../lib/supabase";

export async function GET() {
  const sessionUser = getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ message: "未登入。" }, { status: 401 });
  }

  try {
    const supabase = createServiceRoleSupabaseClient();
    const { data, error } = await supabase
      .from("driver_profiles")
      .select("id,availability,approval_status")
      .eq("availability", "online");

    if (error) {
      throw error;
    }

    const onlineRiders = (data ?? []).filter((item: any) => item.approval_status !== "suspended");

    return NextResponse.json({
      success: true,
      count: onlineRiders.length,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Load online rider count failed." },
      { status: 500 }
    );
  }
}
