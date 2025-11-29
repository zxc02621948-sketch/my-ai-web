// utils/userStats.js
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import User from "@/models/User";
import Image from "@/models/Image";
import Music from "@/models/Music";
import Video from "@/models/Video";
import Comment from "@/models/Comment";
import PointsTransaction from "@/models/PointsTransaction";

/**
 * 計算用戶的統計數據
 * @param {string} userId - 用戶 ID
 * @returns {Promise<Object>} 統計數據對象
 */
export async function calculateUserStats(userId) {
  if (!userId) {
    return {
      worksCount: 0,
      followersCount: 0,
      followingCount: 0,
      favoritesCount: 0,
      likesCount: 0,
      commentsCount: 0,
      monthlyEarned: 0,
      totalEarned: 0,
    };
  }

  try {
    await dbConnect();

    // 確保 userId 是有效的 ObjectId
    let validUserId;
    try {
      validUserId = new mongoose.Types.ObjectId(String(userId));
    } catch (error) {
      console.error("無效的用戶 ID:", userId, error);
      return {
        worksCount: 0,
        followersCount: 0,
        followingCount: 0,
        favoritesCount: 0,
        likesCount: 0,
        commentsCount: 0,
        monthlyEarned: 0,
        totalEarned: 0,
      };
    }

    // ✅ 計算作品數量：圖片 + 音樂 + 影片
    // 圖片查詢：同時匹配 user (ObjectId) 和 userId (String) 字段，確保兼容性
    // 確保 userId 使用字符串格式進行查詢
    const userIdString = validUserId.toString();
    const imageQuery = { $or: [{ user: validUserId }, { userId: userIdString }, { userId: userId }] };
    const imageCount = await Image.countDocuments(imageQuery);
    const musicCount = await Music.countDocuments({ author: validUserId });
    const videoCount = await Video.countDocuments({ author: validUserId });
    const worksCount = imageCount + musicCount + videoCount;

    const followersCount = await User.countDocuments({ "following.userId": userIdString });
    const user = await User.findById(validUserId);
    const followingCount = user?.following?.length || 0;
    
    // ✅ 獲取所有作品用於計算點讚數
    // 圖片查詢：同時匹配 user (ObjectId) 和 userId (String) 字段
    const userImages = await Image.find(imageQuery, { likes: 1, _id: 1 }).lean();
    const userMusic = await Music.find({ author: validUserId }, { likes: 1, _id: 1 }).lean();
    const userVideos = await Video.find({ author: validUserId }, { likes: 1, _id: 1 }).lean();
    
    // Comment 模型的 userId 是 ObjectId，使用 validUserId
    const commentsCount = await Comment.countDocuments({ userId: validUserId });

    // ✅ 計算總點讚數 - 用戶所有作品（圖片、音樂、影片）獲得的點讚總數
    const imageLikes = userImages.reduce((total, image) => {
      return total + (Array.isArray(image.likes) ? image.likes.length : 0);
    }, 0);
    const musicLikes = userMusic.reduce((total, music) => {
      return total + (Array.isArray(music.likes) ? music.likes.length : 0);
    }, 0);
    const videoLikes = userVideos.reduce((total, video) => {
      return total + (Array.isArray(video.likes) ? video.likes.length : 0);
    }, 0);
    const likesCount = imageLikes + musicLikes + videoLikes;

    // ✅ 計算收藏數 - 用戶收藏的作品數（即用戶點讚的作品數）
    // 查詢所有包含該用戶 ID 的 likes 數組的圖片、音樂、影片
    // 使用多種格式匹配，確保兼容性
    const favoritedImagesCount = await Image.countDocuments({
      $or: [
        { likes: validUserId },
        { likes: userId },
        { likes: userIdString },
        { likes: validUserId.toString() }
      ]
    });
    const favoritedMusicCount = await Music.countDocuments({
      $or: [
        { likes: validUserId },
        { likes: userId },
        { likes: userIdString },
        { likes: validUserId.toString() }
      ]
    });
    const favoritedVideosCount = await Video.countDocuments({
      $or: [
        { likes: validUserId },
        { likes: userId },
        { likes: userIdString },
        { likes: validUserId.toString() }
      ]
    });
    const favoritesCount = favoritedImagesCount + favoritedMusicCount + favoritedVideosCount;

    // ===== 新增：本月獲得 & 總計獲得積分 =====
    const now = new Date();
    const startOfMonthUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const startOfNextMonthUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    // ✅ 使用累計獲得積分（只增不減）來計算等級，而非當前餘額
    const totalEarned = user?.totalEarnedPoints || 0;
    
    // 計算本月積分（從交易記錄）
    const monthlyAgg = await PointsTransaction.aggregate([
      { $match: { userId: validUserId, createdAt: { $gte: startOfMonthUTC, $lt: startOfNextMonthUTC } } },
      { $group: { _id: null, total: { $sum: "$points" } } },
    ]);
    
    const monthlyEarned = Number(monthlyAgg?.[0]?.total || 0);

    return {
      worksCount,
      followersCount,
      followingCount,
      favoritesCount,
      likesCount,
      commentsCount,
      monthlyEarned,
      totalEarned,
    };

  } catch (error) {
    console.error("計算用戶統計數據時發生錯誤:", error);
    return {
      worksCount: 0,
      followersCount: 0,
      followingCount: 0,
      favoritesCount: 0,
      likesCount: 0,
      commentsCount: 0,
      monthlyEarned: 0,
      totalEarned: 0,
    };
  }
}

/**
 * 批量計算多個用戶的統計數據
 * @param {string[]} userIds - 用戶 ID 數組
 * @returns {Promise<Object>} 用戶 ID 為鍵的統計數據對象
 */
export async function calculateMultipleUserStats(userIds) {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return {};
  }

  const results = {};
  
  // 並行計算所有用戶的統計數據
  const promises = userIds.map(async (userId) => {
    const stats = await calculateUserStats(userId);
    return { userId, stats };
  });

  const allStats = await Promise.all(promises);
  
  allStats.forEach(({ userId, stats }) => {
    results[userId] = stats;
  });

  return results;
}

/**
 * 獲取用戶統計數據的快取版本（可選實現）
 * @param {string} userId - 用戶 ID
 * @param {number} cacheMinutes - 快取時間（分鐘）
 * @returns {Promise<Object>} 統計數據對象
 */
export async function getCachedUserStats(userId, cacheMinutes = 5) {
  // 這裡可以實現 Redis 或其他快取機制
  // 目前直接返回計算結果
  return await calculateUserStats(userId);
}