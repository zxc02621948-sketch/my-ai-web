import { NextResponse } from "next/server";

// ✅ 測試端點：檢查 Cloudflare 環境變數是否正確設置
// 注意：這個端點應該只在開發環境或受保護的環境中使用
export async function GET(req) {
  try {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const token = process.env.CLOUDFLARE_API_TOKEN;

    // ✅ 檢查環境變數是否存在
    const hasAccountId = !!accountId;
    const hasToken = !!token;

    // ✅ 檢查格式（不顯示實際值，只顯示狀態）
    const accountIdValid = hasAccountId && /^[a-f0-9]{32}$/i.test(accountId.trim());
    const tokenValid = hasToken && token.trim().length > 0;

    // ✅ 計算長度（用於驗證）
    const accountIdLength = accountId ? accountId.trim().length : 0;
    const tokenLength = token ? token.trim().length : 0;

    return NextResponse.json({
      success: true,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasAccountId,
        hasToken,
        accountIdValid,
        tokenValid,
        accountIdLength,
        tokenLength,
        // ✅ 只顯示前綴，不顯示完整值（安全考慮）
        accountIdPrefix: accountId ? `${accountId.trim().substring(0, 8)}...` : "未設置",
        tokenPrefix: token ? `${token.trim().substring(0, 10)}...` : "未設置",
      },
      message: accountIdValid && tokenValid 
        ? "✅ 環境變數設置正確" 
        : "❌ 環境變數設置有問題，請檢查部署平台的環境變數設置"
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

