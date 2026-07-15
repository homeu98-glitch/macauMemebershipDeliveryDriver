# 車手在線判定（有效在線）

## 名詞

- **手動上下線**：車手在車手端切換 `online/offline`，對應 `driver_profiles.availability`。
- **有效在線**：用於營運統計、派單與推播的「真正在線」狀態。

## 第一版有效在線規則

有效在線 = `availability = online` 且最近 3 分鐘內有定位心跳。

心跳來源：`driver_locations.captured_at`。

### 為什麼

只靠手動上線會出現：

- 車手關掉 app / 網路斷線 / 鎖屏很久，仍然顯示 online
- 後台看到的在線人數與實際可接單人數不一致

## 對 API 的影響

- 外部（macau-ledger / SiteB）對接 API 不受影響。
- 車手端與後台 API 路徑不變；只是後端在回傳「在線狀態」或在挑選推播對象時，改用有效在線判定。
