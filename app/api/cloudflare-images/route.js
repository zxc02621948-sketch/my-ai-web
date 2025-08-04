import { connectToDatabase } from "@/lib/mongodb";
import { NextResponse } from "next/server";
import Image from "@/models/Image";
import User from "@/models/User";
import { Notification } from "@/models/Notification"; // ✅ 加入這行

export async function GET(req) {
  try {
    await connectToDatabase();

    const page = parseInt(req.nextUrl.searchParams.get("page")) || 1;
    const limit = parseInt(req.nextUrl.searchParams.get("limit")) || 20;
    const skip = (page - 1) * limit;

    const totalImages = await Image.countDocuments();

    const rawImages = await Image.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("user", "username image");

    const images = rawImages.map((img) => {
      const populatedUser = img.user && typeof img.user === "object" ? img.user : null;

      const fallbackImageId = "a607f9aa-b1e5-484c-bee3-02191abee13e";
      const userImage =
        populatedUser?.image && populatedUser.image.trim() !== ""
          ? populatedUser.image
          : fallbackImageId;

      return {
        _id: img._id?.toString(),
        id: img.imageId,
        title: img.title,
        imageId: img.imageId,
        platform: img.platform,
        positivePrompt: img.positivePrompt,
        negativePrompt: img.negativePrompt,
        rating: img.rating,
        category: img.category,
        description: img.description,
        tags: img.tags,
        modelName: img.modelName || null,   // ✅ 加入欄位
        loraName: img.loraName || null,     // ✅ 加入欄位
        user: populatedUser
          ? {
              _id: populatedUser._id?.toString(),
              username: populatedUser.username || "未命名用戶",
              image: userImage,
            }
          : null,
        createdAt: img.createdAt,
        likes: Array.isArray(img.likes)
          ? img.likes
              .filter((id) => id && typeof id.toString === "function")
              .map((id) => id.toString())
          : [],
      };
    });

    return NextResponse.json({
      images,
      totalPages: Math.ceil(totalImages / limit),
      currentPage: page,
    });
  } catch (error) {
    console.error("讀取圖片資料錯誤：", error);
    return NextResponse.json({ message: "讀取圖片資料失敗" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await connectToDatabase();
    const body = await req.json();
    const {
      title,
      imageId,
      platform,
      positivePrompt,
      negativePrompt,
      rating,
      category,
      description,
      tags,
      userId,
      modelName,   // ✅ 加入解構
      loraName     // ✅ 加入解構
    } = body;

    if (!imageId || !title) {
      return NextResponse.json({ message: "缺少必要欄位" }, { status: 400 });
    }

    const imageUrl = `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${imageId}/public`;

    const newImage = await Image.create({
      title,
      imageId,
      imageUrl,
      platform,
      positivePrompt,
      negativePrompt,
      rating,
      category,
      description,
      tags,
      modelName,  // ✅ 寫入
      loraName,   // ✅ 寫入
      userId,
      user: userId,
    });

// 改成（正確）：
const followers = await User.find({ following: { $in: [userId] } });
    const author = await User.findById(userId);

    await Promise.all(
      followers.map((follower) =>
        Notification.create({
          userId: follower._id,
          fromUserId: author._id,
          type: "new_image",
          text: `${author.username} 發布了新圖片《${title}》`,
          imageId: newImage._id,
          isRead: false,
        })
      )
    );

    return NextResponse.json({ message: "圖片資料已儲存", insertedId: newImage._id });
  } catch (error) {
    console.error("寫入圖片資料錯誤：", error);
    return NextResponse.json({ message: "寫入圖片資料失敗" }, { status: 500 });
  }
}
