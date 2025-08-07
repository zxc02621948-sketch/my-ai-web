// app/api/images/route.js
import { dbConnect } from "@/lib/db";
import Image from "@/models/Image";
import { NextResponse } from "next/server";

export async function GET() {
  await dbConnect();
  try {
    const images = await Image.find({})
      .sort({ createdAt: -1 })
      .lean();
    return NextResponse.json({ images });
  } catch (error) {
    console.error("❌ 無法取得圖片列表", error);
    return new NextResponse("Failed to fetch images", { status: 500 });
  }
}
