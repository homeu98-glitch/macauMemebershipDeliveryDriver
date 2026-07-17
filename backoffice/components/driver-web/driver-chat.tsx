"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type OrderChatMeta = {
  enabled: boolean;
  messagesUrl: string | null;
} | null;

type ChatOrderTarget = {
  id: string;
  chat: OrderChatMeta;
  hasUnread?: boolean;
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

type CachedChatPayload = {
  roomKind: string | null;
  writable: boolean;
  items: ChatItem[];
  latestFetchedAt: string | null;
};

const UNREAD_LOCAL_PREFIX = "driver_chat_unread:";
const READ_STORAGE_PREFIX = "driver_chat_last_read:";
const CHAT_CACHE_PREFIX = "driver_chat_cache:";
const CHAT_MODAL_POLL_INTERVAL_MS = 30000;
const CHAT_IMAGE_MAX_BYTES = 150 * 1024;
const CHAT_IMAGE_MAX_EDGE = 1280;

function buildReadStorageKey(messagesUrl: string) {
  return `${READ_STORAGE_PREFIX}${messagesUrl}`;
}

function buildUnreadStorageKey(messagesUrl: string) {
  return `${UNREAD_LOCAL_PREFIX}${messagesUrl}`;
}

function readStoredUnread(messagesUrl: string | null | undefined) {
  if (!messagesUrl || typeof window === "undefined") return false;
  return window.localStorage.getItem(buildUnreadStorageKey(messagesUrl)) === "1";
}

function writeStoredUnread(messagesUrl: string | null | undefined, value: boolean) {
  if (!messagesUrl || typeof window === "undefined") return;
  window.localStorage.setItem(buildUnreadStorageKey(messagesUrl), value ? "1" : "0");
}

function buildChatCacheKey(messagesUrl: string) {
  return `${CHAT_CACHE_PREFIX}${messagesUrl}`;
}

function readStoredLastRead(messagesUrl: string | null | undefined) {
  if (!messagesUrl || typeof window === "undefined") return null;
  return window.localStorage.getItem(buildReadStorageKey(messagesUrl));
}

function writeStoredLastRead(messagesUrl: string | null | undefined, value: string | null) {
  if (!messagesUrl || !value || typeof window === "undefined") return;
  window.localStorage.setItem(buildReadStorageKey(messagesUrl), value);
}

function readChatCache(messagesUrl: string | null | undefined): CachedChatPayload | null {
  if (!messagesUrl || typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(buildChatCacheKey(messagesUrl));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedChatPayload;
    if (!Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeChatCache(messagesUrl: string | null | undefined, payload: CachedChatPayload) {
  if (!messagesUrl || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(buildChatCacheKey(messagesUrl), JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
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

function isDriverMessage(senderRole: string, senderLabel: string | null) {
  const role = senderRole.trim().toLowerCase();
  const label = (senderLabel ?? "").trim().toLowerCase();
  return role === "driver" || role === "rider" || role === "courier" || role.includes("driver") || role.includes("rider") || label === "你" || label.includes("車手");
}

async function readFileAsDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("file_read_failed"));
    reader.readAsDataURL(file);
  });
}

async function loadImageFromDataUrl(dataUrl: string) {
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image_load_failed"));
    image.src = dataUrl;
  });
}

async function compressImageToBase64(file: File, maxBytes = CHAT_IMAGE_MAX_BYTES) {
  const originalDataUrl = await readFileAsDataUrl(file);
  if (file.size <= maxBytes) {
    const [, base64 = ""] = originalDataUrl.split(",");
    return base64;
  }

  const image = await loadImageFromDataUrl(originalDataUrl);
  const ratio = Math.min(1, CHAT_IMAGE_MAX_EDGE / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * ratio));
  const height = Math.max(1, Math.round(image.height * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("canvas_not_supported");
  }
  context.drawImage(image, 0, 0, width, height);

  const exportAtQuality = (quality: number) =>
    canvas.toDataURL(file.type === "image/png" ? "image/webp" : "image/jpeg", quality);

  let best = exportAtQuality(0.82);
  for (const quality of [0.76, 0.7, 0.62, 0.54, 0.46, 0.38, 0.3]) {
    const next = exportAtQuality(quality);
    best = next;
    const byteSize = Math.ceil((next.split(",")[1]?.length ?? 0) * 3 / 4);
    if (byteSize <= maxBytes) {
      break;
    }
  }

  const [, base64 = ""] = best.split(",");
  return base64;
}



export function useDriverChatUnreadMap(orders: ChatOrderTarget[]) {
  const [state, setState] = useState<Record<string, { hasUnread: boolean; latestMessageAt: string | null }>>({});

  const stableTargets = useMemo(
    () => orders.filter((order) => order.chat?.enabled && order.chat?.messagesUrl),
    [orders]
  );

  useEffect(() => {
    setState((current) => {
      const next = { ...current };
      for (const order of stableTargets) {
        next[order.id] = {
          latestMessageAt: current[order.id]?.latestMessageAt ?? null,
          hasUnread: order.hasUnread === true
        };
      }
      return next;
    });
  }, [stableTargets]);

  async function refresh(_force = false) {
    return;
  }

  function markRead(orderId: string, chat: OrderChatMeta, explicitLatestMessageAt?: string | null) {
    if (!chat?.messagesUrl) return;
    const readAt = explicitLatestMessageAt ?? state[orderId]?.latestMessageAt ?? null;
    if (readAt) {
      writeStoredLastRead(chat.messagesUrl, readAt);
    }
    writeStoredUnread(chat.messagesUrl, false);
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
      const direct = state[orderId]?.hasUnread;
      if (typeof direct === "boolean") return direct;
      const target = stableTargets.find((item) => item.id === orderId);
      return Boolean(target?.hasUnread ?? (target?.chat?.messagesUrl && readStoredUnread(target.chat.messagesUrl)));
    },
    latestMessageAt(orderId: string) {
      return state[orderId]?.latestMessageAt ?? null;
    },
    markRead,
    refresh
  };
}

