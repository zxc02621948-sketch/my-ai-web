import { dbConnect } from "@/lib/db";
import { NextResponse } from "next/server";
import Image from "@/models/Image";
import User from "@/models/User";
import { getDailyUploadLimit, getLevelInfo } from "@/utils/pointsLevels";
import { getCurrentUserFromRequest } from "@/lib/auth/getCurrentUserFromRequest";

export const dynamic = "force-dynamic";

// GET: 獲取用戶的上傳限制信息
export async function GET(req) {
  try {
    await dbConnect();
    
    // ✅ 使用 getCurrentUserFromRequest（更穩定的認證方式）
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ message: "請先登入" }, { status: 401 });
    }

    // 獲取用戶積分信息
    const userData = await User.findById(user._id).select('totalEarnedPoints').lean();
    if (!userData) {
      return NextResponse.json({ message: "用戶不存在" }, { status: 404 });
    }

    const totalEarnedPoints = userData.totalEarnedPoints || 0;
    const baseDailyLimit = getDailyUploadLimit(totalEarnedPoints); // 基礎配額（按等級計算：LV1=5, LV2=6, ...）
    const levelInfo = getLevelInfo(totalEarnedPoints);

    // ✅ 計算今日已上傳圖片數量（圖片有獨立的配額系統）
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayImageUploads = await Image.countDocuments({
      userId: user._id,
      createdAt: {
        $gte: today,
        $lt: tomorrow
      }
    });
    
    // ✅ 檢查 VIP 狀態（VIP 用戶有 20 張/天配額）
    const fullUser = await User.findById(user._id).select('subscriptions');
    const hasVIP = fullUser?.subscriptions?.some(
      sub => sub.isActive && sub.type === 'premiumFeatures' && sub.expiresAt > new Date()
    );
    const finalDailyLimit = hasVIP ? 20 : baseDailyLimit;
    
    const todayUploads = todayImageUploads;

    const remaining = Math.max(0, finalDailyLimit - todayUploads);
    const isLimitReached = todayUploads >= finalDailyLimit;

    return NextResponse.json({
      ok: true,
      dailyLimit: finalDailyLimit, // 返回最終配額（包含VIP加成）
      baseDailyLimit, // 基礎配額（等級配額）
      todayUploads,
      remaining,
      isLimitReached,
      isVIP: hasVIP,
      levelInfo: {
        rank: levelInfo.rank,
        title: levelInfo.title,
        display: levelInfo.display,
        color: levelInfo.color
      },
      totalEarnedPoints
    });

  } catch (error) {
    console.error("獲取上傳限制錯誤：", error);
    return NextResponse.json({ message: "服務器錯誤" }, { status: 500 });
  }
}
