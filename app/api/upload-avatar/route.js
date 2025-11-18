import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import User from "@/models/User";

const CLOUDFLARE_ACCOUNT_HASH = "qQdazZfBAN4654_waTSV7A"; // ⬅️ 你的 Cloudflare 資訊

export async function POST(req) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("id");
  
  console.log("🔧 upload-avatar 收到請求:", { userId });

  if (!userId) {
    console.log("❌ 缺少使用者 ID");
    return NextResponse.json({ error: "缺少使用者 ID" }, { status: 400 });
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "缺少圖片檔案" }, { status: 400 });
  }

  try {
    // ✅ 使用環境變數（與 cloudflare-upload 一致）
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
    const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();

    if (!accountId || !apiToken) {
      console.error("❌ 環境變數缺失：", { 
        hasAccountId: !!accountId, 
        hasToken: !!apiToken,
        nodeEnv: process.env.NODE_ENV 
      });
      return NextResponse.json({ 
        error: "環境變數未設定",
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
        error: "CLOUDFLARE_ACCOUNT_ID 格式不正確（應為 32 個字符的十六進制字符串）"
      }, { status: 500 });
    }

    // ✅ 確保 token 沒有多餘的空格或換行
    const cleanToken = apiToken.replace(/\s+/g, '');

    console.log("🔧 開始上傳到 Cloudflare:", { 
      fileName: file.name, 
      fileSize: file.size, 
      fileType: file.type,
      hasToken: !!cleanToken,
      accountIdPrefix: `${accountId.substring(0, 8)}...`
    });

    // 1. 上傳到 Cloudflare
    const uploadUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`;
    const cfForm = new FormData();
    cfForm.append("file", file);

    const cloudflareRes = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cleanToken}`,
      },
      body: cfForm,
    });

    const httpStatus = cloudflareRes.status;
    const cfResult = await cloudflareRes.json();

    if (!cfResult.success) {
      const errorMsg = cfResult.errors?.[0]?.message || "Cloudflare upload failed";
      console.error("❌ Cloudflare 上傳失敗：", {
        httpStatus,
        accountId: `${accountId.substring(0, 8)}...`,
        tokenLength: cleanToken.length,
        errors: cfResult.errors,
        messages: cfResult.messages,
      });

      // ✅ 根據 HTTP 狀態碼提供更具體的錯誤訊息
      let userFriendlyError = errorMsg;
      if (httpStatus === 401 || httpStatus === 403) {
        userFriendlyError = "Cloudflare API 認證失敗。請檢查 CLOUDFLARE_API_TOKEN 是否正確且有效，並確保 Token 有 Cloudflare Images 的權限。";
      } else if (httpStatus === 404) {
        userFriendlyError = "Cloudflare Account ID 不存在或無效。請檢查 CLOUDFLARE_ACCOUNT_ID 是否正確。";
      }

      return NextResponse.json({ 
        error: userFriendlyError,
        details: cfResult.errors || "未知錯誤",
        httpStatus
      }, { status: 500 });
    }

    const imageId = cfResult.result.id;
    const imageUrl = `https://imagedelivery.net/${CLOUDFLARE_ACCOUNT_HASH}/${imageId}/avatar`;

    // 2. 寫入 MongoDB
    await dbConnect();
    console.log("🔧 準備更新用戶頭像:", { userId, imageUrl });
    
    const updateResult = await User.findByIdAndUpdate(userId, { 
      image: imageUrl
    }, { new: true });
    
    console.log("🔧 數據庫更新結果:", updateResult ? "成功" : "失敗");
    console.log("🔧 更新後的用戶數據:", {
      image: updateResult?.image
    });

    return NextResponse.json({ 
      success: true,
      image: imageUrl 
    });
  } catch (err) {
    console.error("頭貼上傳錯誤", err);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
