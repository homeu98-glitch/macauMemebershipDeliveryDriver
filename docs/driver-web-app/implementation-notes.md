# Driver Web App 實作說明

## 技術方向

第一版直接建立在現有 `backoffice` 的 Next.js 架構上，不新開第二個前端專案。這樣可以共用：

- 現有 Supabase 設定
- 現有 mobile API
- 現有公告、條款、騎手與訂單資料模型
- 現有部署流程

## 推薦架構

### 前端層

- Next.js App Router
- 手機優先 UI
- React Query 或 SWR 管理資料抓取
- PWA 能力
- Web Push 註冊

### 伺服器層

- `/api/driver/*` 作為 web 專用接口
- `httpOnly cookie` 作為 web session 載體
- 由 server route 驗證 session，再呼叫既有資料層

### 資料層

- 優先複用現有 `mobile API`
- 需要額外讀取聚合資料時，在 `backoffice/lib/driver-web/` 建立共用服務函式
- 不讓前端直接複製安卓 repository 的所有資料拼接邏輯

## Session 建議

web 版不建議直接照搬安卓的 token 保存方式。推薦方式：

- `POST /api/driver/auth/login` 驗證電話與 PIN
- 服務端拿到 access token 後建立自己的 `httpOnly cookie`
- 所有 `/driver` 頁面與 `/api/driver/*` 透過 cookie 驗證身份
- 若 cookie 過期，引導重新登入

這樣做的好處是：

- 安全性比 localStorage 更高
- 更適合 Next.js server component / route handler
- PWA 與 iPhone 瀏覽器兼容較穩

## 刷新策略

由於業務場景接受車手長時間保持前台，建議採取雙保險：

- Web Push 作為事件通知
- 每 10 至 15 秒輪詢首頁與進行中訂單

首頁與進行中頁面應在下列情況主動刷新：

- 新單到來
- 接單成功
- 狀態更新成功
- 頁面重新聚焦
- 網路恢復

## PWA 策略

web 版應提供以下能力：

- `manifest.webmanifest`
- 安裝圖示
- service worker
- 離線頁面殼層
- 新單提示音
- 安裝教學頁

但第一版不應承諾與安卓原生完全等同的背景保活。產品說明必須清楚告知：

- 工作時請保持頁面開啟
- 建議加到主畫面使用
- 建議允許通知與聲音

## 狀態一致性

web 版必須遵守現有狀態語義：

- `pending_review` 對應待審核
- `rejected` 對應已拒絕
- `approved` 對應可用
- `suspended` 對應停用

若車手被停用：

- 不能進入主工作流
- 顯示「帳號已被停用，請聯絡後台」
- 必須強制視為離線

## 需要與安卓保持一致的交互

以下交互屬於核心一致性要求：

- 登入後條款強制彈出
- 首頁可接訂單卡片資訊結構
- 上下線操作位置與語義
- 訂單詳情頁操作順序
- proof upload 後才能完成訂單
- 免責條款、服務條款與隱私政策入口位置
- 我的頁面中的安卓 APK 下載入口

## 風險與對策

### 風險一：iPhone 背景限制

現象：切到背景後輪詢停止，推播不一定穩定。

對策：

- 引導車手前台長開
- 保留聲音提醒
- 頁面重新聚焦後立刻刷新

### 風險二：Proof 上傳失敗

現象：網路波動或相機授權造成圖片上傳失敗。

對策：

- `proof-upload-card` 提供重試
- 上傳成功後本地顯示明確狀態
- 完成訂單按鈕在未成功上傳前保持不可用

### 風險三：狀態競爭

現象：訂單已被其他車手接走，或狀態已改變。

對策：

- 所有狀態 API 必須返回明確 `409` 錯誤
- 前端收到衝突後立即刷新列表

## 文件與程式碼對應

建議新增以下程式區塊：

```text
backoffice/app/driver/
backoffice/app/api/driver/
backoffice/components/driver-web/
backoffice/lib/driver-web/
backoffice/public/manifest.webmanifest
backoffice/public/icons/
backoffice/public/sounds/
docs/driver-web-app/
```

## 驗收重點

第一版完成後至少應驗證：

- 車手可登入並正確判斷審核狀態
- 未同意條款時一定會被阻擋並可成功同意
- 首頁能看到可接訂單並完成接單
- 進行中訂單可進入詳情、已取貨、上傳 proof、完成訂單
- 已完成與收益頁能載入正確資料
- 我的頁面能修改 PIN、查看條款、下載安卓 APK
- 被停用車手會被明確阻擋
- iPhone 與鴻蒙手機可正常從瀏覽器打開並使用主要流程
