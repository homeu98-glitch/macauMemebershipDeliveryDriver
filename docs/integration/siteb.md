# SiteB 整合（v3 摘要）

這版整合重點有三個：

1. `POST /api/v1/orders` 現在支援 `images[]`
2. `customer` 欄位可以不完整，甚至沒有文字地址；只要有 `images[].url` 讓車手可從圖片讀資料即可
3. 所有 callback event 都統一帶：
   - `driver.fullName`
   - `driver.phone`
   - `acceptanceLocation.latitude`
   - `acceptanceLocation.longitude`
   - `acceptanceLocation.capturedAt`

## 建單重點

- `shop.name` / `shop.address` / `shop.latitude` / `shop.longitude` / `callback.url` 仍然是必要欄位
- `customer.address` 不再是必填
- 如果沒有 `customer.address`，則 `images[].url` 至少要有一張
- `images[]` 第一版採用公開可下載 URL

## 查單重點

`GET /api/v1/orders/{externalOrderId}` 現在會多回傳：

- `images[]`
- `customer.isAnonymous`
- `customer.addressProvided`
- `customer.contactProvided`
- `acceptanceLocation`

## Callback 重點

所有 callback 現在都統一帶：

- `driver`
- `acceptanceLocation`

事件仍然沿用：

- `order.accepted`
- `order.picked_up`
- `order.arrived_customer`
- `order.delivered`
- `order.canceled`
- `order.exception_reported`
- `order.shop_owner_confirmed_driver_cancel`

## 文檔

請以 repo 根目錄的 `sitea-siteb-api-spec-v3.html` 為最新對接文檔。
