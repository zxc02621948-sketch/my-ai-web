# Maintenance Playbook (my-ai-web)

最後更新：2026-02-13  
用途：提供後續維修/修漏洞/改功能時的「單一參考文件」，避免越改越亂。

## Recent Security Fixes (2026-02-13)

- `feedback`：`pageUrl` 改為後端白名單驗證（僅 http/https 或站內相對路徑），管理後台連結也加防呆。
- `music modelLink`：上傳/編輯 API 皆改為只接受 http/https；前端顯示時非安全 URL 不再做可點擊連結。
- `current-user API`：改為統一透過 `serverAuth.getCurrentUserFromRequest(req)` 取身份，避免自製解析分叉。
- `mod/messages API`：`UNAUTH/FORBIDDEN` 回傳碼修正為 `401/403`，避免被誤判為一般 400 錯誤。
- `frame API`：`set-frame`/`save-color-settings` 改為 request-based auth（`getCurrentUserFromRequest`）。

## 1) 先看這份再改

每次維修請遵守這個順序：

1. 先確認要動的是哪個功能區（上傳、按讚、討論區、後台、播放器）。
2. 查本文件對應的資料流和 source of truth（真實數據來源）。
3. 只在同一區塊做修改，避免一次跨多個系統。
4. 改完跑該區塊的最小回歸清單。
5. 再進行下一區。

---

## 2) 專案結構地圖（維修視角）

### Backend

- `app/api/`：主要 API（auth、admin、images、videos、music、discussion、analytics、cron）
- `lib/serverAuth.js`：認證主入口（JWT cookie / Bearer / NextAuth fallback）
- `lib/authUtils.js`、`utils/auth.js`：路由包裝與管理員驗證
- `models/`：Mongoose schema（`User`、`Image`、`Video`、`Music`、`DiscussionPost` 等）
- `services/`：業務邏輯（例如 points）

### Frontend

- `app/`：頁面層（`images`、`videos`、`music`、`discussion`、`admin`）
- `components/`：功能元件（`upload`、`image`、`video`、`music`、`discussion`、`common`、`user`）
- `contexts/CurrentUserContext.js`：目前使用者/通知/訂閱狀態
- `components/context/PlayerContext.js`：播放器全域狀態
- `hooks/`：如 `useLikeHandler`、`useFollowState` 等

---

## 3) Auth 與權限（單一準則）

### 目前建議標準

- API 驗證優先使用：`@/lib/serverAuth` 的 `getCurrentUserFromRequest`
- Server component 驗證使用：`getCurrentUser`
- 管理員檢查：`user.isAdmin === true`

### 禁止再新增的模式

- 手動 `req.cookies.get("token")` + `jwt.verify(...)`
- 自行 regex 解析 cookie token
- 前端讀 `document.cookie` 取 token 做授權

### 高風險檔（改到時要特別小心）

- `lib/serverAuth.js`
- `lib/authUtils.js`
- `utils/auth.js`
- `app/api/auth/*`
- `app/api/admin/*`

---

## 4) 核心功能資料流

### A. 圖片上傳

前端：`UploadModal` / `UploadStep1` / `UploadStep2`  
API：`/api/images/direct-upload-url` -> `/api/images/upload-original-r2`（與 Cloudflare/R2 串接）

### B. 按讚/追蹤

- 圖片按讚：`/api/like-image`
- 追蹤：`/api/follow`、`/api/follow/note`
- UI 同步：`useLikeHandler`、`useFollowState`

### C. 討論區

- 貼文：`/api/discussion/posts`
- 留言：`/api/discussion/posts/[id]/comments`
- 刪留言：`/api/delete-comment/[commentId]`
- 內容清洗：`lib/sanitizeUserContent.js`

### D. 後台統計

- 總覽：`/api/admin/analytics-summary` + `/api/admin/analytics`
- 內容分析：`/api/admin/content-analytics/*`

---

## 5) 指標 Source of Truth（最重要）

### 互動與統計容易搞混的地方

- 圖片淨讚：`Image.likes` / `Image.likesCount`
- 圖片點擊/瀏覽：`Image.clicks` / `Image.viewCount`
- 訪問紀錄：`VisitorLog`
- 內容事件（事件流）：`ImageAnalytics` / `VideoAnalytics` / `MusicAnalytics`

### 原則

- **淨讚數** = 目前資料狀態（likes array / likesCount）
- **事件次數** = event log（analytics collections）
- 不可把 event count 當 net count

---

## 6) 目前已知耦合熱點（改了最容易連鎖）

- `PlayerContext`：改播放邏輯容易影響全站播放器
- `CurrentUserContext`：改使用者初始化容易引發 401 或登出狀態錯亂
- `app/api/admin/analytics-summary/route.js`：欄位意義容易被改錯（事件數 vs 淨值）
- 上傳鏈路：圖片/影片/音樂流程相似但不完全相同，不能直接複製貼上
- 討論區渲染與清洗：前端顯示與後端 sanitize 需雙層一致

---

## 7) 維修標準流程（建議固定）

1. **定位**：先確認是 auth、data source、render 還是 cache 問題。
2. **只改一層**：先改 API 或先改前端，避免同時大改兩端。
3. **加防呆**：遇到可疑輸入先做 sanitize/validate。
4. **回歸測試**：至少測正向 + 權限失敗 + 邊界情境。
5. **記錄**：把本次修補補進 docs（本文件或專項文件）。

---

## 8) 每次發版前最小回歸清單

- 登入/登出（一般帳號、OAuth 帳號）
- 圖片上傳、影片上傳、音樂上傳
- 圖片按讚、取消讚、追蹤/取消追蹤
- 討論區發文、留言、刪留言、連結點擊
- 後台 analytics 頁可正常載入且數值有更新
- 管理員 API 非 admin 應返回 401/403

---

## 9) 快速掃描指令（人工巡檢）

重點用 `rg` 搜這些模式：

- 舊驗證：`req.cookies.get("token")`, `jwt.verify(`, `Authorization: Bearer`
- XSS 風險：`dangerouslySetInnerHTML`, `innerHTML=`
- 祕鑰與敏感配置：`SECRET`, `API_TOKEN`, `ADMIN_SECRET`
- 來源混淆：`LikeLog`, `likesCount`, `ImageAnalytics`

---

## 10) 本專案的維護原則（簡版）

- 先穩定，再擴功能。
- 優先修 `Critical/High`，`Medium/Low` 放排程。
- 不追求零漏洞，追求可控風險與可維護性。
- 任何新功能都要先標明 source of truth，避免統計再錯位。

