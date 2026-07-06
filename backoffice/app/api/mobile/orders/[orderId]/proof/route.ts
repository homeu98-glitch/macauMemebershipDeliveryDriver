import { NextResponse } from "next/server";

import { createServiceRoleSupabaseClient, createUserSupabaseClient } from "../../../../../../lib/supabase";

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

export async function GET(
  request: Request,
  { params }: { params: { orderId: string } }
) {
  const accessToken = request.headers.get("x-supabase-access-token")?.trim();
  if (!accessToken) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const verified = await verifyDriver(accessToken);
  if (!verified) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 403 });
  }

  try {
    const supabase = createServiceRoleSupabaseClient();
    const { data: proof, error: proofError } = await supabase
      .from("delivery_proofs")
      .select("storage_path")
      .eq("order_id", params.orderId)
      .eq("driver_id", verified.driverId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (proofError) throw proofError;
    if (!proof?.storage_path) {
      return NextResponse.json({ message: "Proof not found." }, { status: 404 });
    }

    const { data: signed, error: signedError } = await supabase.storage
      .from("delivery-proofs")
      .createSignedUrl(proof.storage_path as string, 60 * 60 * 24);
    if (signedError) throw signedError;

    const fileResponse = await fetch(signed.signedUrl);
    if (!fileResponse.ok) {
      return NextResponse.json({ message: "Failed to load proof." }, { status: 502 });
    }

    const buffer = await fileResponse.arrayBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": fileResponse.headers.get("content-type") ?? "image/jpeg",
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Load proof failed." },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { orderId: string } }
) {
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
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ message: "file is required." }, { status: 400 });
    }

    const supabase = createServiceRoleSupabaseClient();
    const objectPath = `${verified.authUserId}/order-${params.orderId}-proof.jpg`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from("delivery-proofs")
      .upload(objectPath, bytes, {
        contentType: file.type || "image/jpeg",
        upsert: true
      });
    if (uploadError) throw uploadError;

    const { error: insertError } = await supabase.from("delivery_proofs").insert({
      order_id: params.orderId,
      driver_id: verified.driverId,
      storage_path: objectPath,
      proof_type: "proof_of_delivery"
    });
    if (insertError) throw insertError;

    return NextResponse.json({ success: true, storagePath: objectPath });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Upload proof failed." },
      { status: 500 }
    );
  }
}
