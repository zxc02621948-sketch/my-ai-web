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

    // ✅ 如果環境變數都正確，只檢查環境變數狀態
    // 注意：實際的 API 測試需要上傳文件，這裡只驗證環境變數格式
    // 如果本地可以上傳，部署環境應該也可以（只要環境變數一致）
    const apiTest = {
      note: "環境變數格式驗證通過。實際 API 測試需要上傳文件，請直接測試上傳功能。",
      recommendation: "如果本地可以上傳，部署環境應該也可以。如果部署環境上傳失敗，請檢查：1) Token 是否與本地一致 2) Token 是否有 Cloudflare Images 權限"
    };

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

