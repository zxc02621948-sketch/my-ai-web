// app/api/user-images/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";          // 統一使用 db.js
import Image from "@/models/Image";             // 依你的模型路徑
import User from "@/models/User";               // 用於 username 查詢

const noStore = { headers: { "Cache-Control": "no-store" } };

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  // 安全：沒參數就回空陣列
  if (!id) {
    return NextResponse.json({ items: [] }, { status: 200, ...noStore });
  }

  try {
    await dbConnect();

    let userId = null;

    // ✅ 支持 ObjectId 和 username 兩種查詢方式
    if (mongoose.Types.ObjectId.isValid(id)) {
      // 如果是有效的 ObjectId，直接使用
      userId = id;
    } else {
      // 如果不是 ObjectId，嘗試作為 username 查詢
      const user = await User.findOne({ username: id }).select('_id').lean();
      if (user) {
        userId = user._id.toString();
      } else {
        // 找不到用戶，返回空陣列
        return NextResponse.json({ items: [] }, { status: 200, ...noStore });
      }
    }

    if (!userId) {
      return NextResponse.json({ items: [] }, { status: 200, ...noStore });
    }

    // ✅ 查詢時同時匹配 user (ObjectId) 和 userId (String) 字段，確保兼容性
    // 因為舊數據可能只有 userId，新數據可能同時有 user 和 userId
    const userIdObjectId = mongoose.Types.ObjectId.isValid(userId) 
      ? new mongoose.Types.ObjectId(userId) 
      : null;
    
    const query = userIdObjectId 
      ? { $or: [{ user: userIdObjectId }, { userId: userId }] }
      : { userId: userId };

    // ✅ 優化：populate user 信息，避免前端重複調用 API
    const items = await Image.find(query)
      .populate('user', '_id username image currentFrame frameSettings')
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return NextResponse.json({ items }, { status: 200, ...noStore });
  } catch (err) {
    console.error("[user-images] error:", err);
    // 重要：不要丟 500，回 200 + 空，避免前端整頁報錯
    return NextResponse.json({ items: [], error: "server" }, { status: 200, ...noStore });
  }
}
