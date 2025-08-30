// app/api/images/[id]/route.js
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import Image from "@/models/Image";
import { getCurrentUser } from "@/lib/serverAuth";
import { stripComfyIfNotAllowed } from "@/lib/sanitizeComfy";

export async function GET(_req, ctx) {
  try {
    await dbConnect();

    const { id } = (await ctx.params) || {};
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "無效的圖片 ID" }, { status: 400 });
    }

    const currentUser = await getCurrentUser().catch(() => null);

    const doc = await Image.findById(id)
      .populate({ path: "user", select: "_id username image isAdmin level" })
      .lean();

    if (!doc) {
      return NextResponse.json({ message: "找不到圖片" }, { status: 404 });
    }

    // 18+ 必須登入
    if (doc.rating === "18" && !currentUser) {
      return NextResponse.json({ message: "請登入以查看 18+ 圖片" }, { status: 401 });
    }

    const normalized = {
      ...doc,
      author: typeof doc.author === "string" ? doc.author : "",
      userId: doc.user?._id || null,
    };

    const isOwner = !!currentUser && String(normalized.user?._id) === String(currentUser._id);
    const isAdmin = !!currentUser?.isAdmin;
    const canEdit = !!currentUser && (isOwner || isAdmin);
    const isOwnerOrAdmin = isOwner || isAdmin;

    const sanitized = stripComfyIfNotAllowed(normalized, { isOwnerOrAdmin });

    return NextResponse.json({ image: sanitized, isOwner, canEdit });
  } catch (err) {
    console.error("❌ 取得圖片資料錯誤：", err);
    return NextResponse.json({ message: "伺服器錯誤" }, { status: 500 });
  }
}
