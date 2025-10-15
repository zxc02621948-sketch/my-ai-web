# 🚀 上線前檢查清單

本文檔提供網站公開上線前的完整檢查清單和實施指南。

## ✅ 已完成（本次更新）

### 🔥 高優先級

#### 1. 隱私政策 ✅
- **文件**: `app/privacy/page.jsx`
- **URL**: `/privacy`
- **內容**: 完整的隱私政策，包含資料收集、使用、分享、安全等說明
- **下一步**: 在頁尾和註冊頁面添加隱私政策連結

#### 2. robots.txt ✅
- **文件**: `public/robots.txt`
- **功能**: 引導搜尋引擎索引公開內容，保護私密頁面
- **下一步**: 
  - 將 `https://your-domain.com` 替換為實際域名
  - 根據實際需求調整允許/禁止的路徑

#### 3. 動態 Sitemap ✅
- **文件**: `app/sitemap.xml/route.js`
- **URL**: `/sitemap.xml`
- **功能**: 自動生成包含最新圖片、用戶、討論的 sitemap
- **下一步**: 
  - 設置 `NEXT_PUBLIC_BASE_URL` 環境變數
  - 提交 sitemap 到 Google Search Console

#### 4. 自定義 404 頁面 ✅
- **文件**: `app/not-found.js`
- **功能**: 美觀的 404 錯誤頁面，提供導航選項
- **測試**: 訪問任意不存在的路徑（如 `/test-404`）

#### 5. SEO Meta 標籤和 Open Graph ✅
- **文件**: `app/layout.js`
- **功能**: 
  - 完整的 SEO meta 標籤
  - Open Graph 社交分享卡片
  - Twitter Card 支援
  - Google 搜尋優化設置
- **下一步**: 
  - 設置 `NEXT_PUBLIC_BASE_URL` 環境變數
  - 準備 1200x630 的社交分享圖片
  - 添加搜尋引擎驗證碼（Google、Bing）

### ⚡ 中優先級

#### 6. 安全標頭 ✅
- **文件**: `next.config.js`
- **功能**: 
  - HSTS (Strict-Transport-Security)
  - XSS 保護
  - Clickjacking 防護
  - Content-Type 嗅探保護
  - CORS 設置
