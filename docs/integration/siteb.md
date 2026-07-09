# SiteB 整合（摘要）

## Callback 事件

- `order.accepted`
- `order.picked_up`
- `order.arrived_customer`
- `order.delivered`
- `order.canceled`
- `order.exception_reported`
- `order.shop_owner_confirmed_driver_cancel`

## 取消

- `order.canceled` 的 `status` 固定為 `canceled`
- 取消來源目前以 payload 內 `cancel.reason` / `cancel.note` 為主
