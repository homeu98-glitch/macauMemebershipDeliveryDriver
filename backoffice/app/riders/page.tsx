import { RidersTable } from "../../components/backoffice";
import { listRiders } from "../../lib/server-data";

export default async function RidersPage() {
  const riders = await listRiders();
  return <RidersTable riders={riders} />;
}
