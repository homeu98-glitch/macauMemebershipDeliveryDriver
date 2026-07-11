import { redirect } from "next/navigation";

import { DriverCompletedClient } from "@/components/driver-web/driver-completed-client";
import { getDriverSession } from "@/lib/driver-web-auth";

export default function DriverCompletedPage() {
  const session = getDriverSession();
  if (!session) redirect("/driver/login?next=/driver/completed");
  if (session.approvalStatus !== "approved") redirect("/driver/pending");
  return <DriverCompletedClient />;
}
