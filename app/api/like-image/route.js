import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Image from "@/models/Image";
import jwt from "jsonwebtoken";
import LikeLog from "@/models/LikeLog"; // ✅ 新增 LikeLog model

export async function PUT(req) {
  await connectToDatabase();

  const { searchParams } = new URL(req.url);
  const imageId = searchParams.get("id");
  const token = req.headers.get("authorization")?.replace("Bearer ", "");

  if (!imageId || !token) {
    return NextResponse.json({ message: "缺少參數" }, { status: 400 });
  }

  let user;
  try {
    user = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return NextResponse.json({ message: "驗證失敗" }, { status: 401 });
  }

  try {
    const image = await Image.findById(imageId);
    if (!image) {
      return NextResponse.json({ message: "找不到圖片" }, { status: 404 });
    }

    const userIdStr = user._id?.toString?.() || user.id?.toString?.();
    if (!userIdStr) {
      return NextResponse.json({ message: "找不到用戶 ID" }, { status: 401 });
    }

    image.likes = image.likes.filter((id) => !!id);

    const alreadyLiked = image.likes.some(
      (id) => id?.toString?.() === userIdStr
    );

    if (alreadyLiked) {
      image.likes = image.likes.filter(
        (id) => id?.toString?.() !== userIdStr
      );
    } else {
      image.likes.push(userIdStr);

      // ✅ 記錄一筆 LikeLog
      await LikeLog.create({
        imageId,
        userId: userIdStr,
        createdAt: new Date(),
      });
    }

    await image.save();

    return NextResponse.json({ _id: image._id.toString(), likes: image.likes });
  } catch (err) {
    console.error("更新愛心失敗", err);
    return NextResponse.json({ message: "伺服器錯誤" }, { status: 500 });
  }
}
