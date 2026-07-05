import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { createServiceRoleSupabaseClient } from "@/lib/supabase";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const sessionUser = getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ message: "未登入。" }, { status: 401 });
  }

  const body = (await request.json()) as { status?: "approved" | "rejected" };
  if (!body.status || !["approved", "rejected"].includes(body.status)) {
    return NextResponse.json({ message: "審核狀態不正確。" }, { status: 400 });
  }

  const supabase = createServiceRoleSupabaseClient();

  const { data: application, error: fetchError } = await supabase
    .from("driver_applications")
    .select("id,driver_id")
    .eq("id", params.id)
    .maybeSingle();

  if (fetchError || !application) {
    return NextResponse.json({ message: "找不到申請資料。" }, { status: 404 });
  }

  const reviewStatus = body.status === "approved" ? "approved" : "rejected";

  const { error: applicationError } = await supabase
    .from("driver_applications")
    .update({
      review_status: reviewStatus,
      reviewed_at: new Date().toISOString(),
      reviewed_by: sessionUser.id
    })
    .eq("id", params.id);

  if (applicationError) {
    return NextResponse.json({ message: applicationError.message }, { status: 500 });
  }

  const { error: profileError } = await supabase
    .from("driver_profiles")
    .update({
      approval_status: reviewStatus
    })
    .eq("id", application.driver_id);

  if (profileError) {
    return NextResponse.json({ message: profileError.message }, { status: 500 });
  }

  await supabase
    .from("driver_documents")
    .update({
      verification_status: reviewStatus,
      verified_at: new Date().toISOString(),
      verified_by: sessionUser.id
    })
    .eq("driver_id", application.driver_id)
    .in("document_type", ["selfie", "macau_id", "driving_licence"]);

  return NextResponse.json({ success: true });
}
