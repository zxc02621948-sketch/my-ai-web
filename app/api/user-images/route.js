import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Image from "@/models/Image";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "缺少 userId" }, { status: 400 });
  }

  try {
    await connectToDatabase();

    const rawImages = await Image.find({ userId: id })
      .sort({ createdAt: -1 })
      .populate("user", "username image"); // 取上傳者基本資訊

    const images = rawImages.map((img) => ({
      _id: img._id.toString(),
      title: img.title,
      imageId: img.imageId,
      imageUrl:
        img.imageUrl ||
        `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${img.imageId}/public`,
      platform: img.platform,
      positivePrompt: img.positivePrompt,
      negativePrompt: img.negativePrompt,
      rating: img.rating,
      category: img.category,
      description: img.description,
      tags: img.tags,
      author: img.author || "",              // 👈 加上作者
      createdAt: img.createdAt,
      user: img.user
        ? {
            _id: img.user._id?.toString(),
            username: img.user.username || "未命名用戶",
            image: img.user.image || "",
          }
        : null,
      likes: Array.isArray(img.likes)
        ? img.likes
            .filter((id) => id && typeof id.toString === "function")
            .map((id) => id.toString())
        : [],
    }));

    return NextResponse.json(images);
  } catch (err) {
    console.error("取得使用者上傳圖片失敗", err);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
