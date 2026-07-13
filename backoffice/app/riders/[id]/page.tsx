import Link from "next/link";
import { notFound } from "next/navigation";

import { getRiderDetailById } from "@/lib/server-data";

function labelStatus(value: string | null | undefined) {
  switch (value) {
    case "approved":
      return "已核准";
    case "pending_review":
    case "pending":
      return "待審核";
    case "rejected":
      return "已拒絕";
    case "suspended":
      return "已停用";
    case "online":
      return "在線";
    case "offline":
      return "離線";
    case "assigned":
      return "已指派";
    case "picked_up":
      return "已取餐";
    case "delivered":
      return "已送達";
    case "canceled":
      return "已取消";
    case "failed":
      return "失敗";
    default:
      return value ?? "未提供";
  }
}

function cancelHandlingLabel(value?: string | null) {
  if (value === "return_to_shop") return "退回商戶";
  if (value === "not_returning") return "不退回，等待商戶處理";
  return "未提供";
}

export default async function RiderDetailPage({ params }: { params: { id: string } }) {
  const rider = await getRiderDetailById(params.id);
  if (!rider) notFound();

  return (
    <div className="section-stack">
      <section className="card">
        <div className="card-header">
          <div>
            <div className="eyebrow">騎手明細</div>
            <h2 className="page-title" style={{ marginTop: 12, marginBottom: 6 }}>{rider.fullName}</h2>
            <p className="page-subtitle">查看這位騎手的基本資料、審核狀態與所有歷史訂單。</p>
          </div>
          <Link className="btn btn-secondary" href="/riders">返回騎手列表</Link>
        </div>

        <div className="inline-pills" style={{ marginBottom: 20 }}>
          <span className="pill">電話：{rider.phone}</span>
          <span className="pill">接單：{labelStatus(rider.availability)}</span>
          <span className="pill">審核：{labelStatus(rider.approvalStatus)}</span>
          <span className="pill">車型：{rider.vehicleType}</span>
          <span className="pill">建立時間：{rider.createdAt}</span>
          <span className="pill">歷史訂單：{rider.orders.length} 筆</span>
        </div>

        <div className="grid two-column" style={{ marginBottom: 20 }}>
          <section className="card" style={{ padding: 18 }}>
            <div className="card-header"><div><h3 className="card-title">申請資料</h3></div></div>
            <div className="list">
              <div className="list-item"><div><strong>提交審核</strong><div className="muted">{rider.applicationSubmittedAt ?? "未提供"}</div></div></div>
              <div className="list-item"><div><strong>審核結果</strong><div className="muted">{labelStatus(rider.reviewStatus)}</div></div></div>
              <div className="list-item"><div><strong>審核說明</strong><div className="muted">{rider.reviewNote ?? "未提供"}</div></div></div>
              <div className="list-item"><div><strong>最後審核時間</strong><div className="muted">{rider.reviewedAt ?? "未提供"}</div></div></div>
            </div>
          </section>

          <section className="card" style={{ padding: 18 }}>
            <div className="card-header"><div><h3 className="card-title">統計</h3></div></div>
            <div className="list">
              <div className="list-item"><div><strong>已送達</strong><div className="muted">{rider.orders.filter((item: any) => item.rawStatus === "delivered").length} 筆</div></div></div>
              <div className="list-item"><div><strong>已取消 / 失敗</strong><div className="muted">{rider.orders.filter((item: any) => item.rawStatus === "canceled" || item.rawStatus === "failed").length} 筆</div></div></div>
              <div className="list-item"><div><strong>急單</strong><div className="muted">{rider.orders.filter((item: any) => item.isUrgent).length} 筆</div></div></div>
            </div>
          </section>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">歷史訂單</h3>
            <p className="muted">列出這位騎手曾接過的所有訂單，包含訂單內容與時間線。</p>
          </div>
        </div>

        {!rider.orders.length ? (
          <div className="muted" style={{ padding: "16px 0" }}>目前沒有歷史訂單資料。</div>
        ) : (
          <div className="section-stack">
            {rider.orders.map((order: any) => (
              <article className="card" key={order.id} style={{ padding: 18 }}>
                <div className="card-header">
                  <div>
                    <h4 className="card-title" style={{ marginBottom: 6 }}>{order.displayOrderNo}</h4>
                    <div className="muted">{order.storeName} → {order.customerName}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <span className="pill">狀態：{labelStatus(order.rawStatus)}</span>
                    <span className="pill">配送費：MOP {order.amountMop}</span>
                    {order.isUrgent ? <span className="pill" style={{ background: "#ffe3e3", color: "#b3261e", borderColor: "#f0b0b0" }}>急單</span> : null}
                    <Link className="btn btn-secondary" href={`/orders/${order.id}`}>查看訂單詳情</Link>
                  </div>
                </div>

                <div className="grid two-column">
                  <section className="card" style={{ padding: 16 }}>
                    <div className="list">
                      <div className="list-item"><div><strong>派單時間</strong><div className="muted">{order.assignedAt}</div></div></div>
                      <div className="list-item"><div><strong>建立時間</strong><div className="muted">{order.createdAt}</div></div></div>
                      <div className="list-item"><div><strong>承諾送達</strong><div className="muted">{order.promisedAt ?? "未提供"}</div></div></div>
                      <div className="list-item"><div><strong>客戶地址</strong><div className="muted">{order.address}</div></div></div>
                      <div className="list-item"><div><strong>訂單內容</strong><div className="inline-pills" style={{ marginTop: 8 }}>{order.items.length ? order.items.map((item: string) => <span className="pill" key={item}>{item}</span>) : <span className="muted">目前沒有品項資料</span>}</div></div></div>
                      {order.rawStatus === "canceled" || order.rawStatus === "failed" ? (
                        <div className="list-item">
                          <div>
                            <strong>取消/異常資料</strong>
                            <div className="muted">原因：{order.cancelReason || "未提供"}{order.cancelOtherReason ? ` / ${order.cancelOtherReason}` : ""}</div>
                            <div className="muted">處理方式：{cancelHandlingLabel(order.cancelHandling)}</div>
                            <div className="muted">商戶確認：{order.shopOwnerCancelConfirmedAt ? `${order.shopOwnerCancelConfirmedAt} (${order.shopOwnerCancelConfirmedBy ?? "未記錄"})` : "尚未確認"}</div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </section>

                  <section className="card" style={{ padding: 16 }}>
                    <div className="card-header"><div><h4 className="card-title">時間線</h4></div></div>
                    <div className="timeline">
                      {order.timeline.length ? order.timeline.map((entry: any) => (
                        <div className="timeline-item" key={`${order.id}-${entry.label}-${entry.timestamp}`}>
                          <div className="timeline-dot" />
                          <div>
                            <strong>{entry.label}</strong>
                            <div className="muted">{entry.timestamp}</div>
                            <div className="muted">{entry.note}</div>
                          </div>
                        </div>
                      )) : <div className="muted">目前沒有事件紀錄。</div>}
                    </div>
                  </section>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
