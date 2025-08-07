import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Image from "@/models/Image";
import User from "@/models/User";
import Comment from "@/models/Comment";
import { Notification } from "@/models/Notification"; // ✅ 加上大括號
import jwt from "jsonwebtoken";
import axios from "axios";

export async function POST(req) {
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

    if (!isAdmin) {
      const isOwner = image.user?.toString?.() === currentUserId;
      if (!isOwner) {
        return NextResponse.json({ message: "你沒有權限刪除這張圖片" }, { status: 403 });
      }
    }

    // ✅ 刪除 Cloudflare 圖片（可略過錯誤）
    if (image.imageId) {
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
        const msg = error.response?.data?.errors?.[0]?.message || "";
        console.error("❌ Cloudflare 刪除錯誤：", error.response?.data || error.message);

        // 如果是圖片不存在，可略過
        if (!msg.includes("not found")) {
          return NextResponse.json(
            { message: "Cloudflare 刪除失敗", detail: error.response?.data || error.message },
            { status: 400 }
          );
        } else {
          console.warn("⚠️ Cloudflare 圖片不存在，略過刪除");
        }
      }
    }

    // ✅ 清空留言
    await Comment.updateMany(
      { imageId },
      {
        $set: {
          isDeleted: true,
          deletedBy: currentUserId,
          deletedAt: new Date(),
          text: "[圖片已刪除，此留言已清空]",
        },
      }
    );

    // ✅ 清除通知
    await Notification.deleteMany({ imageId });

    // ✅ 刪除圖片記錄
    await Image.findByIdAndDelete(imageId);

    return NextResponse.json({ message: "圖片與留言刪除成功" });
  } catch (error) {
    console.error("伺服器錯誤：", error);
    return NextResponse.json({ message: "伺服器錯誤" }, { status: 500 });
  }
}
