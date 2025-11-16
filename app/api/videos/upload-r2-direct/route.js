import { NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/auth/getCurrentUserFromRequest";
import { generateR2Key, R2_PUBLIC_URL, uploadToR2 } from "@/lib/r2";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { dbConnect } from "@/lib/db";
import Video from "@/models/Video";
import os from "os";
import path from "path";
import fs from "fs/promises";
import { spawn } from "child_process";

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
    const videoBuffer = Buffer.from(arrayBuffer);

    console.log("📦 準備上傳至 R2:", "size:", file.size, "key:", key);
    
    try {
      console.log("🚀 使用 AWS SDK S3 簽章上傳到 R2...");

      // ✅ 使用 AWS SDK S3 簽章上傳
      const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: videoBuffer,
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

    // ✅ 產生縮圖
    let thumbnailUrl = "";
    const thumbnailKey = generateR2Key(user._id.toString(), "videos/thumbnails", "thumbnail.jpg");
    try {
      console.log("[VideoUpload] 產生縮圖: bufferSize", videoBuffer.length, "bytes");
      console.time("[VideoUpload] Generate Thumbnail");
      thumbnailUrl = await generateThumbnailFromBuffer(videoBuffer, thumbnailKey);
      console.timeEnd("[VideoUpload] Generate Thumbnail");
      console.log("[VideoUpload] 縮圖已上傳:", thumbnailUrl);
    } catch (err) {
      console.error("影片縮圖產生失敗，改用影片第一幀:", err);
      try {
        const fallbackKey = generateR2Key(user._id.toString(), "videos/thumbnails", "thumbnail-fallback.jpg");
        console.log("[VideoUpload] 使用影片 URL 產生縮圖:", publicUrl);
        thumbnailUrl = await generateThumbnailFromStreamUrl(publicUrl, fallbackKey);
        console.log("[VideoUpload] 使用影片 URL 產生縮圖成功:", thumbnailUrl);
      } catch (fallbackErr) {
        console.error("影片縮圖備援失敗，改用預設縮圖:", fallbackErr);
        thumbnailUrl = `${R2_PUBLIC_URL}/videos/thumbnails/default-placeholder.jpg`;
      }
    }

    // ✅ 確保資料庫連線
    await dbConnect();

    // ✅ 寫入資料庫並計算分數
    const { computeVideoCompleteness, computeVideoPopScore } = await import('@/utils/scoreVideo');
    
    // 計算完整度分數
    const completenessScore = computeVideoCompleteness(metadata);
    
    // ✅ 處理 tags：如果是字符串，則分割成數組（支援逗號、中文逗號和空格分隔）
    let processedTags = [];
    if (metadata.tags) {
      if (typeof metadata.tags === 'string') {
        // ✅ 支援逗號、中文逗號和空格分隔（與編輯功能一致）
        processedTags = metadata.tags.split(/[,，\s]+/).map(t => t.trim()).filter(Boolean);
      } else if (Array.isArray(metadata.tags)) {
        // ✅ 如果已經是數組，直接使用
        processedTags = metadata.tags.map(t => typeof t === 'string' ? t.trim() : String(t).trim()).filter(Boolean);
      }
    }
    
    // 建立影片記錄
    const video = await Video.create({
      title: metadata.title,
      description: metadata.description,
      category: metadata.categories && metadata.categories.length > 0 ? metadata.categories[0] : (metadata.category || ""), // 保持向後兼容
      categories: metadata.categories || [],
      rating: metadata.rating,
      tags: processedTags,
      videoUrl: publicUrl,
      videoKey: key,
      thumbnailUrl,
      platform: metadata.platform,
      prompt: metadata.prompt,
      negativePrompt: metadata.negativePrompt,
      fps: metadata.fps,
      resolution: metadata.resolution,
      aspectRatio: metadata.aspectRatio || '',
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
        thumbnailUrl: video.thumbnailUrl,
      },
      videoUrl: publicUrl,
      videoKey: key,
      thumbnailUrl,
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

async function generateThumbnailFromBuffer(videoBuffer, key) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "video-thumb-"));
  const inputPath = path.join(tmpDir, "source");
  const outputPath = path.join(tmpDir, "thumb.jpg");
  const ffmpegPath = await resolveFfmpegPath();

  try {
    await fs.writeFile(inputPath, videoBuffer);

    await new Promise((resolve, reject) => {
      const ff = spawn(ffmpegPath, [
        "-y",
        "-ss",
        "0.5",
        "-i",
        inputPath,
        "-frames:v",
        "1",
        "-vf",
        "scale=1280:-1:flags=lanczos",
        outputPath,
      ]);

      ff.once("error", reject);
      ff.stderr?.on("data", (chunk) => {
        console.log("[VideoUpload][ffmpeg]", chunk.toString());
      });
      ff.once("exit", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`ffmpeg 產生縮圖失敗，退出碼 ${code}`));
        }
      });
    });

    const stats = await fs.stat(outputPath).catch(() => null);
    if (!stats || stats.size === 0) {
      throw new Error("產生的縮圖檔案為空");
    }

    const buffer = await fs.readFile(outputPath);
    const url = await uploadToR2(buffer, key, "image/jpeg");
    return url || `${R2_PUBLIC_URL}/${key}`;
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function generateThumbnailFromStreamUrl(videoUrl, key) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "video-thumb-remote-"));
  const inputPath = path.join(tmpDir, "source");
  const outputPath = path.join(tmpDir, "thumb.jpg");
  const ffmpegPath = await resolveFfmpegPath();

  try {
    console.log("[VideoUpload] 下載影片以產生縮圖，URL:", videoUrl);
    const res = await fetch(videoUrl);
    if (!res.ok) {
      throw new Error(`下載影片失敗: ${res.status}`);
    }
    const remoteBuffer = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(inputPath, remoteBuffer);

    await new Promise((resolve, reject) => {
      const ff = spawn(ffmpegPath, [
        "-y",
        "-ss",
        "0.5",
        "-i",
        inputPath,
        "-frames:v",
        "1",
        "-vf",
        "scale=1280:-1:flags=lanczos",
        outputPath,
      ]);

      ff.stderr?.on("data", (chunk) => {
        console.log("[VideoUpload][ffmpeg][remote]", chunk.toString());
      });

      ff.once("error", reject);
      ff.once("exit", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`ffmpeg (remote) 產生縮圖失敗，退出碼 ${code}`));
        }
      });
    });

    const stats = await fs.stat(outputPath).catch(() => null);
    if (!stats || stats.size === 0) {
      throw new Error("產生的縮圖檔案為空 (remote)");
    }

    const buffer = await fs.readFile(outputPath);
    const url = await uploadToR2(buffer, key, "image/jpeg");
    return url || `${R2_PUBLIC_URL}/${key}`;
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

let cachedFfmpegPath = null;
async function resolveFfmpegPath() {
  if (cachedFfmpegPath) return cachedFfmpegPath;

  if (process.env.FFMPEG_PATH) {
    cachedFfmpegPath = process.env.FFMPEG_PATH;
    return cachedFfmpegPath;
  }

  try {
    const ffmpegInstaller = await import("@ffmpeg-installer/ffmpeg");
    const installerPath = ffmpegInstaller?.default?.path || ffmpegInstaller?.path;
    if (installerPath) {
      cachedFfmpegPath = installerPath;
      return cachedFfmpegPath;
    }
    throw new Error("ffmpeg path not found in installer package");
  } catch (error) {
    console.warn("[VideoUpload] 無法載入 @ffmpeg-installer/ffmpeg，改用系統 ffmpeg:", error?.message);
    cachedFfmpegPath = "ffmpeg";
    return cachedFfmpegPath;
  }
}
