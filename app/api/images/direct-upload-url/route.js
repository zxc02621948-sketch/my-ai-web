import { NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/auth/getCurrentUserFromRequest";

/**
 * Step 2-1: 生成 Cloudflare Images Direct Upload URL
 * POST /api/images/direct-upload-url
 * 
 * 返回：{ uploadURL, imageId }
 */
export async function POST(req) {
  try {
    // ✅ 驗證用戶登入（可選，如果需要追蹤用戶）
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const accountId =
      process.env.CLOUDFLARE_ACCOUNT_ID?.trim() ||
      process.env.CLOUDFLARE_IMAGES_ACCOUNT_ID?.trim();
    const apiToken =
      process.env.CLOUDFLARE_API_TOKEN?.trim() ||
      process.env.CLOUDFLARE_IMAGES_API_TOKEN?.trim();

    if (!accountId || !apiToken) {
      console.error("❌ 環境變數缺失：", {
        hasAccountId: !!accountId,
        hasToken: !!apiToken,
      });
      return NextResponse.json(
        {
          success: false,
          message: "環境變數未設定",
          details: "CLOUDFLARE_ACCOUNT_ID 或 CLOUDFLARE_API_TOKEN 未設置",
        },
        { status: 500 }
      );
    }

    if (!/^[a-f0-9]{32}$/i.test(accountId)) {
      return NextResponse.json(
        {
          success: false,
          message: "CLOUDFLARE_ACCOUNT_ID 格式不正確（應為 32 個字符的十六進制字符串）",
        },
        { status: 500 }
      );
    }

    const cleanToken = apiToken.replace(/[\s\uFEFF\u200B-\u200D\u2060]/g, "").trim();
    const directUploadUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v2/direct_upload`;

    // ✅ 可選：從請求中獲取 metadata（例如 userId、rating、platform，用於追蹤）
    const body = await req.json().catch(() => ({}));
    const metadata = body.metadata || {};

    // Cloudflare direct_upload expects multipart/form-data.
    const requestForm = new FormData();
    requestForm.append("expiry", new Date(Date.now() + 10 * 60 * 1000).toISOString()); // 10 分鐘後過期
    if (Object.keys(metadata).length > 0) {
      requestForm.append("metadata", JSON.stringify(metadata));
    }

    // ✅ 調用 Cloudflare Direct Upload API
    const response = await fetch(directUploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cleanToken}`,
      },
      body: requestForm,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText || "Unknown error" };
      }

      console.error("❌ Cloudflare Direct Upload URL 生成失敗：", {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      });

      const cfPrimaryError =
        errorData.errors?.[0]?.message ||
        errorData.error?.message ||
        errorData.message ||
        "Unknown error";
      const cfErrorCodes = Array.isArray(errorData.errors)
        ? errorData.errors.map((e) => e?.code).filter(Boolean)
        : [];

      return NextResponse.json(
        {
          success: false,
          message: "無法生成上傳 URL",
          error: cfPrimaryError,
          details: cfErrorCodes.length ? `Cloudflare error codes: ${cfErrorCodes.join(", ")}` : undefined,
        },
        { status: response.status >= 400 && response.status < 500 ? response.status : 500 }
      );
    }

    const result = await response.json();

    if (!result.success || !result.result?.uploadURL || !result.result?.id) {
      console.error("❌ Cloudflare Direct Upload URL 響應格式錯誤：", result);
      return NextResponse.json(
        {
          success: false,
          message: "Cloudflare API 響應格式錯誤",
        },
        { status: 500 }
      );
    }

    if (process.env.NODE_ENV === "development") {
      console.log("✅ Cloudflare Direct Upload URL 生成成功：", {
        imageId: result.result.id,
        uploadURLPrefix: result.result.uploadURL.substring(0, 50) + "...",
      });
    }

    return NextResponse.json({
      success: true,
      uploadURL: result.result.uploadURL,
      imageId: result.result.id,
    });
  } catch (error) {
    console.error("❌ Direct Upload URL 生成異常：", {
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
    return NextResponse.json(
      {
        success: false,
        message: "伺服器錯誤",
        error: error.message,
      },
      { status: 500 }
    );
  }
}










