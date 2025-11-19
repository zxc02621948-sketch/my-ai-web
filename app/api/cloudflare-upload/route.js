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

    // ✅ 確保 token 沒有多餘的空格或換行，並移除所有不可見字符
    const cleanToken = apiToken.replace(/[\s\uFEFF\u200B-\u200D\u2060]/g, '').trim();
    
    // ✅ 診斷：檢查 Token 格式
    console.log("🔍 [診斷] Token 檢查：", {
      originalLength: apiToken.length,
      cleanedLength: cleanToken.length,
      tokenPrefix: cleanToken.substring(0, 10) + "...",
      tokenSuffix: "..." + cleanToken.substring(cleanToken.length - 5),
      hasSpecialChars: /[^a-zA-Z0-9_-]/.test(cleanToken),
      // Cloudflare API Token 通常是 40 字符，但有些可能是 39
      expectedLength: "通常為 40 字符"
    });

    // ✅ 使用原生 FormData（與 upload-avatar 一致）
    const cfForm = new FormData();
    cfForm.append("file", file);

    const uploadUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`;
    
    // ✅ 診斷：記錄請求詳情（不記錄完整 token）
    console.log("🔍 [診斷] 準備發送請求：", {
      uploadUrl: uploadUrl,
      method: "POST",
      hasFile: !!file,
      fileSize: file?.size,
      fileName: file?.name,
      fileType: file?.type,
      authorizationHeaderPrefix: `Bearer ${cleanToken.substring(0, 10)}...`
    });
    
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cleanToken}`,
      },
      body: cfForm,
    });

    const httpStatus = response.status;
    let result;
    
    // ✅ 嘗試解析 JSON 響應，如果失敗則使用原始文本
    try {
      const responseText = await response.text();
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        // 如果不是 JSON，創建一個錯誤對象
        console.error("❌ Cloudflare API 返回非 JSON 響應：", {
          httpStatus,
          responseText: responseText.substring(0, 500)
        });
        result = {
          success: false,
          errors: [{ message: responseText || "Unknown error" }]
        };
      }
    } catch (readError) {
      console.error("❌ 無法讀取 Cloudflare API 響應：", readError);
      result = {
        success: false,
        errors: [{ message: "無法讀取 API 響應" }]
      };
    }

    if (!result.success) {
      const errorMsg = result.errors?.[0]?.message || "Cloudflare upload failed";
      console.error("❌ Cloudflare v1 API 上傳失敗：", {
        httpStatus,
        accountId: `${accountId.substring(0, 8)}...`,
        tokenLength: cleanToken.length,
        tokenPrefix: cleanToken.substring(0, 10) + "...",
        errors: result.errors,
        messages: result.messages,
        // ✅ 記錄完整響應以便調試（生產環境也記錄，但只記錄錯誤部分）
        fullResponse: result
      });

      // ✅ 根據 HTTP 狀態碼和錯誤訊息提供更具體的錯誤訊息
      let userFriendlyError = errorMsg;
      let statusCode = 500;
      
      if (httpStatus === 429) {
        // ✅ 特殊處理 429 錯誤（速率限制）
        userFriendlyError = "上傳請求過於頻繁，請稍後再試（建議等待 1-2 分鐘後重試）";
        statusCode = 429;
      } else if (httpStatus === 400 && errorMsg.includes("authenticate")) {
        // HTTP 400 + 認證錯誤通常表示 Token 格式或權限問題
        userFriendlyError = "Cloudflare API 認證失敗（HTTP 400）。可能的原因：1) Token 格式不正確 2) Token 沒有 Cloudflare Images 的 Edit 權限 3) Token 已過期或被撤銷。請在 Cloudflare Dashboard 檢查 Token 權限，確保有 'Cloudflare Images:Edit' 權限。";
      } else if (httpStatus === 401 || httpStatus === 403 || errorMsg.includes("authenticate") || errorMsg.includes("Unauthorized")) {
        userFriendlyError = "Cloudflare API 認證失敗。請檢查部署環境的 CLOUDFLARE_API_TOKEN 是否正確且有效，並確保 Token 有 Cloudflare Images 的 Edit 權限。";
      } else if (httpStatus === 404) {
        userFriendlyError = "Cloudflare Account ID 不存在或無效。請檢查部署環境的 CLOUDFLARE_ACCOUNT_ID 是否正確。";
      }

      return NextResponse.json({ 
        success: false, 
        message: userFriendlyError,
        error: errorMsg, // ✅ 保留原始錯誤訊息
        errors: result.errors,
        httpStatus
      }, { status: statusCode });
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
