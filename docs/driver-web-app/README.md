# Driver Web App 文檔總覽

## 目的

本文檔集定義 `driver web app` 的完整第一版方案，目標是在現有 `backoffice` 專案中新增一個可供 iPhone、鴻蒙與其他手機瀏覽器使用的車手工作入口，並盡量保持與現有安卓 App 一致的資訊架構、視覺風格與操作流程。

這個版本不是簡化版入口，也不是僅供展示的備用頁，而是可直接投入日常配送工作的車手 Web App。系統預設車手在工作時會長時間保持頁面開啟，並允許通知與聲音提示。

## 產品定位

- 直接放入現有 `backoffice` 專案中
- 採用手機優先設計
- 底部導航、首頁資訊結構、訂單卡片、我的頁面盡量對齊安卓 App
- 優先複用現有 `mobile API`
- 補齊 web 版需要的 session、讀取型 API、PWA 與 Web Push 能力

## 第一版範圍

完整第一版包含以下能力：

- 車手登入、登出
- 車手註冊與三張證件上傳
- 等待審核、拒絕原因顯示、重新提交
- 強制服務條款與隱私政策同意
- 首頁可接訂單
- 上下線切換
- 進行中訂單
- 訂單詳情
- 已取貨
- 拍照完成訂單
- 取消與取消確認
- 已完成訂單紀錄
- 收益頁
- 公告
- 排行榜
- 我的頁面
- 修改 PIN
- 免責條款入口
- 安卓 APK 手動下載入口
- Web Push 註冊
- PWA 安裝能力

## 與現有系統的一致性要求

第一版必須遵守現有專案規則，尤其是：

- 客戶電話不可在 UI 中提供撥打入口
- 電話顯示需遮罩前四位
- 登入後若未同意服務條款與隱私政策，不可進入主工作流
- 安卓手動下載入口固定為 `https://macau-delivery.vercel.app/apkdownload`
- 被停用的車手必須被阻擋登入，並顯示「帳號已被停用，請聯絡後台」
- 證件圖片於審核完成後需 hard delete

## 專案內建議位置

```text
backoffice/app/driver/
backoffice/components/driver-web/
backoffice/lib/driver-web/
backoffice/app/api/driver/
docs/driver-web-app/
```

## 文檔清單

- `docs/driver-web-app/routes-and-pages.md`
  說明 `/driver` 路由結構、頁面責任、導航邏輯與使用流程

- `docs/driver-web-app/api-spec.md`
  說明可直接複用的 API、需要新增的 API、請求與回應結構、狀態語義

- `docs/driver-web-app/components.md`
  說明元件樹、元件用途、元件之間的依賴關係與 UI 責任

- `docs/driver-web-app/implementation-notes.md`
  說明技術架構、session 方案、PWA 與通知策略、資料刷新策略、開發注意事項

## 開發原則

- 能複用現有 `mobile API` 的地方，不重做第二套業務規則
- web 版前端不直接拼接複雜的 Supabase 查詢
- 新增一層 `/api/driver/*` 專用接口，集中處理 web session 與讀取型資料
- 視覺與交互以「安卓車手能立刻上手」為標準
- 優先保證接單、取貨、完成、proof upload、公告、條款同意等核心流程完整