export function DriverChatIconButton({ hasUnread, onClick, disabled = false, className = "" }: { hasUnread: boolean; onClick: () => void; disabled?: boolean; className?: string }) {
  return (
    <button className={className ? `driver-chat-icon-btn ${className}` : "driver-chat-icon-btn"} disabled={disabled} onClick={onClick} type="button" aria-label="打開聊天">
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
  const itemsRef = useRef<ChatItem[]>([]);
  const roomKindRef = useRef<string | null>(null);
  const onReadRef = useRef<typeof onRead>(onRead);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    roomKindRef.current = roomKind;
  }, [roomKind]);

  useEffect(() => {
    onReadRef.current = onRead;
  }, [onRead]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const chatEnabled = chat?.enabled === true;
  const chatMessagesUrl = chat?.messagesUrl ?? null;

  useEffect(() => {
    if (!chatEnabled || !chatMessagesUrl) {
      setLoading(false);
      setError("此訂單未啟用聊天。");
      return;
    }

    const cached = readChatCache(chatMessagesUrl);
    if (cached) {
      setItems(cached.items);
      setRoomKind(cached.roomKind);
      setWritable(cached.writable);
      latestFetchedAtRef.current = cached.latestFetchedAt;
      setLoading(false);
    } else {
      setItems([]);
      setRoomKind(null);
      setWritable(true);
      latestFetchedAtRef.current = null;
      setLoading(true);
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
        const currentItems = initial ? (cached?.items ?? []) : itemsRef.current;
        const mergedItems = initial ? mergeChatItems(currentItems, incomingItems) : mergeChatItems(currentItems, incomingItems);
        if (disposed) return;
        const nextRoomKind = typeof payload.roomKind === "string" ? payload.roomKind : roomKindRef.current;
        setRoomKind(nextRoomKind);
        setWritable(payload.writable !== false);
        setItems(mergedItems);
        const latestAt = latestTimestamp(mergedItems);
        if (latestAt) {
          latestFetchedAtRef.current = latestAt;
          onReadRef.current?.(latestAt);
        }
        writeChatCache(chatMessagesUrl, {
          roomKind: nextRoomKind,
          writable: payload.writable !== false,
          items: mergedItems,
          latestFetchedAt: latestAt
        });
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
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void load(false);
      }
    }, CHAT_MODAL_POLL_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void load(false);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [chatEnabled, chatMessagesUrl, orderId]);

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
      const merged = mergeChatItems(itemsRef.current, message);
      const nextRoomKind = typeof payload.roomKind === "string" ? payload.roomKind : roomKindRef.current;
      setRoomKind(nextRoomKind);
      setWritable(payload.writable !== false);
      setItems(merged);
      const latestAt = latestTimestamp(merged);
      if (latestAt) {
        latestFetchedAtRef.current = latestAt;
        onReadRef.current?.(latestAt);
      }
      writeChatCache(chatMessagesUrl, {
        roomKind: nextRoomKind,
        writable: payload.writable !== false,
        items: merged,
        latestFetchedAt: latestAt
      });
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
      const nextBase64 = await compressImageToBase64(file, CHAT_IMAGE_MAX_BYTES);
      setImageBase64(nextBase64);
      setImageName(file.name);
      setError(null);
    } catch {
      setError("讀取或壓縮圖片失敗。");
    } finally {
      event.target.value = "";
    }
  }

  return (
    <div className="driver-modal-backdrop driver-chat-backdrop" onClick={onClose}>
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
          {items.map((item) => {
            const self = isDriverMessage(item.senderRole, item.senderLabel);
            return (
              <div className={self ? "driver-chat-row self" : "driver-chat-row"} key={item.id}>
                <div className={self ? "driver-chat-bubble self" : "driver-chat-bubble"}>
                  <div className="driver-chat-sender">{self ? "你" : item.senderLabel ?? item.senderRole}</div>
                  {item.body ? <div className="driver-chat-body">{item.body}</div> : null}
                  {item.imageUrl ? <img alt="chat attachment" className="driver-chat-image" src={item.imageUrl} /> : null}
                  <div className="driver-chat-time">{new Date(item.createdAt).toLocaleString("zh-HK")}</div>
                </div>
              </div>
            );
          })}
        </div>

        {error ? <div className="android-card error">{error}</div> : null}

        {imageName ? (
          <div className="driver-chat-attachment-chip">
            <span className="order-subvalue tight">已選圖片：{imageName}</span>
            <button className="driver-chat-inline-icon danger" onClick={() => { setImageBase64(null); setImageName(null); }} type="button" aria-label="移除圖片">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        ) : null}

        <div className="driver-chat-composer">
          <input accept="image/*" hidden onChange={handleFileChange} ref={fileInputRef} type="file" />
          <button className="driver-chat-inline-icon" disabled={!writable || sending} onClick={() => fileInputRef.current?.click()} type="button" aria-label="選擇圖片">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 16.5v-9Z" stroke="currentColor" strokeWidth="1.8"/>
              <circle cx="9" cy="10" r="1.4" fill="currentColor"/>
              <path d="m7.5 17 3.3-3.3a1.2 1.2 0 0 1 1.7 0l1 1 1.7-1.7a1.2 1.2 0 0 1 1.7 0L19 15.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <textarea
            className="driver-chat-textarea"
            disabled={!writable || sending}
            onChange={(event) => setMessageText(event.target.value)}
            placeholder={writable ? "輸入訊息…" : "此聊天已關閉，只可查看歷史訊息。"}
            rows={1}
            value={messageText}
          />
          <button className="driver-chat-inline-icon send" disabled={(!messageText.trim() && !imageBase64) || !writable || sending} onClick={handleSend} type="button" aria-label="發送訊息">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M21 3 10 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M21 3 14 21l-4-7-7-4 18-7Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
