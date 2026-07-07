import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { createServiceRoleSupabaseClient } from "../../../../../../lib/supabase";
import { dispatchOrderCallback } from "../../../../../../lib/siteb-callbacks";
import { ENV_PLACEHOLDERS } from "../../../../../../lib/data";
import { sendPushToOnlineDrivers } from "../../../../../../lib/push-notifications";

type DriverEventType =
  | "accepted"
  | "picked_up"
  | "delivered"
  | "exception_reported"
  | "canceled";

function createDriverUserClient(accessToken: string) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? ENV_PLACEHOLDERS.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ENV_PLACEHOLDERS.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  });
}

async function verifyDriver(accessToken: string) {
  const userClient = createDriverUserClient(accessToken);
  const { data: userData, error: userError } = await userClient.auth.getUser(accessToken);
  if (userError || !userData.user) return null;

  const { data: driver, error: driverError } = await userClient
    .from("driver_profiles")
    .select("id")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();

  if (driverError || !driver) return null;

  return { authUserId: userData.user.id, driverId: driver.id as string };
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
    eventType?: DriverEventType;
    note?: string;
    action?: string;
    cancelReason?: string;
    cancelOtherReason?: string;
    cancelHandling?: "return_to_shop" | "not_returning";
  };

  if (!body.eventType) {
    return NextResponse.json({ message: "eventType is required." }, { status: 400 });
  }

  const verified = await verifyDriver(accessToken);
  if (!verified) {
    return NextResponse.json(
      { message: "Driver access verification failed." },
      { status: 403 }
    );
  }

  const supabase = createServiceRoleSupabaseClient();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id,external_order_id,status,assigned_fee_mop,source_payload")
    .eq("id", params.orderId)
    .maybeSingle();

  if (orderError || !order) {
    return NextResponse.json({ message: "Order not found." }, { status: 404 });
  }

  // Ensure assignment exists for non-accept transitions
  if (body.eventType !== "accepted") {
    const { data: assignment } = await supabase
      .from("order_assignments")
      .select("driver_id,canceled_at")
      .eq("order_id", params.orderId)
      .order("assigned_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!assignment || assignment.canceled_at) {
      return NextResponse.json(
        { message: "Order is not assigned." },
        { status: 409 }
      );
    }
    if (assignment.driver_id !== verified.driverId) {
      return NextResponse.json(
        { message: "Not the assigned driver." },
        { status: 403 }
      );
    }
  }

  const now = new Date().toISOString();

  try {
    if (body.eventType === "accepted") {
      if (order.status !== "new") {
        return NextResponse.json(
          { message: order.status === "canceled" ? "訂單已取消，不能再接單。" : "訂單已不再可接。" },
          { status: 409 }
        );
      }

      if (order.status === "new") {
        await supabase.from("order_assignments").insert({
          order_id: params.orderId,
          driver_id: verified.driverId,
          accepted_at: now
        });
        await supabase.from("orders").update({ status: "accepted", updated_at: now }).eq("id", params.orderId);
        await supabase.from("order_events").insert({
          order_id: params.orderId,
          event_type: "accepted",
          actor_type: "driver",
          actor_driver_id: verified.driverId,
          payload: { note: "騎手已接單" }
        });
      }
    }

    if (body.eventType === "picked_up") {
      if (order.status !== "picked_up" && order.status !== "delivered") {
        await supabase.from("orders").update({ status: "picked_up", updated_at: now }).eq("id", params.orderId);
        await supabase.from("order_events").insert({
          order_id: params.orderId,
          event_type: "picked_up",
          actor_type: "driver",
          actor_driver_id: verified.driverId,
          payload: { note: "騎手已取貨" }
        });
      }
    }

    if (body.eventType === "delivered") {
      const { data: proof } = await supabase
        .from("delivery_proofs")
        .select("id")
        .eq("order_id", params.orderId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!proof) {
        return NextResponse.json(
          { message: "Proof is required before delivered callback." },
          { status: 422 }
        );
      }

      if (order.status !== "delivered") {
        await supabase.from("orders").update({ status: "delivered", updated_at: now }).eq("id", params.orderId);
        await supabase.from("order_events").insert({
          order_id: params.orderId,
          event_type: "delivered",
          actor_type: "driver",
          actor_driver_id: verified.driverId,
          payload: { note: "騎手已完成訂單" }
        });
      }
    }

    if (body.eventType === "exception_reported") {
      await supabase.from("order_events").insert({
        order_id: params.orderId,
        event_type: "issue_reported",
        actor_type: "driver",
        actor_driver_id: verified.driverId,
        payload: { note: body.note ?? "Driver reported an issue." }
      });
    }

    if (body.eventType === "canceled") {
      const cancelPayload = {
        cancel_reason: body.cancelReason ?? "driver_cancelled",
        cancel_other_reason: body.cancelOtherReason ?? "",
        cancel_handling: body.cancelHandling ?? "return_to_shop",
        note: "騎手取消配送"
      };

      if (order.status === "picked_up") {
        const { data: pickedUpEvent } = await supabase
          .from("order_events")
          .select("created_at")
          .eq("order_id", params.orderId)
          .eq("event_type", "picked_up")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const canGraceRelease =
          body.action === "grace_release" &&
          typeof pickedUpEvent?.created_at === "string" &&
          Date.now() - new Date(pickedUpEvent.created_at).getTime() <= 3 * 60 * 1000;

        if (canGraceRelease) {
          const { data: latestAssignment } = await supabase
            .from("order_assignments")
            .select("id")
            .eq("order_id", params.orderId)
            .eq("driver_id", verified.driverId)
            .is("canceled_at", null)
            .order("assigned_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (latestAssignment?.id) {
            await supabase
              .from("order_assignments")
              .update({ canceled_at: now })
              .eq("id", latestAssignment.id);
          }

          await supabase.from("orders").update({ status: "new", updated_at: now }).eq("id", params.orderId);

          const isUrgent =
            order.source_payload &&
            typeof order.source_payload === "object" &&
            typeof (order.source_payload as Record<string, unknown>).priceRaisedAt === "string" &&
            Boolean((order.source_payload as Record<string, unknown>).priceRaisedAt);

          await sendPushToOnlineDrivers({
            title: isUrgent ? "有急單呀, 快D睇下" : "有新訂單可接",
            body: `訂單已重新釋出，配送費 MOP ${order.assigned_fee_mop ?? 0}。`,
            soundKey: isUrgent ? "urgent_order" : "new_order",
            data: {
              type: "new_order",
              externalOrderId: order.external_order_id,
              urgent: String(isUrgent),
              deliveryFeeMop: String(order.assigned_fee_mop ?? 0),
              playSound: "false"
            }
          }).catch(() => undefined);
        } else {
          await supabase.from("orders").update({ status: "canceled", updated_at: now }).eq("id", params.orderId);
        }
      } else if (order.status === "arrived_customer") {
        await supabase.from("orders").update({ status: "canceled", updated_at: now }).eq("id", params.orderId);
      } else {
        const { data: latestAssignment } = await supabase
          .from("order_assignments")
          .select("id")
          .eq("order_id", params.orderId)
          .eq("driver_id", verified.driverId)
          .is("canceled_at", null)
          .order("assigned_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestAssignment?.id) {
          await supabase
            .from("order_assignments")
            .update({ canceled_at: now })
            .eq("id", latestAssignment.id);
        }

        await supabase.from("orders").update({ status: "new", updated_at: now }).eq("id", params.orderId);

        const isUrgent =
          order.source_payload &&
          typeof order.source_payload === "object" &&
          typeof (order.source_payload as Record<string, unknown>).priceRaisedAt === "string" &&
          Boolean((order.source_payload as Record<string, unknown>).priceRaisedAt);

        await sendPushToOnlineDrivers({
          title: isUrgent ? "有急單呀, 快D睇下" : "有新訂單可接",
          body: `訂單已重新釋出，配送費 MOP ${order.assigned_fee_mop ?? 0}。`,
          soundKey: isUrgent ? "urgent_order" : "new_order",
          data: {
            type: "new_order",
            externalOrderId: order.external_order_id,
            urgent: String(isUrgent),
            deliveryFeeMop: String(order.assigned_fee_mop ?? 0),
            playSound: "false"
          }
        }).catch(() => undefined);
      }

      await supabase.from("order_events").insert({
        order_id: params.orderId,
        event_type: "issue_reported",
        actor_type: "driver",
        actor_driver_id: verified.driverId,
        payload: cancelPayload
      });
    }

    const shouldDispatchCancelCallback =
      body.eventType !== "canceled" ||
      order.status === "arrived_customer" ||
      (order.status === "picked_up" && body.action !== "grace_release");

    const callbackResult = shouldDispatchCancelCallback
      ? await dispatchOrderCallback({
          orderId: params.orderId,
          eventType:
            body.eventType === "canceled"
              ? "canceled"
              : body.eventType,
          note:
            body.eventType === "canceled"
              ? body.cancelReason ?? body.note
              : body.note,
          action: body.action
        } as any)
      : { success: true, skipped: true };

    return NextResponse.json(
      {
        success: true,
        orderId: params.orderId,
        eventType: body.eventType,
        callback: callbackResult
      },
      { status: callbackResult.success ? 200 : 502 }
    );
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Update status failed." },
      { status: 500 }
    );
  }
}
