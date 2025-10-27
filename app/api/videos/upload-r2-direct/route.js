import { NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/auth/getCurrentUserFromRequest";
import { generateR2Key, R2_PUBLIC_URL } from "@/lib/r2";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { dbConnect } from "@/lib/db";
import Video from "@/models/Video";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// ✅ 使用 AWS SDK S3 簽章上傳
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_ENDPOINT = process.env.R2_ENDPOINT;

// 初始化 S3 客戶端
const s3Client = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

export async function POST(request) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ✅ 直接處理檔案上傳（使用 R2 API Token）
    const formData = await request.formData();
    const file = formData.get('file');
    const metadata = JSON.parse(formData.get('metadata') || '{}');

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // ✅ 生成檔案路徑
    const key = generateR2Key(user._id.toString(), "videos", file.name);
    
    // ✅ 關鍵修正：將 File 轉換為 Buffer
    const arrayBuffer = await file.arrayBuffer();
    
    console.log("📦 準備上傳至 R2:", "size:", file.size, "key:", key);
    
    try {
      console.log("🚀 使用 AWS SDK S3 簽章上傳到 R2...");

      // ✅ 使用 AWS SDK S3 簽章上傳
      const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: Buffer.from(arrayBuffer),
        ContentType: file.type,
        // R2 不支援 S3 ACL，需要在 Bucket 層級設定公開存取
      });

      const result = await s3Client.send(command);
      console.log("✅ R2 上傳成功:", result);
    } catch (err) {
      console.error("❌ R2 上傳失敗:", err);
      throw new Error(`R2 upload failed: ${err.message}`);
    }

    const publicUrl = `${R2_PUBLIC_URL}/${key}`;

    console.log('✅ R2 AWS SDK upload successful:', {
      key,
      fileType: file.type,
      fileSize: file.size,
      publicUrl,
    });

    // ✅ 確保資料庫連線
    await dbConnect();

    // ✅ 寫入資料庫並計算分數
    const { computeVideoCompleteness, computeVideoPopScore } = await import('@/utils/scoreVideo');
    
    // 計算完整度分數
    const completenessScore = computeVideoCompleteness(metadata);
    
    // 建立影片記錄
    const video = await Video.create({
      title: metadata.title,
      description: metadata.description,
      category: metadata.category,
      rating: metadata.rating,
      tags: metadata.tags || [],
      videoUrl: publicUrl,
      videoKey: key,
      platform: metadata.platform,
      prompt: metadata.prompt,
      negativePrompt: metadata.negativePrompt,
      fps: metadata.fps,
      resolution: metadata.resolution,
      steps: metadata.steps,
      cfgScale: metadata.cfgScale,
      seed: metadata.seed,
      width: metadata.width,
      height: metadata.height,
      duration: metadata.duration,
      author: user._id,
      authorName: user.username || user.email,
      authorAvatar: user.avatar || '',
      completenessScore,
      popScore: 0, // 初始流行度分數
      isHighQuality: completenessScore >= 80,
    });

    // 計算流行度分數
    const popScore = await computeVideoPopScore(video._id);
    video.popScore = popScore;
    await video.save();

    // 檢查每日上傳配額
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayUploads = await Video.countDocuments({
      uploader: user._id,
      createdAt: { $gte: today, $lt: tomorrow }
    });

    const dailyLimit = 10; // 每日上傳限制
    const remaining = Math.max(0, dailyLimit - todayUploads);

    // ✅ 返回完整的上傳結果
    return NextResponse.json({
      success: true,
      video: {
        _id: video._id,
        title: video.title,
        videoUrl: video.videoUrl,
        completenessScore: video.completenessScore,
        popScore: video.popScore,
      },
      videoUrl: publicUrl,
      videoKey: key,
      completenessScore,
      dailyUploads: {
        current: todayUploads,
        limit: dailyLimit,
        remaining: remaining
      }
    });
  } catch (error) {
    console.error("R2 API Token upload error:", error);
    return NextResponse.json(
      { error: "Upload failed", details: error.message },
      { status: 500 }
    );
  }
}
