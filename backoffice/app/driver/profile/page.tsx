import { redirect } from "next/navigation";

import { DriverProfileClient } from "@/components/driver-web/driver-profile-client";
import { getDriverSession } from "@/lib/driver-web-auth";

export default function DriverProfilePage() {
  const session = getDriverSession();
  if (!session) redirect("/driver/login?next=/driver/profile");
  if (session.approvalStatus !== "approved") redirect("/driver/pending");
  return <DriverProfileClient />;
}
