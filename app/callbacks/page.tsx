import { CallbackLogsTable } from "@/components/backoffice";
import { listCallbackLogs } from "@/lib/server-data";

export default async function CallbackLogsPage() {
  const callbackLogs = await listCallbackLogs();
  return <CallbackLogsTable logs={callbackLogs} />;
}
