import { redirect } from "next/navigation";

import { DriverOrdersClient } from "@/components/driver-web/driver-orders-client";
import { getDriverSession } from "@/lib/driver-web-auth";

export default function DriverOrdersPage() {
  const session = getDriverSession();
  if (!session) redirect("/driver/login?next=/driver/orders");
  if (session.approvalStatus !== "approved") redirect("/driver/pending");
  return <DriverOrdersClient />;
}
