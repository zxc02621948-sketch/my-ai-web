import { NextResponse } from "next/server";

export async function POST() {
  try {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const token = process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !token) {
      console.error("❌ 環境變數缺失：", { accountId, token });
      return NextResponse.json({ success: false, error: "環境變數未設定" }, { status: 500 });
    }

    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v2/direct_upload`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log("🐞 Cloudflare 狀態碼：", res.status);

    const result = await res.json();
    console.log("🐞 Cloudflare 回傳內容：", result);

    if (!result.success || !result.result?.uploadURL) {
      return NextResponse.json({ success: false, error: "無法取得上傳 URL", cloudflare: result }, { status: 500 });
    }

    return NextResponse.json({ success: true, uploadURL: result.result.uploadURL });
  } catch (err) {
    console.error("❌ Cloudflare 請求異常：", err);
    return NextResponse.json({ success: false, error: "伺服器錯誤" }, { status: 500 });
  }
}
