"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type OrderChatMeta = {
  enabled: boolean;
  messagesUrl: string | null;
} | null;

type ChatOrderTarget = {
  id: string;
  chat: OrderChatMeta;
};

type ChatItem = {
  id: string;
  senderRole: string;
  senderLabel: string | null;
  body: string | null;
  createdAt: string;
  imageUrl: string | null;
};

type ChatResponse = {
  roomKind?: string;
  writable?: boolean;
  items?: unknown[];
  message?: unknown;
};

const READ_STORAGE_PREFIX = "driver_chat_last_read:";

function buildReadStorageKey(messagesUrl: string) {
  return `${READ_STORAGE_PREFIX}${messagesUrl}`;
}

function readStoredLastRead(messagesUrl: string | null | undefined) {
  if (!messagesUrl || typeof window === "undefined") return null;
  return window.localStorage.getItem(buildReadStorageKey(messagesUrl));
}

function writeStoredLastRead(messagesUrl: string | null | undefined, value: string | null) {
  if (!messagesUrl || !value || typeof window === "undefined") return;
  window.localStorage.setItem(buildReadStorageKey(messagesUrl), value);
}

function normalizeChatItems(items: unknown[]): ChatItem[] {
  return items
    .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>) : null))
    .filter(Boolean)
    .map((item) => ({
      id: typeof item?.id === "string" ? item.id : `${String(item?.created_at ?? "")}-${String(item?.sender_role ?? "")}`,
      senderRole: typeof item?.sender_role === "string" ? item.sender_role : "unknown",
      senderLabel: typeof item?.sender_label === "string" ? item.sender_label : null,
      body: typeof item?.body === "string" && item.body.trim() ? item.body : null,
      createdAt: typeof item?.created_at === "string" ? item.created_at : new Date().toISOString(),
      imageUrl: typeof item?.image_url === "string" && item.image_url.trim() ? item.image_url : null
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function mergeChatItems(current: ChatItem[], incoming: ChatItem[]) {
  const map = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) {
    map.set(item.id, item);
  }
  return [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function latestTimestamp(items: ChatItem[]) {
  return items.length ? items[items.length - 1]?.createdAt ?? null : null;
}

async function fileToBase64(file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("file_read_failed"));
    reader.readAsDataURL(file);
  });
  const [, base64 = ""] = dataUrl.split(",");
  return base64;
}

export function useDriverChatUnreadMap(orders: ChatOrderTarget[]) {
  const [state, setState] = useState<Record<string, { hasUnread: boolean; latestMessageAt: string | null }>>({});
  const latestFetchedRef = useRef<Record<string, string | null>>({});

  const stableTargets = useMemo(
    () => orders.filter((order) => order.chat?.enabled && order.chat?.messagesUrl),
    [orders]
  );

  useEffect(() => {
    if (stableTargets.length === 0) return;
    let disposed = false;

    async function poll() {
      const updates = await Promise.all(
        stableTargets.map(async (order) => {
          try {
            const since = latestFetchedRef.current[order.id];
            const response = await fetch(
              `/api/driver/orders/${order.id}/chat${since ? `?since=${encodeURIComponent(since)}` : ""}`,
              { cache: "no-store" }
            );
            if (!response.ok) return null;
            const payload = (await response.json()) as ChatResponse;
            const items = normalizeChatItems(Array.isArray(payload.items) ? payload.items : []);
            const latestIncomingAt = latestTimestamp(items);
            const storedReadAt = readStoredLastRead(order.chat?.messagesUrl ?? null);
            if (latestIncomingAt) {
              latestFetchedRef.current[order.id] = latestIncomingAt;
            }
            const hasUnread = items.some((item) => item.senderRole !== "driver" && (!storedReadAt || item.createdAt > storedReadAt));
            return {
              orderId: order.id,
              latestMessageAt: latestIncomingAt ?? latestFetchedRef.current[order.id] ?? null,
              hasUnread
            };
          } catch {
            return null;
          }
        })
      );

      if (disposed) return;
      setState((current) => {
        const next = { ...current };
        for (const update of updates) {
          if (!update) continue;
          const prev = current[update.orderId];
          next[update.orderId] = {
            latestMessageAt: update.latestMessageAt,
            hasUnread: update.hasUnread || Boolean(prev?.hasUnread)
          };
        }
        return next;
      });
    }

    void poll();
    const timer = window.setInterval(poll, 15000);
    const onFocus = () => { if (document.visibilityState !== "hidden") void poll(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [stableTargets]);

  function markRead(orderId: string, chat: OrderChatMeta, explicitLatestMessageAt?: string | null) {
    if (!chat?.messagesUrl) return;
    const readAt = explicitLatestMessageAt ?? state[orderId]?.latestMessageAt ?? null;
    if (readAt) {
      writeStoredLastRead(chat.messagesUrl, readAt);
    }
    setState((current) => ({
      ...current,
      [orderId]: {
        latestMessageAt: explicitLatestMessageAt ?? current[orderId]?.latestMessageAt ?? null,
        hasUnread: false
      }
    }));
  }

  return {
    hasUnread(orderId: string) {
      return Boolean(state[orderId]?.hasUnread);
    },
    latestMessageAt(orderId: string) {
      return state[orderId]?.latestMessageAt ?? null;
    },
    markRead
  };
}

export function DriverChatIconButton({ hasUnread, onClick, disabled = false }: { hasUnread: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button className="driver-chat-icon-btn" disabled={disabled} onClick={onClick} type="button" aria-label="打開聊天">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7 18.5c-1.1 0-2-.9-2-2v-8C5 7.1 5.9 6.2 7 6.2h10c1.1 0 2 .9 2 2v8c0 1.1-.9 2-2 2H10l-3.6 2.6c-.2.1-.4 0-.4-.2V18.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
        <path d="M8.5 10.5h7M8.5 13.5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
      {hasUnread ? <span className="driver-chat-unread-dot" aria-hidden="true" /> : null}
    </button>
  );
}

export function DriverOrderChatModal({
  orderId,
  orderLabel,
  chat,
  onClose,
  onRead
}: {
  orderId: string;
  orderLabel: string;
  chat: OrderChatMeta;
  onClose: () => void;
  onRead?: (latestMessageAt: string | null) => void;
}) {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [roomKind, setRoomKind] = useState<string | null>(null);
  const [writable, setWritable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const latestFetchedAtRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!chat?.enabled || !chat.messagesUrl) {
      setLoading(false);
      setError("此訂單未啟用聊天。");
      return;
    }

    let disposed = false;

    async function load(initial = false) {
      try {
        const response = await fetch(
          `/api/driver/orders/${orderId}/chat${!initial && latestFetchedAtRef.current ? `?since=${encodeURIComponent(latestFetchedAtRef.current)}` : ""}`,
          { cache: "no-store" }
        );
        const payload = (await response.json().catch(() => ({}))) as ChatResponse & { message?: string };
        if (!response.ok) {
          throw new Error(payload.message || "載入聊天失敗。");
        }
        const incomingItems = normalizeChatItems(Array.isArray(payload.items) ? payload.items : []);
        const mergedItems = initial ? incomingItems : mergeChatItems(items, incomingItems);
        if (disposed) return;
        setRoomKind(typeof payload.roomKind === "string" ? payload.roomKind : roomKind);
        setWritable(payload.writable !== false);
        setItems(mergedItems);
        const latestAt = latestTimestamp(mergedItems);
        if (latestAt) {
          latestFetchedAtRef.current = latestAt;
          onRead?.(latestAt);
        }
        setError(null);
      } catch (nextError) {
        if (!disposed) {
          setError(nextError instanceof Error ? nextError.message : "載入聊天失敗。");
        }
      } finally {
        if (!disposed) setLoading(false);
      }
    }

    void load(true);
    const timer = window.setInterval(() => void load(false), 15000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [chat, orderId, onRead, roomKind, items]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [items.length]);

  async function handleSend() {
    if (!writable || sending) return;
    const trimmed = messageText.trim();
    if (!trimmed && !imageBase64) return;

    setSending(true);
    try {
      const response = await fetch(`/api/driver/orders/${orderId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: trimmed || null,
          imageBase64,
          clientMsgId: `${orderId}-${Date.now()}`
        })
      });
      const payload = (await response.json().catch(() => ({}))) as ChatResponse & { message?: string };
      if (!response.ok) {
        throw new Error(payload.message || "發送訊息失敗。");
      }
      const message = normalizeChatItems(payload.message ? [payload.message] : []);
      const merged = mergeChatItems(items, message);
      setRoomKind(typeof payload.roomKind === "string" ? payload.roomKind : roomKind);
      setWritable(payload.writable !== false);
      setItems(merged);
      const latestAt = latestTimestamp(merged);
      if (latestAt) {
        latestFetchedAtRef.current = latestAt;
        onRead?.(latestAt);
      }
      setMessageText("");
      setImageBase64(null);
      setImageName(null);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "發送訊息失敗。");
    } finally {
      setSending(false);
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const nextBase64 = await fileToBase64(file);
      setImageBase64(nextBase64);
      setImageName(file.name);
    } catch {
      setError("讀取圖片失敗。");
    } finally {
      event.target.value = "";
    }
  }

  return (
    <div className="driver-modal-backdrop" onClick={onClose}>
      <div className="driver-modal-card driver-chat-modal-card stack gap-3" onClick={(event) => event.stopPropagation()}>
        <div className="driver-inline-between align-start gap-2">
          <div className="stack gap-1 grow minw-0">
            <div className="driver-screen-title small">訂單聊天</div>
            <div className="order-subvalue tight">{orderLabel}</div>
            {roomKind ? <div className="order-subvalue tight">{roomKind === "external_dispatch" ? "外部派單對話" : "會員訂單對話"}</div> : null}
          </div>
          <button className="android-secondary-btn small" onClick={onClose} type="button">關閉</button>
        </div>

        <div className="driver-chat-list" ref={listRef}>
          {loading ? <div className="muted">載入聊天中...</div> : null}
          {!loading && items.length === 0 ? <div className="muted">暫時沒有聊天訊息。</div> : null}
          {items.map((item) => (
            <div className={item.senderRole === "driver" ? "driver-chat-bubble self" : "driver-chat-bubble"} key={item.id}>
              <div className="driver-chat-sender">{item.senderLabel ?? item.senderRole}</div>
              {item.body ? <div className="driver-chat-body">{item.body}</div> : null}
              {item.imageUrl ? <img alt="chat attachment" className="driver-chat-image" src={item.imageUrl} /> : null}
              <div className="driver-chat-time">{new Date(item.createdAt).toLocaleString("zh-HK")}</div>
            </div>
          ))}
        </div>

        {error ? <div className="android-card error">{error}</div> : null}

        {imageName ? (
          <div className="driver-chat-attachment-row">
            <span className="order-subvalue tight">已選圖片：{imageName}</span>
            <button className="android-secondary-btn small" onClick={() => { setImageBase64(null); setImageName(null); }} type="button">移除</button>
          </div>
        ) : null}

        <div className="stack gap-2">
          <textarea
            className="driver-chat-textarea"
            disabled={!writable || sending}
            onChange={(event) => setMessageText(event.target.value)}
            placeholder={writable ? "輸入訊息…" : "此聊天已關閉，只可查看歷史訊息。"}
            rows={3}
            value={messageText}
          />
          <div className="driver-inline-between gap-2 wrap-safe">
            <div className="driver-inline-between gap-2 wrap-safe">
              <input accept="image/*" hidden onChange={handleFileChange} ref={fileInputRef} type="file" />
              <button className="android-secondary-btn small" disabled={!writable || sending} onClick={() => fileInputRef.current?.click()} type="button">選擇圖片</button>
            </div>
            <button className="android-primary-btn small" disabled={(!messageText.trim() && !imageBase64) || !writable || sending} onClick={handleSend} type="button">{sending ? "發送中..." : "發送"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
