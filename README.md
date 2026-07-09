# macauMemebershipDeliveryDriver

澳門會員配送系統（Backoffice + 車手 Android App）。

## 專案結構

- `backoffice/`: 管理後台（Next.js）
- `app/`: 車手 Android App（Kotlin / Jetpack Compose）
- `supabase/`: Supabase SQL schema / policies
- `lib/`: 共享後端工具（供 backoffice 使用）

## 主要連結

- 車手 APK 公開下載頁（固定）：`/apkdownload`
- 車手 APK 直接下載（固定）：`/apkdownload/latest`
- 後台 APK 版本管理：`/apk`
- 後台 公告發布：`/announcements`
- 後台 地區同步：`/districts`

## OTA 更新（非 Play Store）

Android 無法完全靜默自動更新 APK。本專案的 OTA 流程是：

1. App 啟動後呼叫公開 API 取得最新版本資訊
2. 若 `latest.version` 高於 `BuildConfig.VERSION_NAME`，顯示更新提示
3. 使用者點擊後跳轉到固定下載頁 `/apkdownload` 再手動安裝

詳見：`docs/flows/ota_update_flow.md`

## 技術文檔

- 技術文檔索引：`docs/README.md`
- SiteA 整合：`docs/integration/sitea.md`
- SiteB Callback/Status：`docs/integration/siteb.md`
- 車手功能摘要：`docs/features/driver_app_features.md`

## 開發

### Backoffice

```bash
cd backoffice
npm install
npm run dev
```

### Android App

```bash
./gradlew :app:assembleDebug
```

## 部署

- Backoffice：Vercel
- DB/Storage：Supabase
