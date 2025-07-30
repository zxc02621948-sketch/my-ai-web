import { dbConnect } from "@/lib/db";
import Comment from "@/models/Comment";
import { verifyToken } from "@/lib/serverAuth";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

export async function DELETE(req, { params }) {
  await dbConnect();

  const { commentId } = params;
  const authHeader = req.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ message: "未提供 token" }, { status: 401 });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ message: "無效的 token" }, { status: 403 });
    }

    // 驗證是否為合法 Mongo ObjectId
    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return NextResponse.json({ message: "無效的 commentId" }, { status: 400 });
    }

    const deletedComment = await Comment.findByIdAndDelete(commentId);

    if (!deletedComment) {
      return NextResponse.json({ message: "找不到留言" }, { status: 404 });
    }

    return NextResponse.json({ message: "留言刪除成功" });
  } catch (err) {
    console.error("留言刪除錯誤：", err);
    return NextResponse.json({ message: "刪除留言失敗", error: err.message }, { status: 500 });
  }
}
