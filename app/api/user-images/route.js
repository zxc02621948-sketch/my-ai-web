// app/api/user-images/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";          // 統一使用 db.js
import Image from "@/models/Image";             // 依你的模型路徑

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
    await dbConnect();

    // 依你的資料結構調整條件：
    // 假設 Image.user 是作者的 ObjectId
    const items = await Image.find({ user: id })
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
