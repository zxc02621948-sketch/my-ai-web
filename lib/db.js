// db.js
import mongoose from "mongoose";

const { MONGODB_URI = "mongodb+srv://cvb120g:j3j79ru06@my-ai-web.9ugvdto.mongodb.net/myaiweb?retryWrites=true&w=majority&appName=my-ai-web", MONGODB_DBNAME = "myaiweb" } = process.env;

// 在 Node 全域上做單例快取，Serverless 同一個容器內不會重連
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

/**
 * 連接到 MongoDB 數據庫
 * @returns {Promise<typeof mongoose>} Mongoose 連接實例
 */
export const dbConnect = async () => {
  // 如果已經連接，直接返回連接
  if (cached.conn) return cached.conn;

  // 如果尚未連接，但有連接中的 Promise，等待它完成
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      dbName: MONGODB_DBNAME,
      bufferCommands: false,
      // 優化連接參數
      serverSelectionTimeoutMS: 3000, // 找到可用節點最久 3 秒（預設 30 秒太久）
      socketTimeoutMS: 45000,
      heartbeatFrequencyMS: 10000,    // 心跳頻率高一點，避免連線被閒置太久
      maxPoolSize: 10,                // 連線池（依需求可調）
    }).then((mongoose) => {
      console.log("✅ 已連接 MongoDB（via mongoose）");
      return mongoose;
    }).catch(err => {
      console.error("❌ MongoDB 連接失敗:", err);
      cached.promise = null; // 重置 promise 以便下次重試
      throw err; // 重新拋出錯誤以便調用者處理
    });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    // 這裡捕獲錯誤但仍然拋出，以便調用者可以處理
    throw error;
  }
};

// 為了向後兼容，提供 connectToDB 別名
export const connectToDB = dbConnect;
