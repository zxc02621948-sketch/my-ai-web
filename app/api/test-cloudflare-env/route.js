import { NextResponse } from "next/server";

// ✅ 測試端點：檢查 Cloudflare 環境變數並測試 API 連接
// 注意：這個端點應該只在開發環境或受保護的環境中使用
export async function GET(req) {
  try {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
    const token = process.env.CLOUDFLARE_API_TOKEN?.trim();

    // ✅ 檢查環境變數是否存在
    const hasAccountId = !!accountId;
    const hasToken = !!token;

    // ✅ 檢查格式（不顯示實際值，只顯示狀態）
    const accountIdValid = hasAccountId && /^[a-f0-9]{32}$/i.test(accountId);
    const tokenValid = hasToken && token.length > 0;

    // ✅ 計算長度（用於驗證）
    const accountIdLength = accountId ? accountId.length : 0;
    const tokenLength = token ? token.length : 0;

    const envStatus = {
      nodeEnv: process.env.NODE_ENV,
      hasAccountId,
      hasToken,
      accountIdValid,
      tokenValid,
      accountIdLength,
      tokenLength,
      // ✅ 只顯示前綴，不顯示完整值（安全考慮）
      accountIdPrefix: accountId ? `${accountId.substring(0, 8)}...` : "未設置",
      tokenPrefix: token ? `${token.substring(0, 10)}...` : "未設置",
    };

    // ✅ 如果環境變數都正確，測試 API 連接
    let apiTest = null;
    if (accountIdValid && tokenValid) {
      try {
        // ✅ 直接測試 v2 direct_upload API（這是上傳時實際使用的）
        const v2TestUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v2/direct_upload`;
        const v2TestRes = await fetch(v2TestUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        
        const v2TestResult = await v2TestRes.json();
        
        // ✅ 如果 v2 失敗，測試 v1 API
        let v1Test = null;
        if (v2TestRes.status !== 200) {
          // 測試 v1 API（使用一個小的測試請求）
          // 注意：v1 需要 FormData，所以我們只測試是否能訪問
          const v1TestUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1?per_page=1`;
          const v1TestRes = await fetch(v1TestUrl, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          
          const v1TestResult = await v1TestRes.json();
          v1Test = {
            httpStatus: v1TestRes.status,
            success: v1TestResult.success,
            authenticated: v1TestRes.status === 200 || v1TestRes.status === 404,
            error: v1TestResult.errors?.[0]?.message || null,
          };
        }

        apiTest = {
          v2Api: {
            httpStatus: v2TestRes.status,
            success: v2TestResult.success,
            authenticated: v2TestRes.status === 200 || v2TestRes.status === 401 || v2TestRes.status === 403,
            hasUploadUrl: !!v2TestResult.result?.uploadURL,
            error: v2TestResult.errors?.[0]?.message || null,
          },
          v1Api: v1Test,
          message: v2TestRes.status === 200
            ? "✅ v2 API 正常，可以使用客戶端直接上傳"
            : v2TestRes.status === 401 || v2TestRes.status === 403
            ? (v1Test?.authenticated 
                ? "⚠️ v2 API 無權限，但 v1 API 可用（將使用服務器端上傳 fallback）"
                : "❌ Token 認證失敗，請檢查 Token 是否有效或有 Cloudflare Images 權限")
            : "⚠️ API 連接異常"
        };
      } catch (apiError) {
        apiTest = {
          error: apiError.message,
          message: "❌ API 測試失敗"
        };
      }
    }

    return NextResponse.json({
      success: true,
      environment: envStatus,
      apiTest,
      message: accountIdValid && tokenValid 
        ? (apiTest?.authenticated ? "✅ 環境變數設置正確，API 連接正常" : "⚠️ 環境變數設置正確，但 API 認證失敗")
        : "❌ 環境變數設置有問題，請檢查部署平台的環境變數設置"
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

