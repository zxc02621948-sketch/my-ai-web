import { dbConnect } from "@/lib/db";
import Comment from "@/models/Comment";
import { verifyToken } from "@/lib/serverAuth";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

// ✅ Edge Runtime workaround
export async function DELETE(req, context) {
  await dbConnect();

  try {
    const commentId = (await context.params).commentId;

    const authHeader = req.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "未提供 token" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = await verifyToken(token);

    if (!decoded?.id) {
      return NextResponse.json({ message: "無效的 token" }, { status: 403 });
    }

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return NextResponse.json({ message: "無效的 commentId" }, { status: 400 });
    }

    const comment = await Comment.findById(commentId);

    if (!comment) {
      return NextResponse.json({ message: "找不到留言" }, { status: 404 });
    }

    const isOwner =
      comment.userId &&
      comment.userId.toString &&
      comment.userId.toString() === decoded.id.toString();
    const isAdmin = decoded.isAdmin === true;

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ message: "沒有刪除權限" }, { status: 403 });
    }

    // ✅ 新增：刪除所有回覆留言（children）
    await Comment.deleteMany({ parentCommentId: commentId });

    // ✅ 刪除主留言
    await Comment.findByIdAndDelete(commentId);

    return NextResponse.json({ message: "留言刪除成功" }, { status: 200 });
  } catch (err) {
    console.error("留言刪除錯誤：", err);
    return NextResponse.json({ message: "刪除留言失敗", error: err.message }, { status: 500 });
  }
}
