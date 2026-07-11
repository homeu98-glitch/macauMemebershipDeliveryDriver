# Driver Web App 元件清單

## 目標

元件設計要服務兩件事：

- 手機端操作效率
- 與安卓 App 的視覺與流程一致性

元件要儘量卡片化、觸控友好、責任清楚，避免直接重用後台表格型元件。

## 建議目錄

```text
backoffice/components/driver-web/
  layout/
    driver-shell.tsx
    driver-bottom-nav.tsx
    driver-header.tsx
    driver-guard.tsx

  auth/
    driver-login-form.tsx
    driver-register-form.tsx
    driver-pending-card.tsx

  home/
    driver-dashboard-card.tsx
    availability-toggle-card.tsx
    available-order-list.tsx
    available-order-card.tsx
    district-filter-bar.tsx
    announcement-strip.tsx

  orders/
    active-order-list.tsx
    active-order-card.tsx
    order-detail-card.tsx
    delivery-stage-strip.tsx
    location-card.tsx
    cancel-order-dialog.tsx
    proof-upload-card.tsx

  completed/
    completed-order-list.tsx
    completed-order-card.tsx
    history-range-tabs.tsx

  earnings/
    earnings-summary-card.tsx
    earnings-list.tsx

  leaderboard/
    leaderboard-card.tsx
    leaderboard-list.tsx
    leaderboard-me-card.tsx

  profile/
    profile-summary-card.tsx
    change-pin-dialog.tsx
    legal-entry-card.tsx
    announcement-list.tsx
    apk-download-card.tsx

  legal/
    legal-modal.tsx
    mandatory-legal-dialog.tsx

  notifications/
    notification-permission-card.tsx
    push-test-card.tsx
    install-guide-card.tsx

  shared/
    mobile-page.tsx
    mobile-card.tsx
    status-badge.tsx
    loading-state.tsx
    empty-state.tsx
    error-state.tsx
    pull-to-refresh.tsx
    network-status-banner.tsx
    app-toast.tsx
```

## 核心元件說明

### `driver-shell.tsx`

功能：

- 外層手機容器
- safe-area padding
- 統一背景色
- header 與 bottom nav

### `driver-bottom-nav.tsx`

功能：

- 顯示 `首頁 / 進行中 / 已完成 / 收益 / 我的`
- 高亮目前頁面
- 對齊安卓的 tab 心智模型

### `driver-guard.tsx`

功能：

- 驗證 session
- 根據審核狀態與停用狀態阻擋頁面
- 若未同意條款則彈出 `mandatory-legal-dialog`

### `driver-login-form.tsx`

功能：

- 電話輸入
- PIN 輸入
- 顯示錯誤
- 提供去註冊或待審核頁的入口

### `driver-register-form.tsx`

功能：

- 收集姓名、電話、PIN
- 上傳三份文件
- 顯示提交狀態與錯誤

### `driver-dashboard-card.tsx`

功能：

- 今日收入
- 本週收入
- 今日完成單數
- 頂部摘要區

### `availability-toggle-card.tsx`

功能：

- 顯示目前 `online / offline`
- 一鍵切換上下線
- 顯示狀態說明

### `available-order-card.tsx`

功能：

- 顯示商戶名稱、客戶區域、金額、急單標記、交付時限
- 提供接單按鈕
- 視覺需盡量貼近安卓首頁卡片

### `active-order-card.tsx`

功能：

- 顯示目前處理中的訂單摘要
- 提供進入詳情頁按鈕
- 顯示狀態與重要提示

### `order-detail-card.tsx`

功能：

- 聚合單張訂單詳情
- 商戶資訊、客戶資訊、商品清單、狀態、金額
- 與 `delivery-stage-strip`、`location-card`、`proof-upload-card` 組合

### `delivery-stage-strip.tsx`

功能：

- 用視覺化方式顯示 `已接單 / 已取貨 / 前往客戶 / 已完成`
- 對齊安卓的進度感知

### `location-card.tsx`

功能：

- 顯示地址、聯絡人、導航按鈕
- 不提供客戶電話撥打

### `cancel-order-dialog.tsx`

功能：

- 收集取消原因
- 提交取消與取消確認

### `proof-upload-card.tsx`

功能：

- 調起相機或選擇圖片
- 上傳送達證明
- 顯示上傳成功狀態與預覽

### `completed-order-card.tsx`

功能：

- 顯示已完成訂單摘要
- 顯示完成時間與金額

### `earnings-summary-card.tsx`

功能：

- 顯示今日、本週、歷史收益摘要

### `profile-summary-card.tsx`

功能：

- 顯示姓名、遮罩電話、版本資訊
- 提供個人資訊入口集合

### `change-pin-dialog.tsx`

功能：

- 新 PIN 輸入
- 再次輸入
- 本地驗證
- 提交後端修改

### `legal-entry-card.tsx`

功能：

- 進入免責條款
- 進入服務條款與隱私政策

### `mandatory-legal-dialog.tsx`

功能：

- 在登入後若未同意最新條款時強制顯示
- 未同意前不能關閉
- 成功同意後關閉並刷新 session 狀態

### `apk-download-card.tsx`

功能：

- 固定提供安卓 APK 手動下載入口
- 指向 `https://macau-delivery.vercel.app/apkdownload`

## 共用元件原則

- `status-badge` 要與現有後台色彩規則協調，但樣式更偏手機卡片感
- `loading-state`、`empty-state`、`error-state` 需要能在小螢幕中自然顯示
- `app-toast` 用於替代安卓 snackbar 的訊息提示
- `network-status-banner` 用於提示斷線、重連與同步中狀態
