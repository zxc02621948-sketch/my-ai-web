// app/api/user-music/route.js
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

    const query = { author: userId };
    const isOwner = viewer && String(viewer._id) === String(userId);
    if (!isOwner) {
      query.isPublic = true;
    }

    // 查找該用戶上傳的所有音樂，並填充作者資訊
    const items = await Music.find(query)
      .populate('author', '_id username image currentFrame frameSettings')
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return NextResponse.json({ items }, { status: 200, ...noStore });
  } catch (err) {
    console.error("[user-music] error:", err);
    // 重要：不要丟 500，回 200 + 空，避免前端整頁報錯
    return NextResponse.json({ items: [], error: "server" }, { status: 200, ...noStore });
  }
}

