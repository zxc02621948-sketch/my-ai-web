// app/api/current-user/route.js
import { dbConnect } from "@/lib/db";
import { getCurrentUserFromRequest } from "@/lib/serverAuth";
import User from "@/models/User";
import { NextResponse } from "next/server";

export async function GET(req) {
  await dbConnect();
  const currentUser = await getCurrentUserFromRequest(req).catch(() => null);
  const userId = currentUser?._id || null;
  const emailFromOAuth = currentUser?.email || null;

  if (!userId && !emailFromOAuth) {
    return NextResponse.json(null, { status: 200 });
  }

  // 使用原生查詢避免 Mongoose 緩存問題
  const mongoose = await import('mongoose');
  const db = mongoose.default.connection.db;
  const usersCollection = db.collection('users');
  
  let userRaw = null;
  if (userId) {
    userRaw = await usersCollection.findOne(
      { _id: new mongoose.default.Types.ObjectId(userId) },
      { projection: { password: 0 } } // 排除 password 字段
    );
  }
  if (!userRaw && emailFromOAuth) {
    userRaw = await usersCollection.findOne(
      { email: emailFromOAuth },
      { projection: { password: 0 } }
    );
  }
  
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
        // ✅ 確保 expiresAt 是 ISO 字符串格式
        expiresAt: user.pinnedPlayer.expiresAt 
          ? (user.pinnedPlayer.expiresAt instanceof Date 
              ? user.pinnedPlayer.expiresAt.toISOString() 
              : user.pinnedPlayer.expiresAt)
          : null,
        currentIndex: user.pinnedPlayer.currentIndex || 0,
        isPlaying: user.pinnedPlayer.isPlaying || false,
        allowShuffle:
          typeof user.pinnedPlayer.allowShuffle === "boolean"
            ? user.pinnedPlayer.allowShuffle
            : null,
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
      playlistAllowShuffle:
        typeof user.playlistAllowShuffle === "boolean"
          ? user.playlistAllowShuffle
          : null,
      // ✅ 添加隱私設定字段
      privacyPreferences: user.privacyPreferences || {
        allowMarketingEmails: true,
        allowDataAnalytics: true,
        allowPersonalization: true,
        allowProfileIndexing: true,
      },
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
    playlistAllowShuffle:
      typeof user.playlistAllowShuffle === "boolean"
        ? user.playlistAllowShuffle
        : null,
    // ✅ 添加隱私設定字段
    privacyPreferences: user.privacyPreferences || {
      allowMarketingEmails: true,
      allowDataAnalytics: true,
      allowPersonalization: true,
      allowProfileIndexing: true,
    },
  });
}
