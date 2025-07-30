import { NextResponse } from "next/server";

export async function DELETE(req) {
  const { searchParams } = new URL(req.url);
  const imageId = searchParams.get("id");

  if (!imageId) {
    return NextResponse.json({ success: false, message: "缺少 imageId" }, { status: 400 });
  }

  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/5c6250a0576aa4ca0bb9cdf32be0bee1/images/v1/${imageId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
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