- **測試**: 使用 [securityheaders.com](https://securityheaders.com) 檢查

#### 7. API 速率限制 ✅
- **文件**: `lib/rateLimit.js`
- **功能**: 
  - 記憶體內速率限制器
  - 預設限制器（60次/分鐘）
  - 嚴格限制器（10次/分鐘）
  - 上傳限制器（5次/5分鐘）
  - 認證限制器（5次/15分鐘）
- **使用範例**:
  ```javascript
  import { withRateLimit, uploadLimiter } from "@/lib/rateLimit";
  
  export const POST = withRateLimit(
    async (req) => {
      // 你的 API 邏輯
    },
    uploadLimiter
  );
  ```
- **下一步**: 
  - 為關鍵 API 路由添加速率限制
  - 生產環境考慮使用 Redis

#### 8. 圖片懶加載優化 ✅
- **文件**: `components/image/ImageCard.jsx`
- **功能**: 
  - Native `loading="lazy"` 屬性
  - 載入佔位符（旋轉動畫）
  - 平滑淡入效果
  - 錯誤處理
- **效果**: 減少初始載入時間，提升性能

---

## 🔧 環境變數設置

### 必須設置的環境變數

在 `.env.local` 中添加以下變數：

```bash
# 網站基礎 URL（必須）
NEXT_PUBLIC_BASE_URL=https://your-actual-domain.com

# MongoDB 連接（已有）
MONGODB_URI=your_mongodb_connection_string

# Cloudflare Images（已有）
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token

# Email 服務（已有）
RESEND_API_KEY=your_resend_key
RESEND_FROM=noreply@your-domain.com
ADMIN_EMAILS=admin@your-domain.com

# JWT 密鑰（已有）
JWT_SECRET=your_jwt_secret

# 其他可選
NODE_ENV=production
```

---

## 📋 上線前必做事項

### 1. SEO 優化
- [ ] 設置 `NEXT_PUBLIC_BASE_URL` 為實際域名
- [ ] 更新 `robots.txt` 中的 Sitemap URL
- [ ] 準備 OG 圖片（1200x630px）放在 `public/` 目錄
- [ ] 註冊 Google Search Console
- [ ] 提交 sitemap 到 Google
- [ ] 驗證 Google Search Console（更新 `app/layout.js` 中的驗證碼）
- [ ] 測試社交分享卡片：[Twitter Card Validator](https://cards-dev.twitter.com/validator)
- [ ] 測試社交分享卡片：[Facebook Debugger](https://developers.facebook.com/tools/debug/)

### 2. 法律合規
- [ ] 確認隱私政策內容符合當地法律
- [ ] 在註冊頁面添加隱私政策和服務條款勾選框
- [ ] 在頁尾添加隱私政策、服務條款、免責聲明連結
- [ ] 考慮添加 Cookie 同意橫幅（如果需要）
- [ ] 準備聯絡方式（電子郵件、客服）

### 3. 性能優化
- [ ] 運行 Lighthouse 審計
- [ ] 優化 Core Web Vitals
- [ ] 壓縮所有靜態資源
- [ ] 設置 CDN（Cloudflare）
- [ ] 啟用 Brotli/Gzip 壓縮
- [ ] 測試移動端性能

### 4. 安全加固
- [ ] 為關鍵 API 添加速率限制
- [ ] 審查所有用戶輸入驗證
- [ ] 確保所有敏感資料加密傳輸
- [ ] 設置 HTTPS（強制）
- [ ] 測試 XSS 和 SQL 注入防護
- [ ] 設置安全監控和日誌

### 5. 功能測試
- [ ] 測試用戶註冊流程
- [ ] 測試郵件發送（驗證、重設密碼）
- [ ] 測試圖片上傳功能
- [ ] 測試評論和討論功能
- [ ] 測試點讚和收藏功能
- [ ] 測試積分系統
- [ ] 測試播放器功能
- [ ] 測試管理員後台
- [ ] 測試 404 和錯誤頁面
- [ ] 測試響應式設計（手機、平板、桌面）

### 6. 內容準備
- [ ] 準備歡迎訊息/公告
- [ ] 準備初始內容（示範圖片）
- [ ] 準備使用教學
- [ ] 準備 FAQ
- [ ] 檢查所有頁面文字
- [ ] 檢查所有連結

### 7. 監控和分析
- [ ] 設置 Google Analytics（可選）
- [ ] 設置錯誤追蹤（Sentry）（可選）
- [ ] 設置正常運行監控（UptimeRobot）（可選）
- [ ] 設置性能監控

---

## 🛠️ 建議的 API 速率限制配置

根據不同的 API 端點特性，建議使用以下速率限制：

### 認證相關
```javascript
// app/api/auth/login/route.js
import { withRateLimit, authLimiter } from "@/lib/rateLimit";

export const POST = withRateLimit(
  async (req) => { /* ... */ },
  authLimiter // 5次/15分鐘
);
```

### 上傳相關
```javascript
// app/api/cloudflare-upload/route.js
import { withRateLimit, uploadLimiter } from "@/lib/rateLimit";

export const POST = withRateLimit(
  async (req) => { /* ... */ },
  uploadLimiter // 5次/5分鐘
);
```

### 一般 API
```javascript
// app/api/images/route.js
import { withRateLimit, defaultLimiter } from "@/lib/rateLimit";

export const GET = withRateLimit(
  async (req) => { /* ... */ },
  defaultLimiter // 60次/分鐘
);
```

### 敏感操作
```javascript
// app/api/reports/route.js
import { withRateLimit, strictLimiter } from "@/lib/rateLimit";

export const POST = withRateLimit(
  async (req) => { /* ... */ },
  strictLimiter // 10次/分鐘
);
```

---

## 📊 性能優化建議

### 圖片優化
- ✅ 已實現懶加載
- ✅ 已設置 Cloudflare Images
- 🔄 考慮添加圖片尺寸優化
- 🔄 考慮添加 WebP 格式支援

### 代碼優化
- 🔄 啟用 Next.js 壓縮
- 🔄 拆分大型組件
- 🔄 使用動態導入（代碼分割）
- 🔄 優化 Bundle 大小

### 資料庫優化
- 🔄 確保所有查詢都有適當的索引
- 🔄 使用分頁避免大量資料查詢
- 🔄 實現查詢快取（Redis）

---

## 🎯 上線後立即監控

### 第一週重點
1. 監控錯誤率
2. 監控回應時間
3. 監控用戶註冊/登入成功率
4. 監控圖片上傳成功率
5. 收集用戶回饋

### 持續優化
1. 分析 Google Search Console 數據
2. 優化 SEO 關鍵字
3. 改善 Core Web Vitals
4. 根據用戶行為優化 UI/UX
5. 定期安全審計

---

## 🚨 緊急處理

### 如果遇到問題
1. 檢查錯誤日誌
2. 檢查伺服器資源使用
3. 檢查資料庫連接
4. 檢查第三方服務狀態
5. 回滾到上一個穩定版本（如需要）

### 備份計畫
- 定期備份資料庫
- 保留舊版本代碼
- 文檔化部署流程

---

## 📚 相關資源

- [Next.js 部署文檔](https://nextjs.org/docs/deployment)
- [Vercel 部署指南](https://vercel.com/docs)
- [Google Search Console](https://search.google.com/search-console)
- [SecurityHeaders.com](https://securityheaders.com)
- [PageSpeed Insights](https://pagespeed.web.dev/)
- [WebPageTest](https://www.webpagetest.org/)

---

## ✅ 更新記錄

- **2025-10-15**: 初始版本，完成高優先級和中優先級功能
  - 隱私政策頁面
  - robots.txt 和 sitemap.xml
  - 自定義 404 頁面
  - SEO meta 標籤優化
  - 安全標頭設置
  - API 速率限制
  - 圖片懶加載優化

---

**準備好了嗎？** 按照這個清單一步步檢查，你的網站就能安全、穩定地上線了！🎉

