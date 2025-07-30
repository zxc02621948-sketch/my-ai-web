// /app/api/comments/[id]/route.js

import { connectToDatabase } from "@/lib/mongodb";
import Comment from "@/models/Comment";
import { NextResponse } from "next/server";

export async function GET(request) {
  await connectToDatabase();

  try {
    const pathname = request.nextUrl.pathname;
    const id = pathname.split("/").pop();

    const comments = await Comment.find({ imageId: id }).sort({ createdAt: 1 });
    return NextResponse.json(comments);
  } catch (error) {
    console.error("讀取留言失敗：", error);
    return NextResponse.json({ error: "讀取留言失敗" }, { status: 500 });
  }
}

export async function POST(request) {
  await connectToDatabase();

  try {
    const pathname = request.nextUrl.pathname;
    const id = pathname.split("/").pop();

    const body = await request.json();
    const { text, userId, userName, parentCommentId } = body;

    const newComment = await Comment.create({
      text,
      userId: userId || "匿名用戶",
      userName: userName || "匿名用戶",
      imageId: id,
      parentCommentId: parentCommentId || null, // ✅ 回覆功能重點
      createdAt: new Date(),
    });

    return NextResponse.json({ message: "留言已儲存", commentId: newComment._id });
  } catch (error) {
    console.error("新增留言失敗：", error);
    return NextResponse.json({ error: "新增留言失敗" }, { status: 500 });
  }
}
