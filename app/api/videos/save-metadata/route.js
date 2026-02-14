import { NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/serverAuth";
import { dbConnect } from "@/lib/db";
import Video from "@/models/Video";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAllowedVideoUrl(videoUrl) {
  try {
    const url = new URL(String(videoUrl || ""));
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return (
      host === "media.aicreateaworld.com" ||
      host.endsWith(".r2.cloudflarestorage.com") ||
      host.endsWith(".cloudflarestream.com")
    );
  } catch {
    return false;
  }
}

export async function POST(request) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { videoUrl, videoKey, metadata } = await request.json();

    if (!videoUrl || !videoKey) {
      return NextResponse.json(
        { error: "Missing videoUrl or videoKey" },
        { status: 400 }
      );
    }
    if (!isAllowedVideoUrl(videoUrl)) {
      return NextResponse.json(
        { error: "Invalid video URL" },
        { status: 400 }
      );
    }

    // ✅ 確保資料庫連線
    await dbConnect();

    // ✅ 計算分數
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
      videoUrl: videoUrl,
      videoKey: videoKey,
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
      authorAvatar: user.image || '',
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
      author: user._id,
      createdAt: { $gte: today, $lt: tomorrow }
    });

    const dailyLimit = 10; // 每日上傳限制
    const remaining = Math.max(0, dailyLimit - todayUploads);

    // ✅ 返回完整的結果
    return NextResponse.json({
      success: true,
      video: {
        _id: video._id,
        title: video.title,
        videoUrl: video.videoUrl,
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
    console.error("Save metadata error:", error);
    return NextResponse.json(
      { error: "Save metadata failed", details: error.message },
      { status: 500 }
    );
  }
}
