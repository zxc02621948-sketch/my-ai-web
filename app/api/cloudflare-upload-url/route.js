import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const token = process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !token) {
      console.error("❌ 環境變數缺失：", { accountId, token });
      return NextResponse.json({ success: false, error: "環境變數未設定" }, { status: 500 });
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
