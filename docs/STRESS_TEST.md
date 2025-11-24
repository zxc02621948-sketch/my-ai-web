# 網站壓力測試工具

這個工具用於測試網站的主要 API 端點的負載能力和響應時間。

## 使用方式

### 基本使用

```bash
# 使用預設配置測試本地伺服器
node scripts/stress-test.js

# 測試指定的 URL
node scripts/stress-test.js --url http://localhost:3000

# 指定並發數和總請求數
node scripts/stress-test.js --url http://localhost:3000 --concurrent 10 --requests 200

# 詳細輸出模式
node scripts/stress-test.js --verbose

# 僅測試公開端點（排除需要認證的端點，推薦用於測試公開 API）
node scripts/stress-test.js --public-only
```

### 命令行參數

- `--url` / `-u`: 目標伺服器 URL (預設: `http://localhost:3000`)
- `--concurrent` / `-c`: 並發請求數 (預設: `5`)
- `--requests` / `-r`: 總請求數 (預設: `100`)
- `--timeout` / `-t`: 請求超時時間，毫秒 (預設: `30000`)
- `--verbose` / `-v`: 詳細輸出模式，顯示每個請求的結果
- `--public-only`: 僅測試公開端點（排除需要認證的端點，適合測試公開 API）

### 環境變數

你也可以使用環境變數來設定配置：

```bash
export TEST_URL=http://localhost:3000
export CONCURRENT=10
export REQUESTS=200
node scripts/stress-test.js
```

## 測試的端點

腳本會測試以下主要 API 端點：

### 圖片相關
- `/api/images?page=1&limit=20&sort=popular` - 圖片列表（熱門）
- `/api/images?page=1&limit=20&sort=newest` - 圖片列表（最新）
- `/api/images?page=1&limit=20&sort=random` - 圖片列表（隨機）

### 影片相關
- `/api/videos?page=1&limit=20&sort=popular` - 影片列表（熱門）
- `/api/videos?page=1&limit=20&sort=newest` - 影片列表（最新）

### 音樂相關
- `/api/music?page=1&limit=20&sort=popular` - 音樂列表（熱門）
- `/api/music?page=1&limit=20&sort=newest` - 音樂列表（最新）

### 用戶相關（需要認證）
- `/api/current-user` - 當前用戶 ⚠️ 需要登入（401 視為正常）
- `/api/user-info` - 用戶資訊 ⚠️ 需要登入（401 視為正常）

### 其他
- `/api/health-check` - 健康檢查
- `/api/points/level` - 積分等級
- `/api/trending-searches` - 熱門搜尋

## 報告內容

測試完成後，腳本會顯示以下統計信息：

### 總體統計
- 總請求數
- 成功請求數和成功率
- 失敗請求數
- 測試持續時間
- 請求速率 (RPS)

### 響應時間
- 最小響應時間
- 最大響應時間
- 平均響應時間
- 百分位數 (P50, P75, P90, P95, P99)

### HTTP 狀態碼分佈
- 各種狀態碼的數量和百分比

### 錯誤詳情
- 前 10 個錯誤的詳細信息

### 健康評估
- 自動評估伺服器的健康狀況
- 成功率評估
- 響應時間評估
- 吞吐量評估

## 使用建議

### 本地測試

```bash
# 1. 啟動開發伺服器
npm run dev

# 2. 在另一個終端執行壓力測試
node scripts/stress-test.js --url http://localhost:3000 --concurrent 5 --requests 50
```

### 生產環境測試

⚠️ **警告**: 在生產環境執行壓力測試前，請確保：
1. 已通知團隊成員
2. 已選擇低峰時段
3. 已設定合理的並發數和請求數
4. 已監控伺服器資源使用情況

```bash
# 輕量測試（建議先用這個）
node scripts/stress-test.js --url https://your-domain.com --concurrent 5 --requests 100

# 中等負載測試
node scripts/stress-test.js --url https://your-domain.com --concurrent 10 --requests 500

# 高負載測試（謹慎使用）
node scripts/stress-test.js --url https://your-domain.com --concurrent 20 --requests 1000
```

## 性能基準建議

### 優秀
- 成功率 ≥ 99%
- 平均響應時間 < 500ms
- 吞吐量 ≥ 50 請求/秒

### 可接受
- 成功率 ≥ 95%
- 平均響應時間 < 1000ms
- 吞吐量 ≥ 20 請求/秒

### 需要改進
- 成功率 < 95%
- 平均響應時間 > 1000ms
- 吞吐量 < 20 請求/秒

## 關於 401 錯誤

部分端點（如 `/api/current-user`）需要登入認證。腳本已經優化：
- **預設模式**：測試所有端點，對於需要認證的端點，401/403 視為**正常響應**（不計入失敗）
- **公開模式**（`--public-only`）：只測試公開端點，完全排除需要認證的端點

### 測試公開 API（推薦）
```bash
# 只測試公開端點，避免 401 錯誤
node scripts/stress-test.js --public-only
```

這樣可以獲得更準確的成功率評估，因為 401 錯誤不代表伺服器有問題。

## 注意事項

1. **資料庫連線**: 確保資料庫連線池設定足夠處理並發請求
2. **快取**: 某些端點可能有快取機制，可能會影響測試結果
3. **認證**: 部分端點需要認證，使用 `--public-only` 可排除這些端點
4. **限流**: 如果伺服器有速率限制，可能會影響測試結果
5. **資源監控**: 測試時建議同時監控 CPU、記憶體、資料庫等資源使用情況

## 自定義測試

你可以修改 `scripts/stress-test.js` 中的 `ENDPOINTS` 陣列來自定義要測試的端點。

```javascript
const ENDPOINTS = [
  { path: '/api/your-endpoint', name: '你的端點', method: 'GET' },
  // 添加更多端點...
];
```

## 故障排除

### 連接錯誤
- 檢查 URL 是否正確
- 確認伺服器正在運行
- 檢查防火牆設定

### 超時錯誤
- 增加 `--timeout` 參數值
- 檢查伺服器響應速度
- 查看伺服器日誌

### 高錯誤率
- 檢查伺服器日誌
- 確認資料庫連線正常
- 檢查資源使用情況（CPU、記憶體）
- 降低並發數重新測試

