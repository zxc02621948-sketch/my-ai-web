// app/api/cloudflare-images/route.js
import { connectToDatabase } from "@/lib/mongodb";
import { NextResponse } from "next/server";
import Image from "@/models/Image";
import User from "@/models/User";
import { Notification } from "@/models/Notification";
import mongoose from "mongoose";
import { computeCompleteness } from "@/utils/score"; // 👈 新增

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
        modelName: img.modelName || null,
        modelLink: img.modelLink || null,
        loraName: img.loraName || null,
        loraLink: img.loraLink || null,
        steps: img.steps ?? null,
        sampler: img.sampler || null,
        cfgScale: img.cfgScale ?? null,
        seed: img.seed || null,
        clipSkip: img.clipSkip ?? null,
        width: img.width ?? null,
        height: img.height ?? null,
        modelHash: img.modelHash || null,
        completenessScore: img.completenessScore ?? null, // 👈 顯示用
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
      modelName,
      loraName,
      modelLink,
      loraLink,
      steps,
      sampler,
      cfgScale,
      seed,
      clipSkip,
      width,
      height,
      modelHash,
      author,
    } = body;

    if (!imageId || !title) {
      return NextResponse.json({ message: "缺少必要欄位" }, { status: 400 });
    }

    const imageUrl = `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${imageId}/public`;

    // 先組資料（空值不塞）
    const doc = {
      title,
      imageId,
      imageUrl,
      platform: platform || "",
      positivePrompt: positivePrompt || "",
      negativePrompt: negativePrompt || "",
      rating,
      category,
      description: description || "",
      tags: Array.isArray(tags) ? tags : [],
      author: author || "",
      modelName: modelName || "",
      loraName: loraName || "",
      modelLink: modelLink || "",
      loraLink: loraLink || "",
      steps: steps ?? null,
      sampler: sampler || "",
      cfgScale: cfgScale ?? null,
      seed: seed ? String(seed) : "",
      clipSkip: clipSkip ?? null,
      width: width ?? null,
      height: height ?? null,
      modelHash: modelHash || "",
      userId,
      user: userId,
    };

    // 👇 即時計算完整度，讓熱門度立即生效
    doc.completenessScore = computeCompleteness(doc);

    const newImage = await Image.create(doc);

    // 通知追蹤者（維持原有行為）
    const followers = await User.find({ "following.userId": new mongoose.Types.ObjectId(userId) });
    const uploader = await User.findById(userId);

    await Promise.all(
      followers.map((follower) =>
        Notification.create({
          userId: follower._id,
          fromUserId: uploader?._id,
          type: "new_image",
          text: `${uploader?.username || "用戶"} 發布了新圖片《${title}》`,
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
