import { createServiceRoleSupabaseClient } from "@/lib/supabase";
import { findMacauDistrict, listMacauDistrictNames } from "@/lib/districts";
import { requireSiteBApiAuth } from "@/lib/siteb-api-auth";
import { apiError, apiSuccess } from "@/lib/siteb-http";

const EFFECTIVE_WINDOW_MINUTES = 3;

type DriverPresence = {
  id: string;
  fullName: string;
  phone: string;
  effectiveOnline: boolean;
  district: string;
  lastHeartbeatAt: string | null;
  lastLocationAt: string | null;
};

export async function GET(request: Request) {
  const claims = requireSiteBApiAuth(request);
  if (!claims) {
    return apiError(401, "unauthorized", "Unauthorized.");
  }

  const url = new URL(request.url);
  const includeDrivers = url.searchParams.get("includeDrivers") !== "false";
  const sinceIso = new Date(Date.now() - EFFECTIVE_WINDOW_MINUTES * 60 * 1000).toISOString();

  const supabase = createServiceRoleSupabaseClient();

  // 有效在線：手動 online + last_heartbeat_at 在窗口內 + 已核准
  const { data: onlineDrivers, error: driversError } = await supabase
    .from("driver_profiles")
    .select("id,full_name,phone,availability,approval_status,last_heartbeat_at")
    .eq("availability", "online")
    .eq("approval_status", "approved")
    .gte("last_heartbeat_at", sinceIso);

  if (driversError) {
    return apiError(500, "presence_query_failed", driversError.message);
  }

  const driverRows = (onlineDrivers ?? []) as Array<any>;
  const driverIds = driverRows.map((row) => row.id as string);

  // 地區：嚴格規則 —— 必須在同一個窗口內有定位
  const { data: locationRows, error: locationsError } = driverIds.length
    ? await supabase
        .from("driver_locations")
        .select("driver_id,latitude,longitude,captured_at")
        .in("driver_id", driverIds)
        .gte("captured_at", sinceIso)
        .order("captured_at", { ascending: false })
    : { data: [], error: null };

  if (locationsError) {
    return apiError(500, "presence_location_failed", locationsError.message);
  }

  const latestLocationByDriver = new Map<string, { latitude: number; longitude: number; capturedAt: string }>();
  for (const row of (locationRows ?? []) as Array<any>) {
    if (latestLocationByDriver.has(row.driver_id)) continue;
    latestLocationByDriver.set(row.driver_id, {
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      capturedAt: row.captured_at
    });
  }

  const districts = [...listMacauDistrictNames(), "unknown"];
  const districtCounts: Record<string, number> = Object.fromEntries(districts.map((name) => [name, 0]));

  const drivers: DriverPresence[] = driverRows.map((row) => {
    const driverId = row.id as string;
    const loc = latestLocationByDriver.get(driverId) ?? null;
    const district =
      loc && Number.isFinite(loc.latitude) && Number.isFinite(loc.longitude)
        ? findMacauDistrict(loc.latitude, loc.longitude) ?? "unknown"
        : "unknown";

    districtCounts[district] = (districtCounts[district] ?? 0) + 1;

    return {
      id: driverId,
      fullName: row.full_name ?? "未命名車手",
      phone: row.phone ?? "",
      effectiveOnline: true,
      district,
      lastHeartbeatAt: row.last_heartbeat_at ?? null,
      lastLocationAt: loc?.capturedAt ?? null
    };
  });

  return apiSuccess(
    {
      effectiveWindowMinutes: EFFECTIVE_WINDOW_MINUTES,
      totalOnline: driverIds.length,
      districts: districts.map((name) => ({
        district: name,
        onlineCount: districtCounts[name] ?? 0
      })),
      ...(includeDrivers ? { drivers } : {})
    },
    200
  );
}
