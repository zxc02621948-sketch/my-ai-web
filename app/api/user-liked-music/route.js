// app/api/user-liked-music/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import Music from "@/models/Music";
import { getCurrentUserFromRequest } from "@/lib/auth/getCurrentUserFromRequest";

const noStore = { headers: { "Cache-Control": "no-store" } };

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  // 安全：沒參數就回空陣列
  if (!id) {
    return NextResponse.json({ items: [] }, { status: 200, ...noStore });
  }

  // 安全：ObjectId 格式檢查（格式不對直接回空）
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ items: [] }, { status: 200, ...noStore });
  }

  try {
    const viewer = await getCurrentUserFromRequest(req);

    await dbConnect();

    const query = { likes: id };
    const isOwner = viewer && String(viewer._id) === String(id);
    if (!isOwner) {
      query.isPublic = true;
    }

    // 查找該用戶收藏的所有音樂，並填充作者資訊
    const items = await Music.find(query)
      .populate('author', '_id username avatar currentFrame frameSettings')
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

