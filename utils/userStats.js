// utils/userStats.js
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import User from "@/models/User";
import Image from "@/models/Image";
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

    // 簡化查詢以避免 webpack 模組錯誤
    const worksCount = await Image.countDocuments({ userId });
    const followersCount = await User.countDocuments({ "following.userId": userId });
    const user = await User.findById(userId);
    const followingCount = user?.following?.length || 0;
    const userImages = await Image.find({ userId }, { likes: 1, _id: 1 }).lean();
    const commentsCount = await Comment.countDocuments({ userId });

    // 計算總點讚數 - 用戶所有作品獲得的點讚總數
    const likesCount = userImages.reduce((total, image) => {
      return total + (Array.isArray(image.likes) ? image.likes.length : 0);
    }, 0);

    // 計算收藏數 - 這裡假設收藏就是點讚（根據實際業務邏輯調整）
    const favoritesCount = likesCount;

    // ===== 新增：本月獲得 & 總計獲得積分 =====
    const now = new Date();
    const startOfMonthUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const startOfNextMonthUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

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

    // 直接使用已查詢的用戶積分餘額作為 totalEarned
    const totalEarned = user?.pointsBalance || 0;
    
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