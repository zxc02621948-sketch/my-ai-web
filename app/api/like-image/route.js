import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Image from "@/models/Image";
import jwt from "jsonwebtoken";
import LikeLog from "@/models/LikeLog";

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

  const body = await req.json().catch(() => null);
  const shouldLike = body?.shouldLike;

  if (typeof shouldLike !== "boolean") {
    return NextResponse.json({ message: "缺少 shouldLike 參數" }, { status: 400 });
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
    const alreadyLiked = image.likes.some((id) => id?.toString?.() === userIdStr);

    if (shouldLike && !alreadyLiked) {
      image.likes.push(userIdStr);
      await LikeLog.create({
        imageId,
        userId: userIdStr,
        createdAt: new Date(),
      });
    } else if (!shouldLike && alreadyLiked) {
      image.likes = image.likes.filter((id) => id?.toString?.() !== userIdStr);
    }

    await image.save();

    return NextResponse.json({ _id: image._id.toString(), likes: image.likes });
  } catch (err) {
    console.error("更新愛心失敗", err);
    return NextResponse.json({ message: "伺服器錯誤" }, { status: 500 });
  }
}
