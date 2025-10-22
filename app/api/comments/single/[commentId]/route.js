import { dbConnect } from "@/lib/db";
import Comment from "@/models/Comment";
import { NextResponse } from "next/server";

/**
 * 獲取單個留言
 * GET /api/comments/single/[commentId]
 */
export async function GET(req, context) {
  try {
    await dbConnect();

    const params = await context.params;
    const commentId = params.commentId;

    if (!commentId) {
      return NextResponse.json(
        { error: "缺少留言 ID" },
        { status: 400 }
      );
    }

    const comment = await Comment.findById(commentId)
      .populate({
        path: "userId",
        select: "username image currentFrame frameSettings",
      })
      .lean();

    if (!comment) {
      return NextResponse.json(
        { error: "留言不存在" },
        { status: 404 }
      );
    }

    // 格式化返回數據
    const formattedComment = {
      _id: comment._id.toString(),
      text: comment.text,
      userId: comment.userId?._id?.toString() || null,
      userName: comment.userId?.username || "匿名用戶",
      userImage: comment.userId?.image || "/default-avatar.png",
      userFrame: comment.userId?.currentFrame || "default",
      imageId: comment.imageId,
      createdAt: comment.createdAt,
      parentCommentId: comment.parentCommentId,
    };

    return NextResponse.json({ comment: formattedComment });
  } catch (err) {
    console.error("獲取單個留言失敗:", err);
    return NextResponse.json(
      { error: "伺服器錯誤" },
      { status: 500 }
    );
  }
}


