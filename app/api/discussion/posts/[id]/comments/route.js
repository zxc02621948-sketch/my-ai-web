import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getCurrentUserFromRequest } from "@/lib/serverAuth";
import DiscussionPost from "@/models/DiscussionPost";
import DiscussionComment from "@/models/DiscussionComment";
import Notification from "@/models/Notification";
import User from "@/models/User";
import { sanitizePostContent } from "@/lib/sanitizeUserContent";

// 獲取帖子的所有評論
export async function GET(req, { params }) {
  try {
    await dbConnect();
    
    const { id } = await params;
    
    const comments = await DiscussionComment.find({ post: id, parentCommentId: null })
      .populate("author", "username image currentFrame frameSettings")
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
    const { content, parentCommentId, mentions, replyTo } = await req.json();
    
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
    
    const safeContent = sanitizePostContent(content);
    if (!safeContent) {
      return NextResponse.json(
        { success: false, error: "評論內容不能為空" },
        { status: 400 }
      );
    }

    // 創建評論
    const comment = new DiscussionComment({
      post: id,
      author: currentUser._id,
      authorName: currentUser.username,
      content: safeContent,
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
    
    // 處理 @ 提及通知
    if (mentions && mentions.length > 0) {
      for (const mention of mentions) {
        // 檢查被提及的用戶是否存在
        const mentionedUser = await User.findById(mention.userId);
        if (mentionedUser && mentionedUser._id.toString() !== currentUser._id.toString()) {
          // 創建通知
          const notification = new Notification({
            userId: mentionedUser._id,
            fromUserId: currentUser._id,
            type: 'discussion_mention',
            message: `在「${post.title}」中: ${safeContent.substring(0, 100)}${safeContent.length > 100 ? '...' : ''}`,
            link: `/discussion/${post._id}`,
            commentId: comment._id,
            text: `${currentUser.username} 在討論區提到了你`
          });
          
          await notification.save();
          console.log(`🔔 [提及通知] ${currentUser.username} 提及了 ${mention.username} 在討論區`);
        }
      }
    }
    
    // 如果是回覆別人的評論（不是提及），也發送通知
    if (replyTo && replyTo !== currentUser._id.toString()) {
      const replyToUser = await User.findById(replyTo);
      if (replyToUser) {
        const notification = new Notification({
          userId: replyToUser._id,
          fromUserId: currentUser._id,
          type: 'discussion_reply',
          message: `在「${post.title}」中: ${safeContent.substring(0, 100)}${safeContent.length > 100 ? '...' : ''}`,
          link: `/discussion/${post._id}`,
          commentId: comment._id,
          text: `${currentUser.username} 回覆了你的評論`
        });
        
        await notification.save();
        console.log(`🔔 [回覆通知] ${currentUser.username} 回覆了 ${replyToUser.username} 的評論`);
      }
    }
    
    // 返回創建的評論
    const createdComment = await DiscussionComment.findById(comment._id)
      .populate("author", "username image currentFrame frameSettings")
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

