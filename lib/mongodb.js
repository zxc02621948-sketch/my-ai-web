// lib/mongodb.js
// ⚠️ 已棄用：請使用 lib/db.js 中的 dbConnect 函數
// 此文件僅為向後兼容而保留

import { dbConnect } from "./db";

console.warn("⚠️ lib/mongodb.js 已棄用，請使用 lib/db.js 中的 dbConnect 函數");

// 為了向後兼容，保留舊的 connectToDatabase 函數
export async function connectToDatabase() {
  console.warn("⚠️ connectToDatabase() 已棄用，請使用 dbConnect()");
  return { db: (await dbConnect()).connection.db };
}

export default dbConnect;
