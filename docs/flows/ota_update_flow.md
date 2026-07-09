# OTA 更新流程

```mermaid
flowchart TD
  A[App 啟動] --> B[呼叫 /api/public/driver-app/latest]
  B --> C{有 Active 版本?}
  C -- 否 --> D[不提示更新]
  C -- 是 --> E{latest.version > BuildConfig.VERSION_NAME?}
  E -- 否 --> D
  E -- 是 --> F[顯示更新 Dialog
顯示版本號與更新說明]
  F -->|立即更新| G[開啟 /apkdownload]
  G --> H[使用者按「下載 APK」]
  H --> I[/apkdownload/latest 302 到 Active APK URL]
  I --> J[Android 安裝器提示安裝]
```

備註：Android 不能完全靜默安裝，必須由使用者確認安裝。
