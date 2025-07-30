// /lib/mongodb.js

import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("❌ 請在 .env.local 設定 MONGODB_URI");
}

// 全域變數防止多次連線（適用於開發環境 HMR 熱重載）
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      dbName: 'myaiweb',
      bufferCommands: false,
    }).then((mongoose) => {
      console.log("✅ 已連接 MongoDB（via mongoose）");
      return mongoose;
    }).catch((error) => {
      console.error("❌ 連接 MongoDB 發生錯誤：", error);
      throw error;
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
