import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
    const token = process.env.CLOUDFLARE_API_TOKEN?.trim();

    if (!accountId || !token) {
      console.error("❌ 環境變數缺失：", { 
        hasAccountId: !!accountId, 
        hasToken: !!token,
        nodeEnv: process.env.NODE_ENV 
      });
      return NextResponse.json({ 
        success: false, 
        error: "環境變數未設定",
        details: "CLOUDFLARE_ACCOUNT_ID 或 CLOUDFLARE_API_TOKEN 未設置"
      }, { status: 500 });
    }

    // ✅ 驗證 Account ID 格式（應該是 32 個字符的十六進制字符串）
    if (!/^[a-f0-9]{32}$/i.test(accountId)) {
      console.error("❌ Account ID 格式錯誤：", {
        accountId: accountId ? `${accountId.substring(0, 8)}...` : "未設置",
        length: accountId?.length
      });
      return NextResponse.json({ 
        success: false, 
        error: "CLOUDFLARE_ACCOUNT_ID 格式不正確（應為 32 個字符的十六進制字符串）"
      }, { status: 500 });
    }
    
    // 可选：从请求中获取文件信息进行预验证
    try {
      const body = await req.json();
      
      // 验证文件类型（如果提供）
      if (body.fileType) {
        const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
        if (!validTypes.includes(body.fileType.toLowerCase())) {
          return NextResponse.json({ 
            success: false, 
            error: "不支持的文件格式，只允许 PNG、JPG、JPEG、WebP" 
          }, { status: 400 });
        }
      }
      
      // 验证文件大小（如果提供）
      if (body.fileSize) {
        const maxSize = 20 * 1024 * 1024; // 20MB
        if (body.fileSize > maxSize) {
          return NextResponse.json({ 
            success: false, 
            error: `文件太大，最大支持 20MB，当前: ${(body.fileSize / 1024 / 1024).toFixed(2)}MB` 
          }, { status: 400 });
        }
      }
    } catch (e) {
      // 如果没有 body 或解析失败，继续执行（向后兼容）
    }

    // ✅ 確保 token 沒有多餘的空格或換行
    const cleanToken = token.replace(/\s+/g, '');

    // ✅ 先嘗試使用 v2 API（direct_upload），如果失敗則回退到 v1
    let url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v2/direct_upload`;
    
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${cleanToken}`,
        "Content-Type": "application/json",
      },
    });

    let result = await res.json();
    let httpStatus = res.status;
    
    // ✅ 如果 v2 API 失敗（認證錯誤或 404），說明 Token 可能沒有 v2 權限
    // 這種情況下，我們建議用戶檢查 Token 權限，或者使用服務器端上傳
    if ((httpStatus === 401 || httpStatus === 403) && !result.success) {
      const errorMsg = result.errors?.[0]?.message || "認證失敗";
      console.error("❌ Cloudflare v2 API 認證失敗，可能的原因：", {
        httpStatus,
        error: errorMsg,
        suggestion: "Token 可能沒有 Cloudflare Images v2 API 的權限，請在 Cloudflare Dashboard 檢查 Token 權限設置"
      });
      
      // ✅ 返回詳細的錯誤信息，建議檢查 Token 權限
      return NextResponse.json({ 
        success: false,
        error: "Cloudflare API 認證失敗",
        details: errorMsg,
        suggestion: "請檢查 CLOUDFLARE_API_TOKEN 是否有 Cloudflare Images 的權限（特別是 v2 API）。如果沒有 v2 權限，可以考慮使用服務器端上傳（/api/cloudflare-upload）",
        httpStatus
      }, { status: 500 });
    }
    
    // ✅ 無論開發或生產環境都記錄錯誤（成功時只在開發環境記錄）
    if (!result.success || !result.result?.uploadURL) {
      const errorMessage = result.errors?.[0]?.message || "無法取得上傳 URL";
      
      console.error("❌ Cloudflare API 錯誤：", {
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
      let userFriendlyError = errorMessage;
      if (httpStatus === 401 || httpStatus === 403) {
        userFriendlyError = "Cloudflare API 認證失敗。請檢查 CLOUDFLARE_API_TOKEN 是否正確且有效，並確保 Token 有 Cloudflare Images 的權限（特別是 v2 API 權限）。";
      } else if (httpStatus === 404) {
        userFriendlyError = "Cloudflare Account ID 不存在或無效。請檢查 CLOUDFLARE_ACCOUNT_ID 是否正確。";
      }

      return NextResponse.json({ 
        success: false, 
        error: userFriendlyError,
        cloudflareError: result.errors?.[0],
        httpStatus,
        // ✅ 在開發環境返回更多調試信息
        ...(process.env.NODE_ENV === "development" && {
          debug: {
            status: httpStatus,
            errors: result.errors,
            messages: result.messages,
            accountId: `${accountId.substring(0, 8)}...`,
            tokenLength: cleanToken.length
          }
        })
      }, { status: 500 });
    }
    
    if (process.env.NODE_ENV === "development") {
      console.log("✅ Cloudflare 上傳 URL 獲取成功");
    }

    return NextResponse.json({ success: true, uploadURL: result.result.uploadURL });
  } catch (err) {
    console.error("❌ Cloudflare 請求異常：", {
      message: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined
    });
    return NextResponse.json({ 
      success: false, 
      error: "伺服器錯誤",
      message: err.message 
    }, { status: 500 });
  }
}
