import { redirect } from "next/navigation";

import { DriverPendingActions } from "@/components/driver-web/driver-pending-actions";
import { getDriverSession } from "@/lib/driver-web-auth";
import { getDriverReviewStatus } from "@/lib/driver-web-data";

export default async function DriverPendingPage() {
  const session = getDriverSession();
  if (!session) redirect("/driver/login");
  if (session.approvalStatus === "approved") redirect("/driver/home");

  const review = await getDriverReviewStatus(session.driverId);
  const title =
    session.approvalStatus === "suspended"
      ? "帳號已被停用"
      : session.approvalStatus === "rejected"
        ? "申請未通過"
        : "等待審核";
  const description =
    session.approvalStatus === "suspended"
      ? "請聯絡後台確認停用原因。"
      : session.approvalStatus === "rejected"
        ? "請按審核說明修正資料後重新提交。"
        : "後台正在核對你的自拍照、澳門身份證與駕駛執照。";

  return (
    <div className="driver-auth-card card stack gap-4">
      <h1 className="driver-screen-title">{title}</h1>
      <p className="muted">{description}</p>
      {review.reviewNote ? (
        <div className="card stack gap-2">
          <strong>審核說明</strong>
          <div>{review.reviewNote}</div>
          {review.reviewedAt ? <div className="muted">{review.reviewedAt}</div> : null}
        </div>
      ) : null}

      <DriverPendingActions showResubmit={session.approvalStatus === "rejected"} />
    </div>
  );
}
