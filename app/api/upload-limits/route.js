import { dbConnect } from "@/lib/db";
import { NextResponse } from "next/server";
import Image from "@/models/Image";
import User from "@/models/User";
import { getDailyUploadLimit, getLevelInfo } from "@/utils/pointsLevels";
import { requireUser } from "@/utils/auth";

export const dynamic = "force-dynamic";

// GET: 獲取用戶的上傳限制信息
export async function GET(req) {
  try {
    await dbConnect();
    
    const { user, error } = await requireUser(req);
    if (error) return error;

    // 獲取用戶積分信息
    const userData = await User.findById(user._id).select('totalEarnedPoints').lean();
    if (!userData) {
      return NextResponse.json({ message: "用戶不存在" }, { status: 404 });
    }

    const totalEarnedPoints = userData.totalEarnedPoints || 0;
    const dailyLimit = getDailyUploadLimit(totalEarnedPoints);
    const levelInfo = getLevelInfo(totalEarnedPoints);

    // 計算今日已上傳數量
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayUploads = await Image.countDocuments({
      userId: user._id,
      createdAt: {
        $gte: today,
        $lt: tomorrow
      }
    });

    const remaining = Math.max(0, dailyLimit - todayUploads);
    const isLimitReached = todayUploads >= dailyLimit;

    return NextResponse.json({
      ok: true,
      dailyLimit,
      todayUploads,
      remaining,
      isLimitReached,
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
