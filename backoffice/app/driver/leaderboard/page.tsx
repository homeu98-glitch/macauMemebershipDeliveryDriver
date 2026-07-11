import { redirect } from "next/navigation";

import { DriverLeaderboardClient } from "@/components/driver-web/driver-leaderboard-client";
import { getDriverSession } from "@/lib/driver-web-auth";

export default function DriverLeaderboardPage() {
  const session = getDriverSession();
  if (!session) redirect("/driver/login?next=/driver/leaderboard");
  if (session.approvalStatus !== "approved") redirect("/driver/pending");
  return <DriverLeaderboardClient />;
}
