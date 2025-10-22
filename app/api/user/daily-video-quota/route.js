export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/auth/getCurrentUserFromRequest";
import { dbConnect } from "@/lib/db";

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

    // 檢查是否為新的一天
    const today = new Date().toDateString();
    const lastUploadDate = user.lastVideoUploadDate?.toDateString();

    let currentCount = user.dailyVideoUploads || 0;
    
    // 如果是新的一天，重置為 0
    if (lastUploadDate !== today) {
      currentCount = 0;
    }

    // 計算每日上傳限制（與圖片一致的等級制）
    const hasVIP = user.subscriptions?.some(
      sub => sub.isActive && sub.type === 'premiumFeatures' && sub.expiresAt > new Date()
    );
    
    // 使用與圖片相同的等級制計算
    const userPoints = user.totalEarnedPoints || 0;
    let levelIndex = 0;
    const levelThresholds = [0, 150, 500, 1000, 2000, 3500, 5000, 7000, 9000, 10000];
    for (let i = 0; i < levelThresholds.length; i++) {
      if (userPoints >= levelThresholds[i]) levelIndex = i;
    }
    
    const baseDailyLimit = 5 + levelIndex; // LV1=5, LV2=6, ..., LV10=14
    const dailyLimit = hasVIP ? 20 : baseDailyLimit;

    return NextResponse.json({
      success: true,
      current: currentCount,
      limit: dailyLimit,
      remaining: Math.max(0, dailyLimit - currentCount),
      isVIP: hasVIP,
      resetInfo: '每日 00:00 重置'
    }, { status: 200, ...noStore });

  } catch (error) {
    console.error("[daily-video-quota] Error:", error);
    return NextResponse.json(
      { error: "伺服器錯誤" },
      { status: 500, ...noStore }
    );
  }
}

