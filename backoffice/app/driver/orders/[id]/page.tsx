import { redirect } from "next/navigation";

import { DriverOrderDetailClient } from "@/components/driver-web/driver-order-detail-client";
import { getDriverSession } from "@/lib/driver-web-auth";

export default function DriverOrderDetailPage({ params }: { params: { id: string } }) {
  const session = getDriverSession();
  if (!session) redirect(`/driver/login?next=/driver/orders/${params.id}`);
  if (session.approvalStatus !== "approved") redirect("/driver/pending");
  return <DriverOrderDetailClient orderId={params.id} />;
}
