# Driver Web App 路由與頁面

## 路由目標

`/driver` 區域是車手專用入口，與現有後台管理頁分離。它面向手機使用情境設計，主畫面結構、頁面命名與導航關係盡量貼近現有安卓 App，讓車手不用重新學習系統。

## 建議檔案樹

```text
backoffice/app/driver/
  layout.tsx
  page.tsx
  login/
    page.tsx
  register/
    page.tsx
  pending/
    page.tsx
  home/
    page.tsx
  orders/
    page.tsx
  orders/
    [id]/
      page.tsx
  completed/
    page.tsx
  earnings/
    page.tsx
  leaderboard/
    page.tsx
  profile/
    page.tsx
  notifications/
    page.tsx
  install/
    page.tsx
```

## 路由清單

| 路由 | 用途 | 是否登入後可用 |
|---|---|---|
| `/driver` | 根入口，依 session 導向適當頁面 | 視狀態而定 |
| `/driver/login` | 車手登入 | 否 |
| `/driver/register` | 車手註冊與文件上傳 | 否 |
| `/driver/pending` | 待審核、被拒、重提頁 | 否 |
| `/driver/home` | 首頁，可接單、上下線、公告摘要 | 是 |
| `/driver/orders` | 進行中訂單列表 | 是 |
| `/driver/orders/[id]` | 單張訂單詳情與操作 | 是 |
| `/driver/completed` | 已完成訂單列表 | 是 |
| `/driver/earnings` | 收益頁 | 是 |
| `/driver/leaderboard` | 排行榜 | 是 |
| `/driver/profile` | 我的頁面、PIN、條款、公告、版本入口 | 是 |
| `/driver/notifications` | 通知開啟與測試 | 是 |
| `/driver/install` | 加到主畫面教學 | 否 |

## 導航規則

根路由 `/driver` 需要根據 server session 決定導向：

- 未登入：轉到 `/driver/login`
- 已登入但未同意條款：仍可進入受保護頁，但立即彈出強制同意視窗
- 已登入且審核中：轉到 `/driver/pending`
- 已登入且被拒：轉到 `/driver/pending`
- 已登入且被停用：阻擋進入主工作流，顯示停用訊息
- 已登入且已通過：轉到 `/driver/home`

## 底部導航

底部導航與安卓保持一致，建議固定為五個主頁：

- `首頁`
- `進行中`
- `已完成`
- `收益`
- `我的`

`排行榜` 可先放在 `我的` 頁面內，也可獨立作為二級頁面。

## 頁面責任

### `/driver/login`

- 電話 + PIN 登入
- 顯示錯誤訊息
- 提供 `註冊` 入口
- 提供 `審核狀態` 入口
- 若後端回傳停用訊息，需清楚顯示

### `/driver/register`

- 收集姓名、電話、PIN
- 上傳三張文件：自拍照、澳門身份證、駕駛執照
- 送出後跳轉 `/driver/pending`

### `/driver/pending`

- 顯示 `待審核` / `已拒絕` / `已通過` 狀態
- 若已拒絕，顯示審核原因與時間
- 若已拒絕，允許重新跳回註冊頁提交資料
- 若已通過，提示返回登入

### `/driver/home`

- 顯示當前上下線狀態
- 顯示今日完成量與收入摘要
- 顯示可接訂單列表
- 顯示取貨區、送達區篩選
- 顯示公告摘要
- 提供手動刷新與自動刷新

### `/driver/orders`

- 顯示進行中訂單列表
- 支援查看當前狀態
- 進入單張詳情頁

### `/driver/orders/[id]`

- 商戶資訊
- 客戶資訊
- 地址與導航入口
- 商品清單
- 狀態流程顯示
- 已取貨
- 拍照完成訂單
- 取消訂單
- 取消確認
- proof 預覽

### `/driver/completed`

- 顯示今天 / 本週 / 歷史已完成訂單
- 支援分頁

### `/driver/earnings`

- 顯示今天 / 本週 / 歷史收益
- 顯示每筆收入紀錄

### `/driver/leaderboard`

- 顯示本週排行榜
- 顯示自己的排名資料

### `/driver/profile`

- 顯示姓名、遮罩電話、版本資訊
- 進入免責條款
- 進入服務條款與隱私政策
- 修改 PIN
- 查看公告
- 手動下載安卓 APK
- 登出

### `/driver/notifications`

- 通知權限檢查
- Web Push 註冊
- 測試通知

### `/driver/install`

- iPhone 加到主畫面教學
- Android / 鴻蒙瀏覽器使用指引

## 版面規範

- 使用手機容器寬度
- 主背景、卡片樣式與安卓 App 保持接近
- 大按鈕、大觸控區
- 重要操作固定在頁面底部或明顯位置
- 訂單卡片資訊密度需與安卓接近，避免做成桌面表格
