import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import User from "@/models/User";

const CLOUDFLARE_ACCOUNT_HASH = "qQdazZfBAN4654_waTSV7A"; // ⬅️ 你的 Cloudflare 資訊
const CLOUDFLARE_UPLOAD_URL = `https://api.cloudflare.com/client/v4/accounts/5c6250a0576aa4ca0bb9cdf32be0bee1/images/v1`;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || "NKLeyPVUMWLGI4MTFmPNnDZj0ZgWA5xj0tS2bQEA"; // ⬅️ 你必須在 .env 設定

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
    console.log("🔧 開始上傳到 Cloudflare:", { 
      fileName: file.name, 
      fileSize: file.size, 
      fileType: file.type,
      hasToken: !!CLOUDFLARE_API_TOKEN 
    });

    // 1. 上傳到 Cloudflare
    const cloudflareRes = await fetch(CLOUDFLARE_UPLOAD_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
      body: (() => {
        const cfForm = new FormData();
        cfForm.append("file", file);
        return cfForm;
      })(),
    });

    console.log("🔧 Cloudflare 響應狀態:", cloudflareRes.status);
    const cfResult = await cloudflareRes.json();
    console.log("🔧 Cloudflare 響應結果:", cfResult);

    if (!cfResult.success) {
      console.error("Cloudflare 上傳失敗", cfResult);
      return NextResponse.json({ 
        error: "上傳失敗", 
        details: cfResult.errors || "未知錯誤" 
      }, { status: 500 });
    }

    const imageId = cfResult.result.id;
    const imageUrl = `https://imagedelivery.net/${CLOUDFLARE_ACCOUNT_HASH}/${imageId}/avatar`;

    // 2. 寫入 MongoDB
    await dbConnect();
    console.log("🔧 準備更新用戶頭像:", { userId, imageUrl });
    
    const updateResult = await User.findByIdAndUpdate(userId, { 
      image: imageUrl,
      avatar: imageUrl 
    }, { new: true });
    
    console.log("🔧 數據庫更新結果:", updateResult ? "成功" : "失敗");
    console.log("🔧 更新後的用戶數據:", {
      image: updateResult?.image,
      avatar: updateResult?.avatar
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
