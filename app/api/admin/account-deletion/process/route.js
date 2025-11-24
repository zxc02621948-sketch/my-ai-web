// app/api/admin/account-deletion/process/route.js
// 立即執行帳號刪除（管理員專用，用於測試）

import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import User from "@/models/User";
import Image from "@/models/Image";
import Video from "@/models/Video";
import Music from "@/models/Music";
import Comment from "@/models/Comment";
import LikeLog from "@/models/LikeLog";
import PointsTransaction from "@/models/PointsTransaction";
import VisitorLog from "@/models/VisitorLog";
import AdVisitorLog from "@/models/AdVisitorLog";
import DiscussionPost from "@/models/DiscussionPost";

export async function POST(req) {
  try {
    // 驗證管理員權限
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, message: "請先登入" },
        { status: 401 }
      );
    }

    await dbConnect();

    const jwt = require("jsonwebtoken");
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return NextResponse.json(
        { success: false, message: "無效的登入狀態" },
        { status: 401 }
      );
    }

    const admin = await User.findById(decoded.id);
    if (!admin || !admin.isAdmin) {
      return NextResponse.json(
        { success: false, message: "權限不足" },
        { status: 403 }
      );
    }

    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json(
        { success: false, message: "缺少用戶ID" },
        { status: 400 }
      );
    }

    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json(
        { success: false, message: "找不到用戶" },
        { status: 404 }
      );
    }

    // 執行刪除流程（與定時任務相同的邏輯）
    const userIdObj = user._id;

    // 1. 刪除用戶的所有作品
    const deletedImages = await Image.deleteMany({ userId: userIdObj });
    const deletedVideos = await Video.deleteMany({ userId: userIdObj });
    const deletedMusic = await Music.deleteMany({ userId: userIdObj });

    // 2. 刪除用戶的所有評論
    const deletedComments = await Comment.deleteMany({ userId: userIdObj });

    // 3. 刪除用戶的所有點讚記錄
    const deletedLikes = await LikeLog.deleteMany({ userId: userIdObj });

    // 4. 刪除用戶的所有積分交易記錄
    const deletedTransactions = await PointsTransaction.deleteMany({
      userId: userIdObj,
    });

    // 5. 刪除用戶的訪問記錄
    const deletedVisitorLogs = await VisitorLog.deleteMany({
      userId: userIdObj,
    });
    const deletedAdVisitorLogs = await AdVisitorLog.deleteMany({
      userId: userIdObj,
    });

    // 6. 刪除用戶的討論區帖子
    const deletedPosts = await DiscussionPost.deleteMany({
      author: userIdObj,
    });

    // 7. 刪除其他用戶對該用戶的追蹤
    await User.updateMany(
      { "following.userId": userIdObj },
      { $pull: { following: { userId: userIdObj } } }
    );

    // 8. 刪除其他用戶收藏的該用戶的討論區帖子
    await User.updateMany(
      { bookmarkedDiscussionPosts: userIdObj },
      { $pull: { bookmarkedDiscussionPosts: userIdObj } }
    );

    // 9. 刪除其他用戶的釘選播放器中包含該用戶的記錄
    await User.updateMany(
      { "pinnedPlayer.userId": userIdObj },
      { $unset: { pinnedPlayer: "" } }
    );

    // 10. 匿名化用戶
    const anonymousId = `deleted_${user._id.toString().slice(-8)}_${Date.now()}`;
    user.email = `${anonymousId}@deleted.local`;
    user.username = `已刪除用戶_${anonymousId}`;
    user.password = null;
    user.image = "";
    user.bio = "";
    user.backupEmail = "";
    user.gender = "hidden";
    user.birthday = null;
    user.pointsBalance = 0;
    user.totalEarnedPoints = 0;
    user.discussionPendingPoints = 0;
    user.isVerified = false;
    user.isAdmin = false;
    user.isSuspended = false;
    user.isPermanentSuspension = false;
    user.suspendedAt = null;
    user.subscriptions = [];
    user.ownedFrames = [];
    user.currentFrame = "default";
    user.frameSettings = {};
    user.miniPlayerPurchased = false;
    user.premiumPlayerSkin = false;
    user.activePlayerSkin = "default";
    user.playerSkinSettings = {};
    user.powerCoupons = 0;
    user.activePowerItems = [];
    user.activePowerImages = [];
    user.playlist = [];
    user.defaultMusicUrl = "";
    user.pinnedPlayer = undefined;
    user.pinnedPlayerSettings = {};
    user.following = [];
    user.bookmarkedDiscussionPosts = [];
    user.privacyPreferences = {};
    user.provider = "local";
    user.providerId = null;
    user.providers = [];
    user.verificationToken = null;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    user.deletionRequestedAt = null;
    user.deletionScheduledAt = null;
    user.deletionCode = null;
    user.deletionCodeExpiresAt = null;
    user.lastDeletionCodeSentAt = null;
    await user.save();

    return NextResponse.json(
      {
        success: true,
        message: "帳號已刪除",
        deleted: {
          images: deletedImages.deletedCount,
          videos: deletedVideos.deletedCount,
          music: deletedMusic.deletedCount,
          comments: deletedComments.deletedCount,
          likes: deletedLikes.deletedCount,
          transactions: deletedTransactions.deletedCount,
          visitorLogs: deletedVisitorLogs.deletedCount,
          adVisitorLogs: deletedAdVisitorLogs.deletedCount,
          posts: deletedPosts.deletedCount,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("執行帳號刪除錯誤：", error);
    return NextResponse.json(
      { success: false, message: "伺服器錯誤：" + error.message },
      { status: 500 }
    );
  }
}

