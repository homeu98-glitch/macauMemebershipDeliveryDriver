import { NextResponse } from "next/server";

import { createServiceRoleSupabaseClient, createUserSupabaseClient } from "../../../../../lib/supabase";

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
    driverId: driver.id as string
  };
}

export async function POST(request: Request) {
  const accessToken = request.headers.get("x-supabase-access-token")?.trim();
  if (!accessToken) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const verified = await verifyDriver(accessToken);
  if (!verified) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 403 });
  }

  try {
    const form = await request.formData();
    const selfie = form.get("selfie");
    const macauId = form.get("macau_id");
    const drivingLicence = form.get("driving_licence");

    if (!(selfie instanceof File) || !(macauId instanceof File) || !(drivingLicence instanceof File)) {
      return NextResponse.json(
        { message: "selfie, macau_id, driving_licence are required." },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleSupabaseClient();

    const uploads: Array<{ type: string; file: File; path: string }> = [
      { type: "selfie", file: selfie, path: `${verified.authUserId}/selfie.jpg` },
      { type: "macau_id", file: macauId, path: `${verified.authUserId}/macau-id.jpg` },
      { type: "driving_licence", file: drivingLicence, path: `${verified.authUserId}/driving-licence.jpg` }
    ];

    for (const item of uploads) {
      const bytes = new Uint8Array(await item.file.arrayBuffer());
      const { error: uploadError } = await supabase.storage
        .from("driver-documents")
        .upload(item.path, bytes, {
          contentType: item.file.type || "image/jpeg",
          upsert: true
        });
      if (uploadError) throw uploadError;
    }

    const { error: deleteError } = await supabase
      .from("driver_documents")
      .delete()
      .eq("driver_id", verified.driverId);
    if (deleteError) throw deleteError;

    const { error: insertError } = await supabase.from("driver_documents").insert(
      uploads.map((item) => ({
        driver_id: verified.driverId,
        document_type: item.type,
        storage_path: item.path,
        verification_status: "pending_review"
      }))
    );
    if (insertError) throw insertError;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Upload driver documents failed." },
      { status: 500 }
    );
  }
}
