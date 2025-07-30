import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";

const CLOUDFLARE_ACCOUNT_HASH = "qQdazZfBAN4654_waTSV7A"; // ⬅️ 你的 Cloudflare 資訊
const CLOUDFLARE_UPLOAD_URL = `https://api.cloudflare.com/client/v4/accounts/5c6250a0576aa4ca0bb9cdf32be0bee1/images/v1`;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN; // ⬅️ 你必須在 .env 設定

export async function POST(req) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("id");

  if (!userId) {
    return NextResponse.json({ error: "缺少使用者 ID" }, { status: 400 });
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "缺少圖片檔案" }, { status: 400 });
  }

  try {
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

    const cfResult = await cloudflareRes.json();

    if (!cfResult.success) {
      console.error("Cloudflare 上傳失敗", cfResult);
      return NextResponse.json({ error: "上傳失敗" }, { status: 500 });
    }

    const imageId = cfResult.result.id;
    const imageUrl = `https://imagedelivery.net/${CLOUDFLARE_ACCOUNT_HASH}/${imageId}/avatar`;

    // 2. 寫入 MongoDB
    await connectToDatabase();
    await User.findByIdAndUpdate(userId, { image: imageUrl });

    return NextResponse.json({ image: imageUrl });
  } catch (err) {
    console.error("頭貼上傳錯誤", err);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
