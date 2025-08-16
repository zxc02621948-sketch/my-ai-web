// app/api/user-liked-images/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/mongodb";
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

    // 假設 Image.likes 是 userId 陣列
    const items = await Image.find({ likes: id })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return NextResponse.json({ items }, { status: 200, ...noStore });
  } catch (err) {
    console.error("[user-liked-images] error:", err);
    return NextResponse.json({ items: [], error: "server" }, { status: 200, ...noStore });
  }
}
