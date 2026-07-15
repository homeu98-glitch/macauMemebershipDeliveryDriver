# Driver Web App API 清單

## API 設計原則

web 版優先複用現有 `mobile API`，但不直接把所有前端邏輯建立在安卓 App 的 repository 行為上。對於 web 版特有的 session、頁面讀取需求、輪詢、PWA 與通知能力，建議新增 `/api/driver/*` 專用接口。

## 可直接複用的 API

### 帳號與條款

- `POST /api/mobile/drivers/register`
- `POST /api/mobile/drivers/change-pin`
- `GET /api/mobile/legal`
- `POST /api/mobile/legal/accept`

### 公告與排行榜

- `GET /api/mobile/announcements`
- `GET /api/mobile/leaderboard/weekly`

### 訂單動作

- `POST /api/mobile/orders/[orderId]/status`
- `GET /api/mobile/orders/[orderId]/proof`
- `POST /api/mobile/orders/[orderId]/proof`

### 目前 `status` API 支援的事件

- `accepted`
- `picked_up`
- `delivered`
- `exception_reported`
- `canceled`
- `cancel_confirmed`

## 建議新增的 Web 專用 API

### 認證與 session

#### `POST /api/driver/auth/login`

功能：

- 用電話與 PIN 進行登入
- 驗證 driver profile 狀態
- 寫入 `httpOnly cookie`
- 回傳簡要 session 與跳轉依據

建議請求：

```json
{
  "phone": "6xxxxxxx",
  "pin": "1234"
}
```

建議回應：

```json
{
  "success": true,
  "driver": {
    "id": "driver-profile-id",
    "name": "車手名稱",
    "approvalStatus": "approved",
    "availability": "offline"
  }
}
```

#### `POST /api/driver/auth/logout`

功能：清除 web session cookie。

#### `GET /api/driver/auth/session`

功能：

- 回傳目前登入狀態
- 回傳車手基本資料
- 回傳審核狀態
- 回傳是否需強制同意條款

### 車手資料

#### `GET /api/driver/me`

功能：

- 提供 profile 頁面資料
- 提供遮罩電話前的原始資料給 server 層處理
- 回傳 `approval_status`、`availability`、`accepted_terms_version`

### Dashboard 與首頁

#### `GET /api/driver/dashboard`

功能：

- 今日收入
- 本週收入
- 今日完成單數
- 可接訂單摘要
- 公告摘要
- district filter 選項

建議回應欄位：

- `todayEarningsMop`
- `weekEarningsMop`
- `completedToday`
- `availableOrders`
- `pickupDistrictOptions`
- `destinationDistrictOptions`
- `announcements`

### 訂單讀取 API

#### `GET /api/driver/orders/available`

query：

- `pickupDistrict`
- `destinationDistrict`

功能：提供首頁可接訂單列表。

#### `GET /api/driver/orders/active`

功能：提供進行中訂單列表。

#### `GET /api/driver/orders/completed`

query：

- `range=today|week|history`
- `page`
- `pageSize`

功能：提供已完成訂單列表。

#### `GET /api/driver/orders/[id]`

功能：提供單張訂單詳情，包含：

- 商戶
- 客戶
- 商品
- 金額
- 狀態
- timeline
- proof 狀態
- cancel 狀態

### 收益 API

#### `GET /api/driver/earnings`

query：

- `range=today|week|history`
- `page`
- `pageSize`

功能：收益摘要與列表。

### 審核狀態

#### `GET /api/driver/review-status`

功能：

- 供 `/driver/pending` 頁面使用
- 返回 `pending / rejected / approved`
- 返回 `review_note`
- 返回 `reviewed_at`



## 有效在線（effective online）

在營運場景中，「手動上線」不等於「真的正在前景可接單」。建議在後台統計、派單與推播時使用「有效在線」判定：

- `manualAvailability = online`（車手手動開啟）
- 且 `driver_locations` 最近一次 `captured_at` 在 3 分鐘內

這個改動不需要改動對外 API 介面，只是 server 端生成資料時換一個判定方式。
### 在線狀態

#### `POST /api/driver/availability`

請求：

```json
{
  "availability": "online"
}
```

功能：切換「手動上下線」狀態（`driver_profiles.availability`）。

注意：後台與派單建議使用「有效在線」邏輯，而不是單純依賴 `availability=online`。有效在線第一版以 `driver_locations.captured_at` 當作心跳來源：

- 車手手動 `online`
- 且最近 3 分鐘內有上報定位（可由前景定時上報、回到前景、接單動作觸發）

才視為有效在線。

### Web Push

#### `POST /api/driver/push/web/register`

功能：儲存 web push subscription。

建議請求：

```json
{
  "endpoint": "...",
  "keys": {
    "p256dh": "...",
    "auth": "..."
  },
  "deviceLabel": "iPhone Safari"
}
```

#### `POST /api/driver/push/web/test`

功能：對當前裝置發送測試通知。

## 錯誤語義要求

web 版所有 driver API 都應統一以下語義：

- `401`：未登入或 session 失效
- `403`：身份不符、帳號被停用、條款狀態不允許
- `404`：資料不存在
- `409`：訂單狀態衝突或已不可操作
- `422`：缺少必要資料，例如 proof 未上傳
- `500`：伺服器內部錯誤

錯誤訊息需可直接給車手顯示，不要只返回內部技術描述。
