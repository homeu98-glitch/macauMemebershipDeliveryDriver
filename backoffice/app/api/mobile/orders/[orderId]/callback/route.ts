import { NextResponse } from "next/server";

import { dispatchOrderCallback } from "../../../../../../lib/siteb-callbacks";
import { createUserSupabaseClient } from "@/lib/supabase";

async function verifyDriverAccess(orderId: string, accessToken: string) {
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

  const { data: assignment, error: assignmentError } = await userClient
    .from("order_assignments")
    .select("order_id")
    .eq("order_id", orderId)
    .eq("driver_id", driver.id)
    .is("canceled_at", null)
    .maybeSingle();

  if (assignmentError || !assignment) {
    return null;
  }

  return {
    authUserId: userData.user.id,
    driverId: driver.id
  };
}

export async function POST(
  request: Request,
  { params }: { params: { orderId: string } }
) {
  const accessToken = request.headers.get("x-supabase-access-token")?.trim();
  if (!accessToken) {
    return NextResponse.json(
      { message: "Missing x-supabase-access-token header." },
      { status: 401 }
    );
  }

  const body = (await request.json()) as {
    eventType?: "accepted" | "picked_up" | "arrived" | "delivered" | "exception_reported";
    note?: string;
    action?: string;
  };

  if (!body.eventType) {
    return NextResponse.json({ message: "eventType is required." }, { status: 400 });
  }

  const verified = await verifyDriverAccess(params.orderId, accessToken);
  if (!verified) {
    return NextResponse.json(
      { message: "Driver access verification failed." },
      { status: 403 }
    );
  }

  try {
    const result = await dispatchOrderCallback({
      orderId: params.orderId,
      eventType: body.eventType,
      note: body.note,
      action: body.action
    });

    return NextResponse.json(result, { status: result.success ? 200 : 502 });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Callback dispatch failed."
      },
      { status: 500 }
    );
  }
}
