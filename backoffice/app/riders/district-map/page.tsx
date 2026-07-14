import { RiderDistrictMap } from "@/components/rider-district-map";
import { getOnlineRiderDistrictCounts } from "@/lib/server-data";

export const dynamic = "force-dynamic";

export default async function RiderDistrictMapPage() {
  const result = await getOnlineRiderDistrictCounts({ recentMinutes: 15 });
  return (
    <RiderDistrictMap
      counts={result.counts}
      unknown={result.unknown}
      totalOnline={result.totalOnline}
      recentMinutes={result.recentMinutes}
    />
  );
}
