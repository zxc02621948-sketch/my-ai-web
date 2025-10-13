import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getCurrentUserFromRequest } from "@/lib/serverAuth";
import DiscussionPost from "@/models/DiscussionPost";
import DiscussionComment from "@/models/DiscussionComment";

// 獲取帖子的所有評論
export async function GET(req, { params }) {
  try {
    await dbConnect();
    
    const { id } = await params;
    
    const comments = await DiscussionComment.find({ post: id, parentCommentId: null })
      .populate("author", "username image currentFrame")
      .populate({
        path: "replies",
        populate: { path: "author", select: "username image currentFrame" }
      })
      .sort({ createdAt: -1 })
      .lean();
    
    return NextResponse.json({
      success: true,
      data: comments
    });
    
  } catch (error) {
    console.error("獲取評論失敗:", error);
    return NextResponse.json(
      { success: false, error: "獲取評論失敗" },
      { status: 500 }
    );
  }
}

// 創建新評論
export async function POST(req, { params }) {
  try {
    await dbConnect();
    
    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: "請先登入" },
        { status: 401 }
      );
    }
    
    const { id } = await params;
    const { content, parentCommentId } = await req.json();
    
    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "評論內容不能為空" },
        { status: 400 }
      );
    }
    
    // 檢查帖子是否存在
    const post = await DiscussionPost.findById(id);
    if (!post) {
      return NextResponse.json(
        { success: false, error: "帖子不存在" },
        { status: 404 }
      );
    }
    
    // 創建評論
    const comment = new DiscussionComment({
      post: id,
      author: currentUser._id,
      authorName: currentUser.username,
      content: content.trim(),
      parentCommentId: parentCommentId || null
    });
    
    await comment.save();
    
    // 如果是回覆，添加到父評論的 replies
    if (parentCommentId) {
      await DiscussionComment.findByIdAndUpdate(
        parentCommentId,
        { $push: { replies: comment._id } }
      );
    }
    
    // 更新帖子的評論計數
    await DiscussionPost.findByIdAndUpdate(
      id,
      { $push: { comments: comment._id }, $inc: { commentsCount: 1 } }
    );
    
    // 返回創建的評論
    const createdComment = await DiscussionComment.findById(comment._id)
      .populate("author", "username image currentFrame")
      .lean();
    
    console.log(`💬 [討論區] 新評論: ${currentUser.username} -> 帖子 ${post.title}`);
    
    return NextResponse.json({
      success: true,
      data: createdComment,
      message: "評論成功"
    });
    
  } catch (error) {
    console.error("創建評論失敗:", error);
    return NextResponse.json(
      { success: false, error: "創建評論失敗" },
      { status: 500 }
    );
  }
}

