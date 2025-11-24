// app/api/user-liked-images/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import Image from "@/models/Image";

const noStore = { headers: { "Cache-Control": "no-store" } };

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ items: [] }, { status: 200, ...noStore });
  }
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ items: [] }, { status: 200, ...noStore });
  }

  try {
    await dbConnect();

    // ✅ 優化：populate user 信息，避免前端重複調用 API
    const items = await Image.find({ likes: id })
      .populate('user', '_id username avatar currentFrame frameSettings')
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return NextResponse.json({ items }, { status: 200, ...noStore });
  } catch (err) {
    console.error("[user-liked-images] error:", err);
    return NextResponse.json({ items: [], error: "server" }, { status: 200, ...noStore });
  }
}
