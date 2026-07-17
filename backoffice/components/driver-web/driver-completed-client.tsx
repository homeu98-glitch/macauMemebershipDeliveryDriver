"use client";

import { useEffect, useState } from "react";

import { DriverChatIconButton, DriverOrderChatModal, type OrderChatMeta, useDriverChatUnreadMap } from "@/components/driver-web/driver-chat";

type CompletedOrder = {
  id: string;
  externalOrderId: string;
  transactionCode: string | null;
  storeName: string;
  customerName: string;
  customerAddress: string;
  amountMop: number;
  deliveredAt: string;
  chat: OrderChatMeta;
  hasUnread: boolean;
};

export function DriverCompletedClient() {
  const [orders, setOrders] = useState<CompletedOrder[]>([]);
  const [previewOrder, setPreviewOrder] = useState<CompletedOrder | null>(null);
  const [hiddenProofIds, setHiddenProofIds] = useState<Record<string, boolean>>({});
  const [range, setRange] = useState<"today" | "yesterday">("today");
  const [chatOrder, setChatOrder] = useState<CompletedOrder | null>(null);

  useEffect(() => {
    fetch(`/api/driver/orders/completed?range=${range}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((payload) => setOrders(((payload as { orders?: CompletedOrder[] }).orders ?? []) as CompletedOrder[]))
      .catch(() => undefined);
  }, [range]);

  const chatUnread = useDriverChatUnreadMap(orders.map((order) => ({ id: order.id, chat: order.chat, hasUnread: order.hasUnread })));

  function openChat(order: CompletedOrder) {
    setChatOrder(order);
    chatUnread.markRead(order.id, order.chat);
  }

  return (
    <>
      <div className="stack gap-3">
        <div className="stack gap-2">
          <div className="driver-screen-title">完成訂單</div>
          <div className="driver-inline-between">
            <div className="muted small-copy">顯示範圍</div>
            <div className="driver-inline-between" style={{ gap: 8 }}>
              <button
                className={range === "today" ? "android-primary-btn small" : "android-secondary-btn small"}
                onClick={() => setRange("today")}
                type="button"
              >
                今天
              </button>
              <button
                className={range === "yesterday" ? "android-primary-btn small" : "android-secondary-btn small"}
                onClick={() => setRange("yesterday")}
                type="button"
              >
                昨天
              </button>
            </div>
          </div>
        </div>

        {orders.length === 0 ? <div className="android-card muted">暫時沒有完成訂單。</div> : null}
        {orders.map((order) => (
          <section className="android-card stack gap-3" key={order.id}>
            <div className="driver-inline-between align-start">
              <div className="stack gap-1 grow minw-0" style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}>
                <div className="driver-order-title compact">{order.storeName}</div>
                <div className="order-subvalue tight">訂單號 {order.transactionCode ?? order.externalOrderId}</div>
                <div className="order-subvalue tight">客戶 {order.customerName}</div>
                <div className="order-subvalue tight" style={{ whiteSpace: "normal", overflowWrap: "anywhere", wordBreak: "break-word" }}>
                  地址 {order.customerAddress}
                </div>
                <div className="order-subvalue tight">完成時間 {order.deliveredAt}</div>
              </div>
              <div className="stack gap-2 align-end">
                <div className="money-chip large compact">MOP {order.amountMop.toFixed(1)}</div>
                {order.chat?.enabled && order.chat.messagesUrl ? <DriverChatIconButton className="driver-chat-icon-under-price" hasUnread={chatUnread.hasUnread(order.id)} onClick={() => openChat(order)} /> : null}
              </div>
            </div>
            {hiddenProofIds[order.id] ? (
              <div className="muted">送達照片：已上傳</div>
            ) : (
              <button className="android-secondary-btn" onClick={() => setPreviewOrder(order)} type="button">
                顯示送達照片
              </button>
            )}
          </section>
        ))}
      </div>

      {chatOrder ? (
        <DriverOrderChatModal
          orderId={chatOrder.id}
          orderLabel={chatOrder.transactionCode ?? chatOrder.externalOrderId}
          chat={chatOrder.chat}
          onClose={() => setChatOrder(null)}
          onRead={(latestMessageAt) => chatUnread.markRead(chatOrder.id, chatOrder.chat, latestMessageAt)}
        />
      ) : null}

      {previewOrder ? (
        <div className="driver-modal-backdrop" onClick={() => setPreviewOrder(null)}>
          <div className="driver-modal-card stack gap-3 proof-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="driver-screen-title small">送達照片</div>
            {!hiddenProofIds[previewOrder.id] ? (
              <img
                alt="delivery proof"
                className="driver-proof-preview"
                loading="lazy"
                onError={() => setHiddenProofIds((prev) => ({ ...prev, [previewOrder.id]: true }))}
                src={`/api/driver/orders/${previewOrder.id}/proof?ts=${Date.now()}`}
              />
            ) : (
              <div className="muted">這張訂單暫時無法顯示送達照片。</div>
            )}
            <button className="android-secondary-btn" onClick={() => setPreviewOrder(null)} type="button">
              關閉
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
