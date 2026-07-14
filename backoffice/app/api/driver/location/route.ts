import { NextResponse } from "next/server";

import { withDriverSession } from "@/app/api/driver/_shared";
import { createServiceRoleSupabaseClient } from "@/lib/supabase";

export async function POST(request: Request) {
  return withDriverSession(async (session) => {
    const body = (await request.json().catch(() => ({}))) as {
      latitude?: number;
      longitude?: number;
      speedMps?: number | null;
      heading?: number | null;
    };

    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    const speedMps = body.speedMps == null ? null : Number(body.speedMps);
    const heading = body.heading == null ? null : Number(body.heading);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json({ message: "缺少有效定位資料。" }, { status: 400 });
    }

    const supabase = createServiceRoleSupabaseClient();
    const { error } = await supabase.from("driver_locations").insert({
      driver_id: session.driverId,
      latitude,
      longitude,
      speed_mps: Number.isFinite(speedMps as number) ? speedMps : null,
      heading: Number.isFinite(heading as number) ? heading : null
    });

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  });
}
