// app/api/current-user/route.js
import { dbConnect } from "@/lib/db";
import { verifyJWT } from "@/lib/jwt";
import User from "@/models/User";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  await dbConnect();

  const headersList = await headers();
  const cookieHeader = headersList.get("cookie") || "";
  const authHeader = headersList.get("authorization") || headersList.get("Authorization") || "";
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const token = bearerToken || cookieHeader
    .split(";")
    .find((c) => c.trim().startsWith("token="))
    ?.split("=")[1];

  if (!token) {
    return NextResponse.json(null, { status: 200 });
  }

  const decoded = verifyJWT(token);
  if (!decoded) {
    return NextResponse.json(null, { status: 200 });
  }

  const userId = decoded.id || decoded._id; // 支援 id 與 _id
  if (!userId) {
    return NextResponse.json(null, { status: 200 });
  }

  // 使用原生查詢避免 Mongoose 緩存問題
  const mongoose = await import('mongoose');
  const db = mongoose.default.connection.db;
  const usersCollection = db.collection('users');
  
  const userRaw = await usersCollection.findOne(
    { _id: new mongoose.default.Types.ObjectId(userId) },
    { projection: { password: 0 } } // 排除 password 字段
  );
  
  if (!userRaw) {
    return NextResponse.json(null, { status: 200 });
  }
  
  const user = userRaw;


      // 處理 pinnedPlayer，確保所有字段都正確返回
      const pinnedPlayerData = user.pinnedPlayer ? {
        userId: user.pinnedPlayer.userId,
        username: user.pinnedPlayer.username,
        playlist: user.pinnedPlayer.playlist || [],
        pinnedAt: user.pinnedPlayer.pinnedAt,
        expiresAt: user.pinnedPlayer.expiresAt,
        currentIndex: user.pinnedPlayer.currentIndex || 0,
        isPlaying: user.pinnedPlayer.isPlaying || false,
        allowShuffle: !!user.pinnedPlayer.allowShuffle,
      } : null;

      return NextResponse.json({
    user: {
      _id: user._id,
      email: user.email,
      username: user.username,
      image: user.image,
      isVerified: user.isVerified,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt?.toISOString() ?? null,
      following: user.following ?? [],
      pointsBalance: user.pointsBalance ?? 0,
      totalEarnedPoints: user.totalEarnedPoints ?? 0,
      discussionPendingPoints: user.discussionPendingPoints ?? 0,
      defaultMusicUrl: user.defaultMusicUrl || "",
      ownedFrames: user.ownedFrames || ['default'],
      currentFrame: user.currentFrame || 'default',
      pinnedPlayer: pinnedPlayerData,
      pinnedPlayerSettings: user.pinnedPlayerSettings || { showReminder: true },
      miniPlayerPurchased: user.miniPlayerPurchased || false,
      playerCouponUsed: user.playerCouponUsed || false,
      miniPlayerExpiry: user.miniPlayerExpiry || null,
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
      },
      playlistAllowShuffle: !!user.playlistAllowShuffle,
    },
    // 兼容舊代碼（直接在根層級）
    _id: user._id,
    email: user.email,
    username: user.username,
    image: user.image,
    isVerified: user.isVerified,
    isAdmin: user.isAdmin,
    role: user.role || (user.isAdmin ? 'admin' : 'user'),
    createdAt: user.createdAt?.toISOString() ?? null,
    following: user.following ?? [],
    pointsBalance: user.pointsBalance ?? 0,
    totalEarnedPoints: user.totalEarnedPoints ?? 0,
    discussionPendingPoints: user.discussionPendingPoints ?? 0,
    defaultMusicUrl: user.defaultMusicUrl || "",
    ownedFrames: user.ownedFrames || ['default'],
    currentFrame: user.currentFrame || 'default',
    pinnedPlayer: pinnedPlayerData,
    pinnedPlayerSettings: user.pinnedPlayerSettings || { showReminder: true },
    miniPlayerPurchased: user.miniPlayerPurchased || false,
    playerCouponUsed: user.playerCouponUsed || false,
    miniPlayerExpiry: user.miniPlayerExpiry || null,
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
    },
    playlistAllowShuffle: !!user.playlistAllowShuffle,
  });
}
