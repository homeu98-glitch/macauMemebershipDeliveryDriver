import { redirect } from "next/navigation";

import { DriverEarningsClient } from "@/components/driver-web/driver-earnings-client";
import { getDriverSession } from "@/lib/driver-web-auth";

export default function DriverEarningsPage() {
  const session = getDriverSession();
  if (!session) redirect("/driver/login?next=/driver/earnings");
  if (session.approvalStatus !== "approved") redirect("/driver/pending");
  return <DriverEarningsClient />;
}
