import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { ENV_PLACEHOLDERS } from "../../../../../lib/data";
import { createServiceRoleSupabaseClient } from "../../../../../lib/supabase";

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

  return { driverId: driver.id as string };
}

function startOfWeekMacauUtcIso(now = new Date()) {
  // Macau = UTC+8, no DST
  const localMs = now.getTime() + 8 * 60 * 60 * 1000;
  const local = new Date(localMs);
  const day = local.getUTCDay(); // 0 Sun .. 6 Sat (but in our shifted "local" time)
  // we want Monday as start
  const diffToMonday = (day + 6) % 7;
  const startLocal = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 0, 0, 0));
  startLocal.setUTCDate(startLocal.getUTCDate() - diffToMonday);
  const startUtcMs = startLocal.getTime() - 8 * 60 * 60 * 1000;
  return new Date(startUtcMs).toISOString();
}

export async function GET(request: Request) {
  const accessToken = request.headers.get("x-supabase-access-token")?.trim();
  if (!accessToken) {
    return NextResponse.json(
      { message: "Missing x-supabase-access-token header." },
      { status: 401 }
    );
  }

  const verified = await verifyDriver(accessToken);
  if (!verified) {
    return NextResponse.json({ message: "Driver access verification failed." }, { status: 403 });
  }

  try {
    const weekStart = startOfWeekMacauUtcIso();
    const supabase = createServiceRoleSupabaseClient();

    const { data: events, error } = await supabase
      .from("order_events")
      .select("actor_driver_id,created_at")
      .eq("event_type", "delivered")
      .gte("created_at", weekStart)
      .not("actor_driver_id", "is", null);

    if (error) throw error;

    const counts = new Map<string, number>();
    for (const row of (events ?? []) as any[]) {
      const driverId = String(row.actor_driver_id || "").trim();
      if (!driverId) continue;
      counts.set(driverId, (counts.get(driverId) ?? 0) + 1);
    }

    const driverIds = Array.from(counts.keys());
    const { data: drivers } = driverIds.length
      ? await supabase
          .from("driver_profiles")
          .select("id,full_name")
          .in("id", driverIds)
      : { data: [] };

    const nameById = new Map<string, string>((drivers ?? []).map((d: any) => [d.id, d.full_name ?? "車手"])) ;

    const all = driverIds
      .map((id) => ({
        driverId: id,
        name: nameById.get(id) ?? "車手",
        completedCount: counts.get(id) ?? 0
      }))
      .sort((a, b) => {
        if (b.completedCount !== a.completedCount) return b.completedCount - a.completedCount;
        return a.driverId.localeCompare(b.driverId);
      });

    // rank (dense)
    let rank = 0;
    let prevCount: number | null = null;
    const ranked = all.map((item, index) => {
      if (prevCount === null || item.completedCount !== prevCount) {
        rank = index + 1;
        prevCount = item.completedCount;
      }
      return { ...item, rank };
    });

    const top = ranked.slice(0, 20).map((item) => ({
      rank: item.rank,
      name: item.name,
      completedCount: item.completedCount
    }));

    const meRow = ranked.find((r) => r.driverId === verified.driverId) ?? null;

    return NextResponse.json({
      success: true,
      range: "this_week",
      weekStart,
      generatedAt: new Date().toISOString(),
      top,
      me: meRow
        ? { rank: meRow.rank, name: meRow.name, completedCount: meRow.completedCount }
        : { rank: null, name: nameById.get(verified.driverId) ?? "車手", completedCount: 0 }
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Load leaderboard failed." },
      { status: 500 }
    );
  }
}
