import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Image from "@/models/Image";
import User from "@/models/User";
import jwt from "jsonwebtoken";
import axios from "axios";

export async function DELETE(req) {
  await connectToDatabase();

  try {
    const { imageId } = await req.json();

    if (!imageId) {
      return NextResponse.json({ message: "缺少 imageId" }, { status: 400 });
    }

    const authHeader = req.headers.get("authorization");
    const token = authHeader?.split(" ")[1];

    if (!token) {
      return NextResponse.json({ message: "未授權：缺少 Token" }, { status: 401 });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return NextResponse.json({ message: "Token 驗證失敗" }, { status: 401 });
    }

    const currentUserId = decoded.id;

    const [image, user] = await Promise.all([
      Image.findById(imageId),
      User.findById(currentUserId),
    ]);

    if (!image) {
      return NextResponse.json({ message: "找不到圖片" }, { status: 404 });
    }

    const isAdmin = user?.isAdmin === true;

    // ✅ 管理員可直接刪除，跳過擁有者比對
    if (!isAdmin) {
      const isOwner = image.user?.toString?.() === currentUserId;
      if (!isOwner) {
        return NextResponse.json({ message: "你沒有權限刪除這張圖片" }, { status: 403 });
      }
    }

    try {
      await axios.delete(
        `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/images/v1/${image.imageId}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.CLOUDFLARE_API_KEY}`,
          },
        }
      );
    } catch (error) {
      return NextResponse.json(
        { message: "Cloudflare 刪除失敗", detail: error.response?.data },
        { status: 400 }
      );
    }

    await Image.findByIdAndDelete(imageId);

    return NextResponse.json({ message: "圖片刪除成功" });
  } catch (error) {
    console.error("刪除圖片錯誤：", error);
    return NextResponse.json({ message: "伺服器錯誤" }, { status: 500 });
  }
}
