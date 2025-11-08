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
      const currentUser = await getCurrentUser();
      if (currentUser && currentUser._id) {
        // 重新從數據庫查詢以確保獲取最新數據
        user = await User.findById(currentUser._id);
      }
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
      // ✅ 討論區待領取積分
      discussionPendingPoints: user.discussionPendingPoints ?? 0,
      // ✅ 播放器：使用者預設音樂 URL
      defaultMusicUrl: user.defaultMusicUrl || '',
      // ✅ 播放清單：完整播放清單
      playlist: user.playlist || [],
      // ✅ 播放清單是否允許隨機播放
      playlistAllowShuffle: !!user.playlistAllowShuffle,
      // ✅ 播放清單上限
      playlistMaxSize: user.playlistMaxSize || 5,
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
      miniPlayerExpiry: user.miniPlayerExpiry || null,
      // ✅ 高階播放器造型
      premiumPlayerSkin: user.premiumPlayerSkin || false,
      premiumPlayerSkinExpiry: user.premiumPlayerSkinExpiry || null,
      activePlayerSkin: user.activePlayerSkin || 'default',
      playerSkinSettings: user.playerSkinSettings || {
        mode: 'rgb',
        speed: 0.02,
        saturation: 50,
        lightness: 60,
        hue: 0,
        opacity: 0.7
      }
    }, { status: 200, headers: { "Cache-Control": "no-store" } });

  } catch (err) {
    console.error("⚠️ 取得使用者資料錯誤", err);
    return NextResponse.json({}, { status: 200, headers: { "Cache-Control": "no-store" } });
  }
}
