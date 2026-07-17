# Ledger chat-events webhook 對接格式

## Endpoint

`POST /api/integration/ledger/chat-events`

正式站示例：

`https://macau-delivery.vercel.app/api/integration/ledger/chat-events`

## Headers

必填：

- `Content-Type: application/json`
- `x-ledger-timestamp: <unix_seconds>`
- `x-ledger-signature: <hex_hmac_sha256>`

兼容舊命名：

- `x-siteb-timestamp`
- `x-siteb-signature`

## Signature

使用共享密鑰 `LEDGER_CHAT_EVENTS_SECRET`：

```text
signature = HMAC_SHA256_HEX(secret, `${timestamp}.${rawBody}`)
```

注意：

- `rawBody` 必須是原始 JSON 字串，不可重新排序鍵位後再簽名
- timestamp 與服務器時間誤差不可超過 5 分鐘
- signature 必須是小寫 hex 字串

## JSON body

```json
{
  "eventId": "evt_20260718_000001",
  "externalOrderId": "ext-10001234",
  "chatRoomRef": "member-order-ext-10001234",
  "roomKind": "member_order",
  "message": {
    "id": "msg_01K0CHATXYZ",
    "createdAt": "2026-07-18T12:34:56.000Z",
    "senderRole": "member",
    "senderLabel": "陳小姐",
    "imageUrl": null
  }
}
```

## 欄位要求

### Top-level

- `eventId`: 必填，事件唯一 ID，用於 inbox 冪等
- `externalOrderId`: 必填，對應 SiteB `orders.external_order_id`
- `chatRoomRef`: 必填，穩定房間 ID
- `roomKind`: 選填，未提供時 SiteB 會用 `member_order`
- `message`: 必填，最新訊息摘要

### message

- `id`: 必填，訊息唯一 ID
- `createdAt`: 必填，ISO 8601 UTC 時間
- `senderRole`: 必填
- `senderLabel`: 選填
- `imageUrl`: 選填；有值時 SiteB 會把 `has_image` 記為 `true`

## senderRole 建議

對 SiteB 而言，以下角色會被視為車手側訊息，**不會亮紅點**：

- `driver`
- `rider`
- `courier`
- 任何包含 `driver` 或 `rider` 的字串

所以從 Ledger 發 webhook 時，會員/客戶訊息請不要用以上角色名。建議：

- 會員訊息：`member`
- 商戶訊息：`merchant`
- 系統訊息：`system`
- 車手訊息：`driver`

## 成功回應

```json
{ "ok": true }
```

HTTP status：`200`

## 常見錯誤

### 401

```json
{ "message": "invalid_signature" }
```

原因：

- 缺少簽名 header
- HMAC 計算不一致
- `LEDGER_CHAT_EVENTS_SECRET` 不匹配

### 400

```json
{ "message": "stale_timestamp" }
```

原因：timestamp 與服務器時間差超過 5 分鐘。

### 400

```json
{ "message": "invalid_payload" }
```

原因：缺少必要欄位，例如：

- `eventId`
- `externalOrderId`
- `chatRoomRef`
- `message.id`
- `message.createdAt`
- `message.senderRole`

## SiteB 端落庫行為

收到 webhook 後，SiteB 會：

1. upsert `ledger_chat_event_inbox`
2. upsert `driver_chat_room_state`
3. 之後由 driver API 直接讀本地 `hasUnread`

注意：

- webhook handler **不會**反向 GET Ledger chat
- driver 列表紅點 **不會**再 polling Ledger
- 只有聊天室真正打開時，才會 GET 單房 chat

## Read state

車手打開聊天室並拉到最新訊息後，SiteB 會更新：

- `driver_chat_read_state(driver_id, chat_room_ref, last_read_at)`

紅點判定規則：

```text
latest_sender_role 不是 driver/rider/courier
且
last_read_at 為空 或 latest_message_at > last_read_at
```

## 上線檢查

Ledger 對接完成後，請確認：

1. 新訊息發出後，`driver_chat_room_state` 有更新
2. 車手列表 API payload 帶有 `hasUnread`
3. 未打開聊天室時，不再出現 `/api/driver/chat/unread-summary`
4. 只有打開聊天室時，才會 call `/api/driver/orders/{orderId}/chat`
