// app/api/images/route.js
import { dbConnect } from "@/lib/db";
import Image from "@/models/Image";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await dbConnect();

    const rawImages = await Image.find({})
      .sort({ createdAt: -1 })
      .lean();

    // 顯式補 author（就算沒有也給空字串），避免前端物件缺 key
    const images = rawImages.map((img) => ({
      ...img,
      author: typeof img.author === "string" ? img.author : "",
      // （可選）若你常用 imageUrl，就順手補一個預設
      imageUrl:
        img.imageUrl ||
        (img.imageId
          ? `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${img.imageId}/public`
          : ""),
    }));

    return NextResponse.json({ images });
  } catch (error) {
    console.error("❌ 無法取得圖片列表", error);
    return new NextResponse("Failed to fetch images", { status: 500 });
  }
}
