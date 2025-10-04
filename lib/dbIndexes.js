// lib/dbIndexes.js
/**
 * 數據庫索引優化工具
 * 用於創建和管理數據庫索引，提高查詢性能
 */
import { dbConnect } from "./db";
import User from "@/models/User";
import Image from "@/models/Image";
import Message from "@/models/Message";
import Notification from "@/models/Notification";
import Report from "@/models/Report";
import Feedback from "@/models/Feedback";

/**
 * 創建所有必要的數據庫索引
 * 此函數應在應用啟動時或通過管理員API調用
 */
export async function createAllIndexes() {
  await dbConnect();
  
  console.log("開始創建數據庫索引...");
  
  // 用戶集合索引
  await User.collection.createIndex({ username: 1 }, { unique: true });
  await User.collection.createIndex({ email: 1 }, { unique: true });
  await User.collection.createIndex({ lastActive: -1 });
  await User.collection.createIndex({ createdAt: -1 });
  
  // 圖片集合索引
  await Image.collection.createIndex({ userId: 1, createdAt: -1 });
  await Image.collection.createIndex({ tags: 1 });
  await Image.collection.createIndex({ likes: 1 });
  await Image.collection.createIndex({ views: 1 });
  await Image.collection.createIndex({ createdAt: -1 });
  await Image.collection.createIndex({ rating: 1 });
  
  // 消息集合索引
  await Message.collection.createIndex({ sender: 1, recipient: 1 });
  await Message.collection.createIndex({ conversationId: 1, createdAt: 1 });
  await Message.collection.createIndex({ recipient: 1, read: 1 });
  
  // 通知集合索引
  await Notification.collection.createIndex({ userId: 1, read: 1 });
  await Notification.collection.createIndex({ userId: 1, createdAt: -1 });
  
  // 報告集合索引
  await Report.collection.createIndex({ targetId: 1 });
  await Report.collection.createIndex({ reporterId: 1 });
  await Report.collection.createIndex({ status: 1 });
  await Report.collection.createIndex({ createdAt: -1 });
  
  // 反饋集合索引
  await Feedback.collection.createIndex({ userId: 1 });
  await Feedback.collection.createIndex({ type: 1 });
  await Feedback.collection.createIndex({ createdAt: -1 });
  
  console.log("數據庫索引創建完成！");
  
  return {
    success: true,
    message: "所有索引創建成功"
  };
}

/**
 * 優化常用查詢
 * 提供優化後的查詢方法，確保使用索引
 */
export const optimizedQueries = {
  /**
   * 獲取用戶最近的圖片
   * @param {string} userId - 用戶ID
   * @param {number} limit - 限制數量
   * @param {number} skip - 跳過數量
   */
  async getUserRecentImages(userId, limit = 10, skip = 0) {
    await dbConnect();
    return Image.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
  },
  
  /**
   * 獲取用戶未讀通知
   * @param {string} userId - 用戶ID
   */
  async getUserUnreadNotifications(userId) {
    await dbConnect();
    return Notification.find({ userId, read: false })
      .sort({ createdAt: -1 })
      .lean();
  },
  
  /**
   * 獲取用戶對話
   * @param {string} userId - 用戶ID
   * @param {number} limit - 限制數量
   */
  async getUserConversations(userId, limit = 20) {
    await dbConnect();
    
    // 使用聚合管道優化查詢
    return Message.aggregate([
      {
        $match: {
          $or: [{ sender: userId }, { recipient: userId }]
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: "$conversationId",
          lastMessage: { $first: "$$ROOT" },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [
                  { $eq: ["$recipient", userId] },
                  { $eq: ["$read", false] }
                ]},
                1,
                0
              ]
            }
          }
        }
      },
      {
        $sort: { "lastMessage.createdAt": -1 }
      },
      {
        $limit: limit
      }
    ]);
  },
  
  /**
   * 搜索圖片
   * @param {string} query - 搜索關鍵詞
   * @param {Object} filters - 過濾條件
   * @param {number} limit - 限制數量
   */
  async searchImages(query, filters = {}, limit = 20) {
    await dbConnect();
    
    const searchConditions = [];
    
    // 關鍵詞搜索
    if (query) {
      searchConditions.push({
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { tags: { $regex: query, $options: 'i' } }
        ]
      });
    }
    
    // 應用過濾條件
    if (filters.rating) {
      searchConditions.push({ rating: filters.rating });
    }
    
    if (filters.userId) {
      searchConditions.push({ userId: filters.userId });
    }
    
    const searchQuery = searchConditions.length > 0
      ? { $and: searchConditions }
      : {};
    
    return Image.find(searchQuery)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }
};