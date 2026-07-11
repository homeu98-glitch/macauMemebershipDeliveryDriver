import { redirect } from "next/navigation";

import { DriverNotificationsClient } from "@/components/driver-web/driver-notifications-client";
import { getDriverSession } from "@/lib/driver-web-auth";

export default function DriverNotificationsPage() {
  const session = getDriverSession();
  if (!session) redirect("/driver/login?next=/driver/notifications");
  if (session.approvalStatus !== "approved") redirect("/driver/pending");
  return <DriverNotificationsClient />;
}
