import { RiderDistrictMap } from "@/components/rider-district-map";
import { getOnlineRiderDistrictCounts } from "@/lib/server-data";

export const dynamic = "force-dynamic";

export default async function RiderDistrictMapPage() {
  const result = await getOnlineRiderDistrictCounts({ recentMinutes: 3 });
  return (
    <RiderDistrictMap
      counts={result.counts}
      ridersByDistrict={result.ridersByDistrict}
      unknown={result.unknown}
      unknownRiders={result.unknownRiders}
      totalOnline={result.totalOnline}
      recentMinutes={result.recentMinutes}
      lastUpdatedAt={result.lastUpdatedAt}
    />
  );
}
