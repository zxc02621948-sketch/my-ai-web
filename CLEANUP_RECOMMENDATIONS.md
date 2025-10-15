# 🧹 專案清理建議

## 📋 目錄
1. [冗餘 API 端點](#冗餘-api-端點)
2. [空目錄](#空目錄)
3. [調試/測試文件](#調試測試文件)
4. [備份文件](#備份文件)
5. [文檔文件](#文檔文件)

---

## ❌ 冗餘 API 端點

### 1. `/api/get-following-users` ❌ **建議刪除**
- **路徑**: `app/api/get-following-users/route.js`
- **原因**: 已被 `/api/follow` (GET) 取代
- **使用情況**: 未被任何地方引用
- **風險**: 低 ✅

---

## 📁 空目錄

### 1. `app/user/following/` ❌ **建議刪除**
- **狀態**: 空目錄
- **原因**: 原本的 `page.jsx` 已被刪除（功能改為 modal）
- **風險**: 無 ✅

### 2. `app/api/debug-my-user/` ⚠️ **檢查後決定**
- **狀態**: 空目錄
- **原因**: 可能是遺留的調試端點

### 3. `app/api/dev/clear-pinned/` ⚠️ **檢查後決定**
- **狀態**: 空目錄
- **原因**: 可能是測試用端點

### 4. `app/api/fix-my-points/` ⚠️ **檢查後決定**
- **狀態**: 空目錄
- **原因**: 可能是臨時修復端點

### 5. `app/api/player/log/` ⚠️ **檢查後決定**
- **狀態**: 可能為空
- **原因**: 播放器日誌功能（已不使用）

### 6. `app/api/player/save-progress/` ⚠️ **檢查後決定**
- **狀態**: 可能為空
- **原因**: 播放器進度保存功能（已不使用）

### 7. `app/api/subscriptions/toggle-auto-renew/` ⚠️ **檢查後決定**
- **狀態**: 可能為空
- **原因**: 自動續訂功能（已移除）

---

## 🧪 調試/測試文件

### 根目錄調試文件 ⚠️ **建議移至 `/scripts` 或刪除**

1. `check-syntax.js` - 語法檢查腳本
2. `debug-hidden-player.js` - 播放器調試
3. `debug-player.js` - 播放器調試
4. `fix-critical-issues.js` - 臨時修復腳本
5. `fix-player-issues.js` - 播放器修復腳本
6. `simple-fix.js` - 簡單修復腳本
7. `test-comprehensive-debug.js` - 綜合調試
8. `test-dual-track.js` - 雙軌測試
9. `test-pause-video-fix.js` - 暫停視頻測試
10. `test-player-automation.js` - 播放器自動化測試
11. `test-player.html` - HTML 測試文件
12. `test-total-earned.js` - 積分測試

### JSON 調試文件 ⚠️ **建議刪除**

1. `comprehensive-debug-report.json`
2. `player-debug-report.json`
3. `player-deep-analysis.json`
4. `player-fix-test-results.json`

### 其他奇怪的文件 ❌ **建議刪除**

1. `tall` - 未知用途
2. `tatus --short` - 可能是誤創建的文件（git status 打錯？）

---

## 📄 備份文件

### App 目錄備份 ⚠️ **建議移至 `/backups` 或刪除**

1. `app/HomePage.txt` - 首頁備份
2. `app/拆分簡化後的首頁備份.txt` - 首頁備份（簡體中文）

---

## 📚 文檔文件（可保留，但建議整理）

### 總結報告（建議保留）
- `ADMIN_POINTS_GUIDE.md` ✅
- `API_OPTIMIZATION_SUMMARY.md` ✅
- `BUG_CHECK_SUMMARY.md` ✅
- `BUGS_FOUND_AND_FIXED.md` ✅
- `CATEGORY_MIGRATION_PLAN.md` ✅
- `PLAYER_MONITORING_GUIDE.md` ✅
- `POTENTIAL_BUGS_REPORT.md` ✅
- `PROJECT_STATUS.md` ✅
- `REDUNDANCY_AUDIT_REPORT.md` ✅
- `SUBSCRIPTION_SYSTEM_GUIDE.md` ✅
- `TEST_POINTS_FIX.md` ✅
- `TEST_SUBSCRIPTION_GUIDE.md` ✅
- `TESTING_REPORT.md` ✅

### 舊修復報告（建議歸檔或刪除）
- `FINAL_PAUSE_VIDEO_FIX_SUMMARY.md` ⚠️
- `FINAL_PLAYER_CLEANUP_FIX.md` ⚠️
- `FINAL_PLAYER_FIX_SUMMARY.md` ⚠️
- `FINAL_SIMPLE_FIX_SUMMARY.md` ⚠️
- `FINAL_STOPVIDEO_FIX.md` ⚠️
- `FINAL_USE_CLIENT_FIX.md` ⚠️
- `test-summary.md` ⚠️

### 純文本文檔 ⚠️ **建議轉換為 .md 或刪除**
- `cloudflare.com的API.txt`
- `CONTRACTS.md（接口小抄｜1頁）.txt` - 應該重命名為 `.md`
- `SMOKE.md（1分鐘冒煙測試｜1頁）.txt` - 應該重命名為 `.md`
- `啟動.txt`

---

## 🎯 清理優先級

### 高優先級（立即清理）✅

1. **刪除冗餘 API**:
   - `app/api/get-following-users/`
   
2. **刪除空目錄**:
   - `app/user/following/`
   
3. **刪除奇怪文件**:
   - `tall`
   - `tatus --short`

### 中優先級（確認後清理）⚠️

1. **檢查並刪除空的 API 目錄**:
   - `app/api/debug-my-user/`
   - `app/api/dev/clear-pinned/`
   - `app/api/fix-my-points/`
   - `app/api/player/log/`
   - `app/api/player/save-progress/`
   - `app/api/subscriptions/toggle-auto-renew/`

2. **移動或刪除調試文件**:
   - 根目錄的所有 `.js` 調試文件
   - 根目錄的所有 `.json` 調試文件
   - `test-player.html`

### 低優先級（可選）📝

1. **整理文檔**:
   - 將舊的 `FINAL_*.md` 歸檔到 `/docs/archive/`
   - 將 `.txt` 文檔轉換為 `.md`
   - 將備份文件移至 `/backups/`

---

## ⚡ 自動清理腳本

```bash
# 刪除高優先級項目
rm -rf app/api/get-following-users
rm -rf app/user/following
rm tall "tatus --short"

# 刪除 JSON 調試文件
rm comprehensive-debug-report.json
rm player-debug-report.json
rm player-deep-analysis.json
rm player-fix-test-results.json

# 移動調試文件到 scripts/debug/
mkdir -p scripts/debug
mv debug-*.js scripts/debug/
mv fix-*.js scripts/debug/
mv test-*.js scripts/debug/
mv test-player.html scripts/debug/
mv simple-fix.js scripts/debug/
mv check-syntax.js scripts/debug/
```

---

## 📊 清理影響評估

| 類別 | 文件數量 | 風險等級 | 建議動作 |
|------|---------|---------|---------|
| 冗餘 API | 1 | 低 | 立即刪除 |
| 空目錄 | 7 | 低 | 檢查後刪除 |
| 調試文件 | 16+ | 低 | 移動/刪除 |
| 備份文件 | 2 | 低 | 歸檔 |
| 文檔整理 | 20+ | 無 | 可選 |

**總計**: 預計可清理 **30-40** 個冗餘/過時文件

---

*最後更新: 2025-10-15*

