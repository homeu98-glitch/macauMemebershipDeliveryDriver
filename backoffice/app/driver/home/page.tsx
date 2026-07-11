import { redirect } from "next/navigation";

import { DriverHomeClient } from "@/components/driver-web/driver-home-client";
import { getDriverSession } from "@/lib/driver-web-auth";

export default function DriverHomePage() {
  const session = getDriverSession();
  if (!session) redirect("/driver/login?next=/driver/home");
  if (session.approvalStatus !== "approved") redirect("/driver/pending");
  return <DriverHomeClient />;
}
