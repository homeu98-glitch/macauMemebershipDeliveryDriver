import { PushTokensBoard } from "@/components/backoffice";
import { listPushTokenRegistrations } from "@/lib/server-data";

export default async function PushTokensPage() {
  return <PushTokensBoard tokens={await listPushTokenRegistrations()} />;
}
