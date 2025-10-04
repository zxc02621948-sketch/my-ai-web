import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { verifyToken } from "@/lib/serverAuth";
import User from "@/models/User";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const idFromQuery = searchParams.get("id");

    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    const decoded = token ? verifyToken(token) : null;

    const rawId = idFromQuery || decoded?.id;

    let user = null;
    if (rawId && mongoose.Types.ObjectId.isValid(rawId)) {
      user = await User.findById(rawId);
    } else if (idFromQuery) {
      // 當路由使用 username 時，允許以 username 取得
      user = await User.findOne({ username: idFromQuery });
    } else if (decoded?.id && mongoose.Types.ObjectId.isValid(decoded.id)) {
      user = await User.findById(decoded.id);
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
      // ✅ 播放器：使用者預設音樂 URL
      defaultMusicUrl: user.defaultMusicUrl || '',
      // ✅ 迷你播放器：購買與樣式
      miniPlayerPurchased: !!user.miniPlayerPurchased,
      miniPlayerTheme: user.miniPlayerTheme || 'modern',
      // ✅ 頭像框系統
      currentFrame: user.currentFrame || 'default',
      ownedFrames: user.ownedFrames || ['default']
    }, { status: 200, headers: { "Cache-Control": "no-store" } });

  } catch (err) {
    console.error("⚠️ 取得使用者資料錯誤", err);
    return NextResponse.json({}, { status: 200, headers: { "Cache-Control": "no-store" } });
  }
}
