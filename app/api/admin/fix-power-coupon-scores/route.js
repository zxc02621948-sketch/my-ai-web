// app/api/admin/fix-power-coupon-scores/route.js
// 修復已使用權力券但分數計算不正確的內容（圖片、影片、音樂）

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/serverAuth";
import { dbConnect } from "@/lib/db";
import Image from "@/models/Image";
import Video from "@/models/Video";
import Music from "@/models/Music";
import { computePopScore } from "@/utils/score";
import { computeVideoPopScore } from "@/utils/scoreVideo";
import { computeMusicPopScore } from "@/utils/scoreMusic";

export async function POST(req) {
  try {
    // 檢查是否登入（不需要管理員權限，可以修復所有內容）
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, message: "請先登入" },
        { status: 401 }
      );
    }

    await dbConnect();

    const now = new Date();
    const results = {
      images: { total: 0, fixed: 0, details: [] },
      videos: { total: 0, fixed: 0, details: [] },
      music: { total: 0, fixed: 0, details: [] }
    };

    // ===== 修復圖片 =====
    const powerImages = await Image.find({
      powerUsed: true,
      powerUsedAt: { $exists: true, $ne: null }
    }).lean();

    results.images.total = powerImages.length;

    for (const image of powerImages) {
      // 檢查是否過期
      const isExpired = image.powerExpiry && new Date(image.powerExpiry) < now;
      
      // 使用修復後的函數重新計算分數
      const newPopScore = computePopScore(image);
      const oldPopScore = image.popScore || 0;
      
      const difference = Math.abs(newPopScore - oldPopScore);
      
      // 如果分數差異超過 0.1，則更新
      if (difference > 0.1 || isExpired) {
        await Image.updateOne(
          { _id: image._id },
          { $set: { popScore: newPopScore } }
        );
        
        results.images.fixed++;
        results.images.details.push({
          id: image._id.toString(),
          title: image.title || '(無標題)',
          oldScore: oldPopScore.toFixed(2),
          newScore: newPopScore.toFixed(2),
          difference: difference > 0.1 ? difference.toFixed(2) : 0,
          isExpired,
          powerUsedAt: image.powerUsedAt,
          powerExpiry: image.powerExpiry
        });
      }
    }

    // ===== 修復影片 =====
    const powerVideos = await Video.find({
      powerUsed: true,
      powerUsedAt: { $exists: true, $ne: null }
    }).lean();

    results.videos.total = powerVideos.length;

    for (const video of powerVideos) {
      // 檢查是否過期
      const isExpired = video.powerExpiry && new Date(video.powerExpiry) < now;
      
      // 使用修復後的函數重新計算分數
      const newPopScore = computeVideoPopScore(video);
      const oldPopScore = video.popScore || 0;
      
      const difference = Math.abs(newPopScore - oldPopScore);
      
      // 如果分數差異超過 0.1，則更新
      if (difference > 0.1 || isExpired) {
        await Video.updateOne(
          { _id: video._id },
          { $set: { popScore: newPopScore } }
        );
        
        results.videos.fixed++;
        results.videos.details.push({
          id: video._id.toString(),
          title: video.title || '(無標題)',
          oldScore: oldPopScore.toFixed(2),
          newScore: newPopScore.toFixed(2),
          difference: difference > 0.1 ? difference.toFixed(2) : 0,
          isExpired,
          powerUsedAt: video.powerUsedAt,
          powerExpiry: video.powerExpiry
        });
      }
    }

    // ===== 修復音樂 =====
    const powerMusic = await Music.find({
      powerUsed: true,
      powerUsedAt: { $exists: true, $ne: null }
    }).lean();

    results.music.total = powerMusic.length;

    for (const music of powerMusic) {
      // 檢查是否過期
      const isExpired = music.powerExpiry && new Date(music.powerExpiry) < now;
      
      // 使用修復後的函數重新計算分數
      const newPopScore = computeMusicPopScore(music);
      const oldPopScore = music.popScore || 0;
      
      const difference = Math.abs(newPopScore - oldPopScore);
      
      // 如果分數差異超過 0.1，則更新
      if (difference > 0.1 || isExpired) {
        await Music.updateOne(
          { _id: music._id },
          { $set: { popScore: newPopScore } }
        );
        
        results.music.fixed++;
        results.music.details.push({
          id: music._id.toString(),
          title: music.title || '(無標題)',
          oldScore: oldPopScore.toFixed(2),
          newScore: newPopScore.toFixed(2),
          difference: difference > 0.1 ? difference.toFixed(2) : 0,
          isExpired,
          powerUsedAt: music.powerUsedAt,
          powerExpiry: music.powerExpiry
        });
      }
    }

    const totalFixed = results.images.fixed + results.videos.fixed + results.music.fixed;

    return NextResponse.json({
      success: true,
      message: `修復完成！共修復 ${totalFixed} 個內容`,
      results
    });

  } catch (error) {
    console.error("修復權力券分數錯誤:", error);
    return NextResponse.json(
      { 
        success: false, 
        message: "伺服器錯誤",
        error: error.message 
      },
      { status: 500 }
    );
  }
}
