# SiteA 整合（摘要）

> 此文件是給 SiteA 的整合摘要（會持續更新）。

## Callback

- callback 以 `eventType` 作為主要事件判斷依據
- 驗證方式：`HMAC-SHA256(secret, timestamp + "." + rawBody)`（hex）

## 重要狀態

- `order.exception_reported` 是事件，不代表訂單終止
- `order.canceled` 為取消終態

## 補償查單

若漏 callback，可用：`GET /api/v1/orders/{externalOrderId}` 補償狀態。
