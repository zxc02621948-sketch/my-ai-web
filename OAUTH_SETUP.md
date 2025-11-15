# OAuth 第三方登入設定說明

## 📋 環境變數設定

請在 `.env.local` 或 `.env` 檔案中新增以下環境變數：

```bash
# NextAuth 設定
NEXTAUTH_SECRET=your-nextauth-secret-here  # 用於加密 session（必須設定）
NEXTAUTH_URL=http://localhost:3000  # 開發環境使用 localhost:3000，生產環境使用你的網域名稱

# Google OAuth 設定
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Facebook OAuth 設定
FACEBOOK_CLIENT_ID=your-facebook-app-id
FACEBOOK_CLIENT_SECRET=your-facebook-app-secret
```

## 🔧 Google OAuth 設定步驟

1. **前往 Google Cloud Console**
   - 訪問：https://console.cloud.google.com/
   - 建立新專案或選擇現有專案

2. **啟用必要的 API**
   - 在左側選單選擇「API 和服務」→「程式庫」
   - 搜尋並啟用「Google Identity Services API」（或「Google+ API」已不再需要，Google 已在 2019 年關閉 Google+）
   - 實際上，NextAuth 只需要 OAuth 2.0 憑證，不一定需要啟用特定 API

3. **建立 OAuth 2.0 憑證**
   - 前往「API 和服務」→「憑證」
   - 點擊「建立憑證」→「OAuth 用戶端 ID」
   - 選擇應用程式類型：「網頁應用程式」
   - 設定已授權的 JavaScript 來源：
     - 開發環境：`http://localhost:3000`
     - 生產環境：`https://yourdomain.com`
   - 設定已授權的重新導向 URI：
     - 開發環境：`http://localhost:3000/api/auth/callback/google`
     - 生產環境：`https://yourdomain.com/api/auth/callback/google`

4. **取得 Client ID 和 Client Secret**
   - 複製「用戶端 ID」和「用戶端密鑰」
   - 分別設定為 `GOOGLE_CLIENT_ID` 和 `GOOGLE_CLIENT_SECRET`

## 📘 Facebook OAuth 設定步驟

1. **前往 Facebook Developers**
   - 訪問：https://developers.facebook.com/
   - 登入 Facebook 帳號

2. **建立應用程式**
   - 點擊「我的應用程式」→「建立應用程式」
   - 選擇「消費者」應用程式類型
   - 填寫應用程式名稱和聯絡 Email

3. **新增 Facebook 登入產品**
   - 在應用程式儀表板中，點擊「新增產品」
   - 選擇「Facebook 登入」→「設定」

4. **設定有效的 OAuth 重新導向 URI**
   - 在「設定」→「基本」中，新增「有效的 OAuth 重新導向 URI」：
     - 開發環境：`http://localhost:3000/api/auth/callback/facebook`
     - 生產環境：`https://yourdomain.com/api/auth/callback/facebook`

5. **取得 App ID 和 App Secret**
   - 在「設定」→「基本」中找到「應用程式編號」（App ID）
   - 在「設定」→「基本」中點擊「顯示」以查看「應用程式密鑰」（App Secret）
   - 分別設定為 `FACEBOOK_CLIENT_ID` 和 `FACEBOOK_CLIENT_SECRET`

## 🔐 產生 NEXTAUTH_SECRET

你可以使用以下命令產生一個安全的 secret：

```bash
# 使用 openssl
openssl rand -base64 32

# 或使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

將產生的值設定為 `NEXTAUTH_SECRET`。

## ✅ 驗證設定

設定完成後，重新啟動開發伺服器：

```bash
npm run dev
```

然後訪問登入頁面，你應該可以看到「使用 Google 登入」和「使用 Facebook 登入」按鈕。

## ⚠️ 注意事項

1. **開發環境**：使用 `http://localhost:3000` 作為 `NEXTAUTH_URL`
2. **生產環境**：使用完整的網域名稱作為 `NEXTAUTH_URL`（例如：`https://yourdomain.com`）
3. **重新導向 URI**：必須在 Google 和 Facebook 的設定中正確配置，否則會出現錯誤
4. **隱私政策**：Facebook 應用程式可能需要提供隱私政策 URL 才能通過審核

## 🐛 常見問題

### Q: OAuth 登入後無法取得 token？
A: 確認 `NEXTAUTH_SECRET` 已正確設定，並且 `NEXTAUTH_URL` 與當前網域相符。

### Q: Facebook 登入出現「無效的重新導向 URI」錯誤？
A: 確認在 Facebook 應用程式設定中，已正確新增重新導向 URI。

### Q: Google 登入出現「redirect_uri_mismatch」錯誤？
A: 確認在 Google Cloud Console 中，已正確設定已授權的重新導向 URI。

