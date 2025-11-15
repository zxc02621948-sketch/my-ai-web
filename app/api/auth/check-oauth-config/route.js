// app/api/auth/check-oauth-config/route.js
// ✅ 檢查 OAuth 環境變數是否已配置（用於決定是否顯示 OAuth 按鈕）
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const hasGoogleConfig =
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;
    const hasFacebookConfig =
      process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET;

    // ✅ 只要有一個 OAuth provider 已配置，就顯示 OAuth 按鈕
    const enabled = hasGoogleConfig || hasFacebookConfig;

    return NextResponse.json({
      enabled,
      providers: {
        google: hasGoogleConfig,
        facebook: hasFacebookConfig,
      },
    });
  } catch (error) {
    console.error("❌ 檢查 OAuth 配置錯誤:", error);
    return NextResponse.json(
      { enabled: false, providers: { google: false, facebook: false } },
      { status: 500 }
    );
  }
}

