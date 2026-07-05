import { RiderApplicationsBoard } from "../../../components/backoffice";
import { listRiderApplications } from "../../../lib/server-data";

export default async function RiderApplicationsPage() {
  const applications = await listRiderApplications();
  return <RiderApplicationsBoard applications={applications} />;
}
