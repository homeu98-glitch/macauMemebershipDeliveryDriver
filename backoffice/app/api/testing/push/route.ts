import { NextResponse } from "next/server";

import { getSessionUser } from "../../../../lib/auth";
import { createServiceRoleSupabaseClient } from "../../../../lib/supabase";
import { sendPushToDriver } from "../../../../lib/push-notifications";

export async function POST(request: Request) {
  const sessionUser = getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ message: "未登入後台。" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      phone?: string;
      title?: string;
      message?: string;
    };

    if (!body.phone?.trim()) {
      return NextResponse.json({ message: "phone is required." }, { status: 400 });
    }

    const supabase = createServiceRoleSupabaseClient();
    const { data: driver, error } = await supabase
      .from("driver_profiles")
      .select("id,full_name,phone")
      .eq("phone", body.phone.trim())
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!driver) {
      return NextResponse.json({ message: "找不到該騎手。" }, { status: 404 });
    }

    const result = await sendPushToDriver(driver.id, {
      title: body.title?.trim() || "測試推播",
      body: body.message?.trim() || "這是一則從配送後台送出的測試通知。",
      data: {
        type: "manual_test",
        driverId: driver.id,
      },
    });

    return NextResponse.json({
      success: true,
      driverName: driver.full_name,
      phone: driver.phone,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "測試推播失敗。",
      },
      { status: 500 }
    );
  }
}
