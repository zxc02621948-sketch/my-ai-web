// scripts/process-account-deletions.js
// 定時任務：處理帳號刪除（7天保留期後實際執行刪除）

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Image from '../models/Image.js';
import Video from '../models/Video.js';
import Music from '../models/Music.js';
import Comment from '../models/Comment.js';
import LikeLog from '../models/LikeLog.js';
import PointsTransaction from '../models/PointsTransaction.js';
import VisitorLog from '../models/VisitorLog.js';
import AdVisitorLog from '../models/AdVisitorLog.js';
import DiscussionPost from '../models/DiscussionPost.js';

// 加載環境變量
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

/**
 * 完全刪除用戶的所有數據
 */
async function deleteUserData(userId) {
  try {
    console.log(`🗑️  開始刪除用戶 ${userId} 的所有數據...`);

    // 1. 刪除用戶的所有作品（圖片、視頻、音樂）
    const deletedImages = await Image.deleteMany({ userId });
    const deletedVideos = await Video.deleteMany({ userId });
    const deletedMusic = await Music.deleteMany({ userId });
    console.log(`  ✅ 已刪除作品：${deletedImages.deletedCount} 張圖片、${deletedVideos.deletedCount} 個視頻、${deletedMusic.deletedCount} 首音樂`);

    // 2. 刪除用戶的所有評論
    const deletedComments = await Comment.deleteMany({ userId });
    console.log(`  ✅ 已刪除 ${deletedComments.deletedCount} 條評論`);

    // 3. 刪除用戶的所有點讚記錄
    const deletedLikes = await LikeLog.deleteMany({ userId });
    console.log(`  ✅ 已刪除 ${deletedLikes.deletedCount} 條點讚記錄`);

    // 4. 刪除用戶的所有積分交易記錄
    const deletedTransactions = await PointsTransaction.deleteMany({ userId });
    console.log(`  ✅ 已刪除 ${deletedTransactions.deletedCount} 條積分交易記錄`);

    // 5. 刪除用戶的訪問記錄
    const deletedVisitorLogs = await VisitorLog.deleteMany({ userId });
    const deletedAdVisitorLogs = await AdVisitorLog.deleteMany({ userId });
    console.log(`  ✅ 已刪除 ${deletedVisitorLogs.deletedCount} 條訪問記錄、${deletedAdVisitorLogs.deletedCount} 條廣告訪問記錄`);

    // 6. 刪除用戶的討論區帖子
    const deletedPosts = await DiscussionPost.deleteMany({ userId });
    console.log(`  ✅ 已刪除 ${deletedPosts.deletedCount} 條討論區帖子`);

    // 7. 刪除其他用戶對該用戶的追蹤
    await User.updateMany(
      { 'following.userId': userId },
      { $pull: { following: { userId } } }
    );
    console.log(`  ✅ 已移除其他用戶對該用戶的追蹤`);

    // 8. 刪除該用戶對其他用戶的追蹤
    // （這會在刪除用戶時自動處理）

    // 9. 刪除其他用戶收藏的該用戶的討論區帖子
    await User.updateMany(
      { bookmarkedDiscussionPosts: userId },
      { $pull: { bookmarkedDiscussionPosts: userId } }
    );
    console.log(`  ✅ 已移除其他用戶收藏的該用戶的帖子`);

    // 10. 刪除其他用戶的釘選播放器中包含該用戶的記錄
    await User.updateMany(
      { 'pinnedPlayer.userId': userId },
      { $unset: { pinnedPlayer: '' } }
    );
    console.log(`  ✅ 已移除其他用戶釘選的該用戶播放器`);

    console.log(`✅ 用戶 ${userId} 的所有數據已完全刪除`);
  } catch (error) {
    console.error(`❌ 刪除用戶 ${userId} 數據時發生錯誤：`, error);
    throw error;
  }
}

/**
 * 清空用戶的個人信息（但保留用戶記錄用於審計）
 */
