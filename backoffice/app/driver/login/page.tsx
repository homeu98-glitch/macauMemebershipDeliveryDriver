import { redirect } from "next/navigation";

import { DriverLoginForm } from "@/components/driver-web/driver-login-form";
import { getDriverSession } from "@/lib/driver-web-auth";

export default function DriverLoginPage() {
  const session = getDriverSession();
  if (session) redirect(session.approvalStatus === "approved" ? "/driver/home" : "/driver/pending");
  return <DriverLoginForm />;
}
