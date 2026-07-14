import { OrdersTable } from "../../components/backoffice";
import { listOrders } from "../../lib/server-data";

export const dynamic = "force-dynamic";
export default async function OrdersPage() {
  const orders = await listOrders();
  return <OrdersTable orders={orders} />;
}