import { NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/auth/getCurrentUserFromRequest";

class CloudflareUploadError extends Error {
  constructor(message, status = 500, extra = {}) {
    super(message);
    this.name = "CloudflareUploadError";
    this.status = status;
    this.extra = extra;
  }
}

export async function POST(req) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
    const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();

    if (!accountId || !apiToken) {
      console.error("❌ 環境變數缺失：", {
        hasAccountId: !!accountId,
        hasToken: !!apiToken,
        nodeEnv: process.env.NODE_ENV,
      });
      return NextResponse.json(
        {
          success: false,
          message: "環境變數未設定",
          details: "CLOUDFLARE_ACCOUNT_ID 或 CLOUDFLARE_API_TOKEN 未設置",
        },
        { status: 500 },
      );
    }

    if (!/^[a-f0-9]{32}$/i.test(accountId)) {
      console.error("❌ Account ID 格式錯誤：", {
        accountId: accountId ? `${accountId.substring(0, 8)}...` : "未設置",
        length: accountId?.length,
      });
      return NextResponse.json(
        {
          success: false,
          message: "CLOUDFLARE_ACCOUNT_ID 格式不正確（應為 32 個字符的十六進制字符串）",
        },
        { status: 500 },
      );
    }

    const uploadUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`;
    const cleanToken = apiToken.replace(/[\s\uFEFF\u200B-\u200D\u2060]/g, "").trim();

    if (process.env.NODE_ENV === "development") {
      console.log("🔍 [Cloudflare] Token 診斷：", {
        originalLength: apiToken.length,
        cleanedLength: cleanToken.length,
        hasSpecialChars: /[^a-zA-Z0-9_-]/.test(cleanToken),
      });
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string" || !file.name) {
      return NextResponse.json({ success: false, message: "Invalid file upload" }, { status: 400 });
    }

    // ✅ 主圖一律使用原圖（不再區分壓縮圖和原圖）
    const imageId = await uploadImageToCloudflare({
      file,
      uploadUrl,
      token: cleanToken,
      label: "primary",
    });

    if (process.env.NODE_ENV === "development") {
      console.log("✅ Cloudflare v1 API 上傳成功");
    }

    // ✅ 主圖就是原圖，所以 originalImageId 和 imageId 相同
    return NextResponse.json(
      { success: true, imageId, originalImageId: imageId },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof CloudflareUploadError) {
      console.error("❌ Cloudflare 上傳失敗：", error.extra || error.message);
      return NextResponse.json(
        {
          success: false,
          message: error.message,
          error: error.extra?.error,
          details: error.extra,
        },
        { status: error.status || 500 },
      );
    }

    console.error("❌ Cloudflare 上傳異常：", {
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
    return NextResponse.json(
      {
        success: false,
        message: "伺服器錯誤",
        error: error.message,
      },
      { status: 500 },
    );
  }
}

async function uploadImageToCloudflare({ file, uploadUrl, token, label, metadata }) {
  if (!file || typeof file === "string" || !file.name) {
    throw new CloudflareUploadError(`Invalid ${label} file upload`, 400);
  }

  const cfForm = new FormData();
  cfForm.append("file", file);
  if (metadata) {
    cfForm.append("metadata", JSON.stringify(metadata));
  }

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: cfForm,
  });

  const parsed = await parseCloudflareResponse(response, label);
  if (!parsed.success) {
    const { message, statusCode } = mapCloudflareError(parsed.httpStatus, parsed.errorMsg);
    throw new CloudflareUploadError(message, statusCode, {
      error: parsed.errorMsg,
      httpStatus: parsed.httpStatus,
      label,
      cfErrors: parsed.errors,
      response: parsed.rawResponse,
    });
  }

  return parsed.resultId;
}

async function parseCloudflareResponse(response, label) {
  const httpStatus = response.status;
  let result;
  let rawResponse = null;

  try {
    const responseText = await response.text();
    rawResponse = responseText;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error(`❌ Cloudflare API (${label}) 返回非 JSON 響應：`, {
        httpStatus,
        snippet: responseText.substring(0, 500),
      });
      result = {
        success: false,
        errors: [{ message: responseText || "Unknown error" }],
      };
    }
  } catch (readError) {
    console.error(`❌ 無法讀取 Cloudflare API (${label}) 響應：`, readError);
    result = {
      success: false,
      errors: [{ message: "無法讀取 API 響應" }],
    };
  }

  if (result.success) {
    return {
      success: true,
      resultId: result.result?.id,
      httpStatus,
      rawResponse: rawResponse ? rawResponse.substring(0, 500) : null,
    };
  }

  const errorMsg = result.errors?.[0]?.message || "Cloudflare upload failed";
  return {
    success: false,
    httpStatus,
    errorMsg,
    errors: result.errors,
    rawResponse: rawResponse ? rawResponse.substring(0, 500) : null,
  };
}

function mapCloudflareError(httpStatus, errorMsg = "") {
  if (httpStatus === 429) {
    return {
      message: "上傳請求過於頻繁，請稍後再試（建議等待 1-2 分鐘後重試）",
      statusCode: 429,
    };
  }

  if (httpStatus === 400 && errorMsg.toLowerCase().includes("authenticate")) {
    return {
      message:
        "Cloudflare API 認證失敗（HTTP 400）。請檢查 Token 格式與權限，確保具有 Cloudflare Images:Edit 權限。",
      statusCode: 400,
    };
  }

  if (
    httpStatus === 401 ||
    httpStatus === 403 ||
    errorMsg.toLowerCase().includes("authenticate") ||
    errorMsg.toLowerCase().includes("unauthorized")
  ) {
    return {
      message:
        "Cloudflare API 認證失敗。請檢查 CLOUDFLARE_API_TOKEN 是否正確且有 Cloudflare Images 權限。",
      statusCode: httpStatus,
    };
  }

  if (httpStatus === 404) {
    return {
      message: "Cloudflare Account ID 不存在或無效。請檢查環境變數。",
      statusCode: 404,
    };
  }

  return {
    message: errorMsg || "Cloudflare upload failed",
    statusCode: httpStatus >= 400 ? httpStatus : 500,
  };
}