async function anonymizeUser(user) {
  try {
    // 生成匿名用戶名和郵箱
    const anonymousId = `deleted_${user._id.toString().slice(-8)}_${Date.now()}`;
    
    // 清空所有個人信息
    user.email = `${anonymousId}@deleted.local`;
    user.username = `已刪除用戶_${anonymousId}`;
    user.password = null; // 清空密碼
    user.image = ''; // 清空頭像
    user.bio = ''; // 清空簡介
    user.backupEmail = ''; // 清空備用郵箱
    user.gender = 'hidden'; // 重置性別
    user.birthday = null; // 清空生日
    
    // 清空所有積分和記錄
    user.pointsBalance = 0;
    user.totalEarnedPoints = 0;
    user.discussionPendingPoints = 0;
    
    // 清空所有功能狀態
    user.isVerified = false;
    user.isAdmin = false;
    user.isSuspended = false;
    user.isPermanentSuspension = false;
    user.suspendedAt = null;
    
    // 清空所有訂閱和購買記錄
    user.subscriptions = [];
    user.ownedFrames = [];
    user.currentFrame = 'default';
    user.frameSettings = {};
    user.miniPlayerPurchased = false;
    user.premiumPlayerSkin = false;
    user.activePlayerSkin = 'default';
    user.playerSkinSettings = {};
    user.powerCoupons = 0;
    user.activePowerItems = [];
    user.activePowerImages = [];
    
    // 清空播放清單和設置
    user.playlist = [];
    user.defaultMusicUrl = '';
    user.pinnedPlayer = undefined;
    user.pinnedPlayerSettings = {};
    
    // 清空追蹤和收藏
    user.following = [];
    user.bookmarkedDiscussionPosts = [];
    
    // 清空隱私設定
    user.privacyPreferences = {};
    
    // 清空 OAuth 信息
    user.provider = 'local';
    user.providerId = null;
    user.providers = [];
    
    // 清空所有 token
    user.verificationToken = null;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    
    // 清空註銷相關字段
    user.deletionRequestedAt = null;
    user.deletionScheduledAt = null;
    user.deletionCode = null;
    user.deletionCodeExpiresAt = null;
    user.lastDeletionCodeSentAt = null;
    
    await user.save();
    console.log(`✅ 用戶 ${user._id} 的個人信息已清空並匿名化`);
  } catch (error) {
    console.error(`❌ 匿名化用戶 ${user._id} 時發生錯誤：`, error);
    throw error;
  }
}

/**
 * 處理到期的帳號刪除
 */
async function processAccountDeletions() {
  try {
    console.log('🔄 開始處理帳號刪除...');
    
    // 連接數據庫
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ 數據庫連接成功');

    const now = new Date();
    
    // 查找所有已到刪除時間的用戶
    const usersToDelete = await User.find({
      deletionScheduledAt: { $lte: now },
      deletionRequestedAt: { $ne: null } // 確保有刪除請求
    });

    console.log(`📋 找到 ${usersToDelete.length} 個待刪除的帳號`);

    for (const user of usersToDelete) {
      try {
        console.log(`\n處理用戶：${user.username} (${user._id})`);
        
        // 1. 刪除用戶的所有數據
        await deleteUserData(user._id);
        
        // 2. 清空用戶的個人信息（匿名化）
        await anonymizeUser(user);
        
        console.log(`✅ 用戶 ${user._id} 的刪除流程已完成\n`);
      } catch (error) {
        console.error(`❌ 處理用戶 ${user._id} 時發生錯誤：`, error);
        // 繼續處理下一個用戶，不中斷整個流程
      }
    }

    console.log('✅ 帳號刪除處理完成');
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ 處理帳號刪除時發生錯誤：', error);
    process.exit(1);
  }
}

// 如果直接執行此腳本
if (import.meta.url === `file://${process.argv[1]}`) {
  processAccountDeletions().then(() => {
    console.log('腳本執行完成');
    process.exit(0);
  });
}

export default processAccountDeletions;

