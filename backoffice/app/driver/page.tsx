import { redirect } from "next/navigation";

import { getDriverSession } from "@/lib/driver-web-auth";

export default function DriverEntryPage() {
  const session = getDriverSession();
  if (!session) redirect("/driver/login");
  if (session.approvalStatus === "approved") redirect("/driver/home");
  redirect("/driver/pending");
}
