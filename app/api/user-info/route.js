import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getCurrentUser } from "@/lib/serverAuth";
import User from "@/models/User";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const idFromQuery = searchParams.get("id");

    let user = null;
    
    // 如果有查詢參數，優先使用查詢參數
    if (idFromQuery) {
      if (mongoose.Types.ObjectId.isValid(idFromQuery)) {
        user = await User.findById(idFromQuery);
      } else {
        // 當路由使用 username 時，允許以 username 取得
        user = await User.findOne({ username: idFromQuery });
      }
    } else {
      // 否則使用當前登入用戶
      user = await getCurrentUser();
    }

    if (!user) {
      // 以 200 空物件回應，避免前端卡載入或重試風暴
      return NextResponse.json({}, { status: 200, headers: { "Cache-Control": "no-store" } });
    }


    return NextResponse.json({
      _id: user._id,
      email: user.email,
      username: user.username,
      bio: user.bio,
      image: user.image,
      isVerified: user.isVerified,
      createdAt: user.createdAt?.toISOString() ?? null,
      // ✅ 積分餘額
      pointsBalance: user.pointsBalance ?? 0,
      // ✅ 總賺取積分（用於等級計算）
      totalEarnedPoints: user.totalEarnedPoints ?? 0,
      // ✅ 播放器：使用者預設音樂 URL
      defaultMusicUrl: user.defaultMusicUrl || '',
      // ✅ 播放清單：完整播放清單
      playlist: user.playlist || [],
      // ✅ 迷你播放器：購買與樣式
      miniPlayerPurchased: !!user.miniPlayerPurchased,
      miniPlayerTheme: user.miniPlayerTheme || 'modern',
      // ✅ 頭像框系統
      currentFrame: user.currentFrame || 'default',
      ownedFrames: user.ownedFrames || ['default'],
      frameSettings: user.frameSettings || {},
      
      // ✅ 功能解鎖狀態
      frameColorEditorUnlocked: user.frameColorEditorUnlocked || false,
      // ✅ 播放器體驗券狀態
      playerCouponUsed: user.playerCouponUsed || false,
      miniPlayerExpiry: user.miniPlayerExpiry || null
    }, { status: 200, headers: { "Cache-Control": "no-store" } });

  } catch (err) {
    console.error("⚠️ 取得使用者資料錯誤", err);
    return NextResponse.json({}, { status: 200, headers: { "Cache-Control": "no-store" } });
  }
}
