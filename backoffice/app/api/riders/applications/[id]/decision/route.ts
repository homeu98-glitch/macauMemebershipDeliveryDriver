import { NextResponse } from "next/server";

import { getSessionUser } from "../../../../../../lib/auth";
import { createServiceRoleSupabaseClient } from "../../../../../../lib/supabase";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

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

  const reviewerId = isUuid(sessionUser.id) ? sessionUser.id : null;
  const reviewedAt = new Date().toISOString();
  const reviewStatus = body.status === "approved" ? "approved" : "rejected";

  const supabase = createServiceRoleSupabaseClient();

  const { data: application, error: fetchError } = await supabase
    .from("driver_applications")
    .select("id,driver_id")
    .eq("id", params.id)
    .maybeSingle();

  if (fetchError || !application) {
    return NextResponse.json({ message: "找不到申請資料。" }, { status: 404 });
  }

  const { error: applicationError } = await supabase
    .from("driver_applications")
    .update({
      review_status: reviewStatus,
      reviewed_at: reviewedAt,
      reviewed_by: reviewerId
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

  const { error: documentError } = await supabase
    .from("driver_documents")
    .update({
      verification_status: reviewStatus,
      verified_at: reviewedAt,
      verified_by: reviewerId
    })
    .eq("driver_id", application.driver_id)
    .in("document_type", ["selfie", "macau_id", "driving_licence"]);

  if (documentError) {
    return NextResponse.json({ message: documentError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
