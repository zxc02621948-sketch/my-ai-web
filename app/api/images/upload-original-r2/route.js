import { NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/auth/getCurrentUserFromRequest";
import { uploadToR2 } from "@/lib/r2";

export async function POST(req) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string" || !file.name) {
      return NextResponse.json({ success: false, message: "Invalid file upload" }, { status: 400 });
    }

    // 生成 R2 存储路径
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    const extension = file.name.split('.').pop() || 'jpg';
    const key = `images/original/${user._id}/${timestamp}-${randomString}.${extension}`;

    // 读取文件为 Buffer（保持原始质量，不压缩）
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log("📤 R2 原圖上傳:", {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      bufferSize: buffer.length,
      key,
    });

    // 上传到 R2（直接上传，不进行任何压缩或处理）
    const publicUrl = await uploadToR2(buffer, key, file.type);
    
    console.log("✅ R2 原圖上傳成功:", publicUrl);

    return NextResponse.json({
      success: true,
      originalImageUrl: publicUrl,
      originalImageKey: key,
    });
  } catch (error) {
    console.error("❌ R2 原圖上傳失敗：", error);
    return NextResponse.json(
      {
        success: false,
        message: "原圖上傳失敗",
        error: error.message,
      },
      { status: 500 }
    );
  }
}

