# SiteB Callback 流程

```mermaid
sequenceDiagram
  participant SiteA
  participant Backoffice
  participant SiteB

  SiteA->>SiteB: Create Order (externalOrderId, callback.url, callback.secret)
  SiteB-->>SiteA: HTTP response (created/created=false)

  SiteB-->>Backoffice: Callback: order.accepted / picked_up / delivered / canceled / exception_reported
  Backoffice-->>SiteB: 200 OK

  Note over Backoffice: Backoffice 會記錄 callback_logs
並更新訂單狀態與事件

  SiteA->>Backoffice: GET /api/v1/orders/{externalOrderId} (補償查單)
  Backoffice-->>SiteA: status + driver + assignment + latestProof
```
