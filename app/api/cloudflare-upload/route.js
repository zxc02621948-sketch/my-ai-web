import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
    const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();

    if (!accountId || !apiToken) {
      console.error("❌ 環境變數缺失：", { 
        hasAccountId: !!accountId, 
        hasToken: !!apiToken,
        nodeEnv: process.env.NODE_ENV 
      });
      return NextResponse.json({ 
        success: false, 
        message: "環境變數未設定",
        details: "CLOUDFLARE_ACCOUNT_ID 或 CLOUDFLARE_API_TOKEN 未設置"
      }, { status: 500 });
    }

    // ✅ 驗證 Account ID 格式
    if (!/^[a-f0-9]{32}$/i.test(accountId)) {
      console.error("❌ Account ID 格式錯誤：", {
        accountId: accountId ? `${accountId.substring(0, 8)}...` : "未設置",
        length: accountId?.length
      });
      return NextResponse.json({ 
        success: false, 
        message: "CLOUDFLARE_ACCOUNT_ID 格式不正確（應為 32 個字符的十六進制字符串）"
      }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string" || !file.name) {
      return NextResponse.json({ success: false, message: "Invalid file upload" }, { status: 400 });
    }

    // ✅ 確保 token 沒有多餘的空格或換行
    const cleanToken = apiToken.replace(/\s+/g, '');

    // ✅ 使用原生 FormData（與 upload-avatar 一致）
    const cfForm = new FormData();
    cfForm.append("file", file);

    const uploadUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`;
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cleanToken}`,
      },
      body: cfForm,
    });

    const result = await response.json();
    const httpStatus = response.status;

    if (!result.success) {
      const errorMsg = result.errors?.[0]?.message || "Cloudflare upload failed";
      console.error("❌ Cloudflare v1 API 上傳失敗：", {
        httpStatus,
        accountId: `${accountId.substring(0, 8)}...`,
        tokenLength: cleanToken.length,
        tokenPrefix: cleanToken.substring(0, 10) + "...",
        errors: result.errors,
        messages: result.messages,
        // ✅ 只在開發環境記錄完整響應
        fullResponse: process.env.NODE_ENV === "development" ? result : undefined
      });

      // ✅ 根據 HTTP 狀態碼提供更具體的錯誤訊息
      let userFriendlyError = errorMsg;
      if (httpStatus === 401 || httpStatus === 403) {
        userFriendlyError = "Cloudflare API 認證失敗。請檢查 CLOUDFLARE_API_TOKEN 是否正確且有效，並確保 Token 有 Cloudflare Images 的權限。";
      } else if (httpStatus === 404) {
        userFriendlyError = "Cloudflare Account ID 不存在或無效。請檢查 CLOUDFLARE_ACCOUNT_ID 是否正確。";
      }

      return NextResponse.json({ 
        success: false, 
        message: userFriendlyError,
        errors: result.errors,
        httpStatus
      }, { status: 500 });
    }

    if (process.env.NODE_ENV === "development") {
      console.log("✅ Cloudflare v1 API 上傳成功");
    }

    return NextResponse.json({ success: true, imageId: result.result.id }, { status: 200 });
  } catch (error) {
    console.error("❌ Cloudflare 上傳異常：", {
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined
    });
    return NextResponse.json({ 
      success: false, 
      message: "伺服器錯誤",
      error: error.message 
    }, { status: 500 });
  }
}
