import { BackofficeTestingPanel } from "../../components/backoffice";
import { listIncomingCallbackReceipts } from "../../lib/server-data";

export default async function TestingPage() {
  const receipts = await listIncomingCallbackReceipts();
  return <BackofficeTestingPanel receipts={receipts} />;
}
