import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Image from "@/models/Image";
import mongoose from "mongoose";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  // 加強檢查 id 是否為合法 ObjectId
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "無效的使用者 ID" }, { status: 400 });
  }

  try {
    await connectToDatabase();

    const likedImages = await Image.find({ likes: id }).sort({ createdAt: -1 });

    return NextResponse.json(likedImages);
  } catch (err) {
    console.error("取得使用者收藏圖片失敗", err);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
