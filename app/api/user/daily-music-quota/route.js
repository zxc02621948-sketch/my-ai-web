export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/auth/getCurrentUserFromRequest";
import { dbConnect } from "@/lib/db";
import Music from "@/models/Music";
import User from "@/models/User";
import { getDailyUploadLimit } from "@/utils/pointsLevels";

const noStore = { headers: { "Cache-Control": "no-store" } };

export async function GET(req) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: "未登入" },
        { status: 401, ...noStore }
      );
    }

    await dbConnect();

    // ✅ 計算每日上傳限制（與圖片一致的等級制）
    const hasVIP = user.subscriptions?.some(
      sub => sub.isActive && sub.type === 'premiumFeatures' && sub.expiresAt > new Date()
    );
    
    // 使用與圖片相同的等級制計算
    const userPoints = user.totalEarnedPoints || 0;
    const baseDailyLimit = getDailyUploadLimit(userPoints); // LV1=5, LV2=6, ..., LV10=14
    const dailyLimit = hasVIP ? 20 : baseDailyLimit;

    // ✅ 計算今日已上傳音樂數量（音樂有獨立的配額）
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayMusicUploads = await Music.countDocuments({
      author: user._id,
      createdAt: {
        $gte: today,
        $lt: tomorrow
      }
    });

    return NextResponse.json({
      success: true,
      current: todayMusicUploads,
      limit: dailyLimit,
      remaining: Math.max(0, dailyLimit - todayMusicUploads),
      isLimitReached: todayMusicUploads >= dailyLimit,
      isVIP: hasVIP,
      resetInfo: '每日 00:00 重置'
    }, { status: 200, ...noStore });

  } catch (error) {
    console.error("[daily-music-quota] Error:", error);
    return NextResponse.json(
      { error: "伺服器錯誤" },
      { status: 500, ...noStore }
    );
  }
}

