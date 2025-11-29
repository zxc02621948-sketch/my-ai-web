// app/api/user-liked-music/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import Music from "@/models/Music";
import User from "@/models/User";
import { getCurrentUserFromRequest } from "@/lib/auth/getCurrentUserFromRequest";

const noStore = { headers: { "Cache-Control": "no-store" } };

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  // 安全：沒參數就回空陣列
  if (!id) {
    return NextResponse.json({ items: [] }, { status: 200, ...noStore });
  }

  try {
    const viewer = await getCurrentUserFromRequest(req);

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

    // ✅ 查詢時同時匹配 ObjectId 和字符串格式的 likes（兼容舊數據）
    const userIdObjectId = new mongoose.Types.ObjectId(userId);

    // ✅ 使用 $in 查詢數組字段，同時匹配 ObjectId 和字符串格式
    const query = {
      likes: {
        $in: [userIdObjectId, userId, userIdObjectId.toString(), userId.toString()]
      }
    };
    
    const isOwner = viewer && String(viewer._id) === String(userId);
    if (!isOwner) {
      // ✅ 如果不是所有者，需要同時滿足 likes 和 isPublic 條件
      query.isPublic = true;
    }

    // 查找該用戶收藏的所有音樂，並填充作者資訊
    const items = await Music.find(query)
      .populate('author', '_id username image currentFrame frameSettings')
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return NextResponse.json({ items }, { status: 200, ...noStore });
  } catch (err) {
    console.error("[user-liked-music] error:", err);
    // 重要：不要丟 500，回 200 + 空，避免前端整頁報錯
    return NextResponse.json({ items: [], error: "server" }, { status: 200, ...noStore });
  }
}

