import { NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/serverAuth";

export async function DELETE(req) {
  const currentUser = await getCurrentUserFromRequest(req).catch(() => null);
  if (!currentUser?._id) {
    return NextResponse.json({ success: false, message: "未授權" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const imageId = searchParams.get("id");

  if (!imageId) {
    return NextResponse.json({ success: false, message: "缺少 imageId" }, { status: 400 });
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

    // ✅ 確保 token 沒有多餘的空格或換行
    const cleanToken = apiToken.replace(/\s+/g, '');

    const deleteUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1/${imageId}`;
    const res = await fetch(deleteUrl, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${cleanToken}`,
      },
    });

    const data = await res.json();

    if (!data.success) {
      console.error("❌ Cloudflare 刪除失敗：", data);
      return NextResponse.json({ success: false, message: "刪除失敗", cloudflare: data }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ Cloudflare 刪除異常：", error);
    return NextResponse.json({ success: false, message: "伺服器錯誤" }, { status: 500 });
  }
}
