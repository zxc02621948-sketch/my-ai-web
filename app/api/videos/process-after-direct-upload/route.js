import { NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/auth/getCurrentUserFromRequest";
import { generateR2Key, R2_PUBLIC_URL, uploadToR2 } from "@/lib/r2";
import { dbConnect } from "@/lib/db";
import Video from "@/models/Video";
import User from "@/models/User";
import os from "os";
import path from "path";
import fs from "fs/promises";
import { spawn } from "child_process";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// ✅ 從 URL 下載視頻並生成縮圖（重用 upload-r2-direct 的邏輯）
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
    const { default: ffmpegInstaller } = await import("@ffmpeg-installer/ffmpeg");
    cachedFfmpegPath = ffmpegInstaller.path;
    return cachedFfmpegPath;
  } catch (err) {
    console.error("無法載入 @ffmpeg-installer/ffmpeg，嘗試使用系統 ffmpeg");
    cachedFfmpegPath = "ffmpeg";
    return cachedFfmpegPath;
  }
}

/**
 * Step 2: 處理直傳後的縮圖生成和數據庫寫入
 * POST /api/videos/process-after-direct-upload
 * 
 * 接收：{ videoKey, videoUrl, metadata }
 * 處理：生成縮圖、寫入數據庫
 */
export async function POST(request) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { videoKey, videoUrl, metadata } = await request.json();

    if (!videoKey || !videoUrl) {
      return NextResponse.json(
        { error: "Missing videoKey or videoUrl" },
        { status: 400 }
      );
    }

    await dbConnect();

    // ✅ 檢查每日上傳限制（與 upload-r2-direct 一致的邏輯）
    const today = new Date().toDateString();
    const lastUploadDate = user.lastVideoUploadDate?.toDateString();

    if (lastUploadDate !== today) {
      user.dailyVideoUploads = 0;
    }

    const hasVIP = user.subscriptions?.some(
      sub => sub.isActive && sub.type === 'premiumFeatures' && sub.expiresAt > new Date()
    );
    
    const userPoints = user.totalEarnedPoints || 0;
    let levelIndex = 0;
    const levelThresholds = [0, 150, 500, 1000, 2000, 3500, 5000, 7000, 9000, 10000];
    for (let i = 0; i < levelThresholds.length; i++) {
      if (userPoints >= levelThresholds[i]) levelIndex = i;
    }
    
    const baseDailyLimit = 5 + levelIndex;
    const dailyLimit = hasVIP ? 50 : baseDailyLimit;

    if (user.dailyVideoUploads >= dailyLimit) {
      return NextResponse.json({ 
        error: `今日上傳已達上限（${dailyLimit}部）`,
        dailyLimit,
        currentCount: user.dailyVideoUploads,
      }, { status: 429 });
    }

    // ✅ 產生縮圖
    let thumbnailUrl = "";
    const thumbnailKey = generateR2Key(user._id.toString(), "videos/thumbnails", "thumbnail.jpg");
    try {
      console.log("[VideoUpload] 從 R2 URL 生成縮圖:", videoUrl);
      thumbnailUrl = await generateThumbnailFromStreamUrl(videoUrl, thumbnailKey);
      console.log("[VideoUpload] 縮圖生成成功:", thumbnailUrl);
    } catch (err) {
      console.error("影片縮圖產生失敗，改用預設縮圖:", err);
      try {
        // 嘗試使用 fallback key
        const fallbackKey = generateR2Key(user._id.toString(), "videos/thumbnails", "thumbnail-fallback.jpg");
        thumbnailUrl = await generateThumbnailFromStreamUrl(videoUrl, fallbackKey);
        console.log("[VideoUpload] Fallback 縮圖生成成功:", thumbnailUrl);
      } catch (fallbackErr) {
        console.error("影片縮圖備援失敗，改用預設縮圖:", fallbackErr);
        thumbnailUrl = `${R2_PUBLIC_URL}/videos/thumbnails/default-placeholder.jpg`;
      }
    }

    // ✅ 寫入資料庫並計算分數
    const { computeVideoCompleteness, computeVideoPopScore } = await import('@/utils/scoreVideo');
    
    const completenessScore = computeVideoCompleteness(metadata);
    
    // ✅ 處理 tags
    let processedTags = [];
    if (metadata.tags) {
      if (typeof metadata.tags === 'string') {
        processedTags = metadata.tags.split(/[,，\s]+/).map(t => t.trim()).filter(Boolean);
      } else if (Array.isArray(metadata.tags)) {
        processedTags = metadata.tags.map(t => typeof t === 'string' ? t.trim() : String(t).trim()).filter(Boolean);
      }
    }
    
    const video = await Video.create({
      title: metadata.title,
      description: metadata.description,
      category: metadata.categories && metadata.categories.length > 0 ? metadata.categories[0] : (metadata.category || ""),
      categories: metadata.categories || [],
      rating: metadata.rating,
      tags: processedTags,
      videoUrl: videoUrl,
      videoKey: videoKey,
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
      authorAvatar: user.image || '',
      completenessScore,
      popScore: 0,
      isHighQuality: completenessScore >= 80,
    });

    const popScore = await computeVideoPopScore(video._id);
    video.popScore = popScore;
    await video.save();

    // ✅ 更新用戶每日上傳計數
    const userDoc = await User.findById(user._id);
    let currentUploadCount = user.dailyVideoUploads || 0;
    
    if (userDoc) {
      const uploadToday = new Date().toDateString();
      const lastUploadDate = userDoc.lastVideoUploadDate?.toDateString();
      
      if (lastUploadDate !== uploadToday) {
        userDoc.dailyVideoUploads = 0;
        currentUploadCount = 0;
      }
      
      userDoc.dailyVideoUploads = (userDoc.dailyVideoUploads || 0) + 1;
      currentUploadCount = userDoc.dailyVideoUploads;
      userDoc.lastVideoUploadDate = new Date();
      await userDoc.save();
    }

    // ✅ 計算今日上傳數量
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const tomorrow = new Date(todayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayUploads = await Video.countDocuments({
      author: user._id,
      createdAt: { $gte: todayStart, $lt: tomorrow }
    });

    const remaining = Math.max(0, dailyLimit - todayUploads);

    // ✅ 積分系統（與 upload-r2-direct 一致）
    try {
      const { creditPoints } = await import('@/services/pointsService');
      await creditPoints({ 
        userId: user._id.toString(), 
        type: "video_upload", 
        sourceId: video._id, 
        actorUserId: user._id.toString(), 
        meta: { videoId: video._id } 
      });
    } catch (e) {
      console.warn("[points] 影片上傳入帳失敗：", e);
    }

    return NextResponse.json({
      success: true,
      video: {
        _id: video._id,
        title: video.title,
        videoUrl: video.videoUrl,
        thumbnailUrl: video.thumbnailUrl,
        completenessScore: video.completenessScore,
        popScore: video.popScore,
      },
      videoUrl: videoUrl,
      videoKey: videoKey,
      completenessScore,
      dailyUploads: {
        current: todayUploads,
        limit: dailyLimit,
        remaining: remaining
      }
    });
  } catch (error) {
    console.error("Process after direct upload error:", error);
    return NextResponse.json(
      { error: "Process failed", details: error.message },
      { status: 500 }
    );
  }
}

