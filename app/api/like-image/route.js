import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Image from "@/models/Image";
import jwt from "jsonwebtoken";

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

    // 清理掉 null 或 undefined
    image.likes = image.likes.filter((id) => !!id);

    // 是否已經點過愛心（無論是字串還是 ObjectId 都能比對）
    const alreadyLiked = image.likes.some(
      (id) => id?.toString?.() === userIdStr
    );

    if (alreadyLiked) {
      // 移除時也要保險比對（字串 vs ObjectId）
      image.likes = image.likes.filter(
        (id) => id?.toString?.() !== userIdStr
      );
    } else {
      image.likes.push(userIdStr); // 一律只 push 字串型
    }

    await image.save();

    return NextResponse.json({ _id: image._id.toString(), likes: image.likes });
  } catch (err) {
    console.error("更新愛心失敗", err);
    return NextResponse.json({ message: "伺服器錯誤" }, { status: 500 });
  }
}
