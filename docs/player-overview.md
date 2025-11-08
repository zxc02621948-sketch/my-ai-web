# Player System Overview

## 主要元件
- **PlayerContext**：提供播放狀態（來源、播放狀態、播放清單、權限等）的單一資料來源，並曝光 `play() / pause() / next()` 等動作。
- **usePinnedPlayerBootstrap**：根據目前使用者與釘選資訊初始化 `PlayerContext`，處理跨頁持續播放、權限同步以及快取還原。
- **MiniPlayer**：視覺化控制介面，負責顯示狀態、提供互動（釘選、切歌、隨機播放、音量等），並與 Context / Bootstrap 溝通。
- **Player 頁面 / 個人頁**：變更設定（例如允許訪客隨機播放）時，更新 PlayerContext 與後端，其他頁面透過 Bootstrap 及快取同步狀態。

## 快取流程
1. **寫入**：`usePinnedPlayerBootstrap` 每次套用釘選狀態時，透過 `writePinnedPlayerCache`（sessionStorage）記錄 `userId / playlist / allowShuffle / signature`。
2. **讀取**：`MiniPlayer` 與 Bootstrap 啟動時會優先從快取還原，確保重新整理或跨頁也能立即顯示釘選狀態。
3. **清除**：釘選解除或快取資料失效時，統一呼叫 `clearPinnedPlayerCache` 移除。

## Shuffle 權限同步
- 伺服器（或 Player 頁面）更新 `allowShuffle` 後，`PlayerContext.setPlayerOwner` 與 `usePinnedPlayerBootstrap` 會同步 `shuffleAllowed`。
- `MiniPlayer` 監聽全域 owner 狀態，必要時更新本地 `pinnedPlayerData` 與快取，確保 UI 立即反映（按鈕顯示 / 隱藏）。
- `applyPinnedShufflePreference` 負責套用使用者個人偏好（localStorage）或在權限失效時停用 shuffle。

## 健康檢查 / 技術債
- `PlayerContext` 的 `contextValue` 已封裝為 `useMemo`，避免 `usePlayer()` 取得的引用每次重建導致子元件 (特別是 bootstrap) 不斷重跑。
- `usePinnedPlayerBootstrap` 會檢查簽章（signature），若資料未變更則直接跳出，避免重覆套用造成循環。
- 釘選快取邏輯集中在 `utils/pinnedPlayerCache.js`，減少手動 `sessionStorage` 操作的重複程式碼。
- MiniPlayer 的 shuffle 權限同步現由單一 effect 控制，並在 owner 更新時同步快取，避免按鈕殘留。

## 進一步優化方向
- 若未來功能再擴充，可考慮導入更明確的狀態機流程（例如 XState）或以 store（如 Zustand）集中管理狀態。
- 將 `MiniPlayer` 中較大的邏輯（拖動、音量、播放控制）拆分成自訂 hooks，利於獨立測試。
- 增加 E2E 測試（如 Playwright）驗證跨頁播放、釘選、shuffle 權限變更等關鍵情境。


