import { NextResponse } from "next/server";

import { getSessionUser } from "../../../../../lib/auth";
import { createServiceRoleSupabaseClient } from "../../../../../lib/supabase";

export async function GET() {
  const user = getSessionUser();
  if (!user) return NextResponse.json({ message: "未登入。" }, { status: 401 });

  try {
    const supabase = createServiceRoleSupabaseClient();
    const { count, error } = await supabase
      .from("driver_applications")
      .select("id", { count: "exact", head: true })
      .eq("review_status", "pending_review");

    if (error) throw error;

    return NextResponse.json({ success: true, pending: count ?? 0 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Load pending count failed." },
      { status: 500 }
    );
  }
}
