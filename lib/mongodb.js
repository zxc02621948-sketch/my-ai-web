// lib/mongodb.js
import mongoose from "mongoose";

const { MONGODB_URI, MONGODB_DBNAME = "myaiweb" } = process.env;
if (!MONGODB_URI) {
  throw new Error("Missing MONGODB_URI in environment variables");
}

// 在 Node 全域上做單例快取，Serverless 同一個容器內不會重連
let cached = global.__mongooseConn;
if (!cached) {
  cached = global.__mongooseConn = { conn: null, promise: null };
}

export async function dbConnect() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      dbName: MONGODB_DBNAME,
      bufferCommands: false,

      // 🛡️ 保活 / 降延遲：這幾個參數能明顯減少「第一次點擊卡一下」
      serverSelectionTimeoutMS: 3000, // 找到可用節點最久 3 秒（預設 30 秒太久）
      socketTimeoutMS: 45000,
      heartbeatFrequencyMS: 10000,    // 心跳頻率高一點，避免連線被閒置太久
      maxPoolSize: 10,                // 連線池（依需求可調）
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

export default dbConnect;
