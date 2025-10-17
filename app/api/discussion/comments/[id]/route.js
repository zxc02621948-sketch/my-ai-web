import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getCurrentUserFromRequest } from "@/lib/serverAuth";
import DiscussionComment from "@/models/DiscussionComment";
import DiscussionPost from "@/models/DiscussionPost";

// 獲取單個評論
export async function GET(req, { params }) {
  try {
    await dbConnect();
    
    const { id } = await params;
    
    const comment = await DiscussionComment.findById(id)
      .populate('author', 'username avatar activeFrame')
      .lean();
    
    if (!comment) {
      return NextResponse.json(
        { success: false, error: "評論不存在" },
        { status: 404 }
      );
    }
    
    // 添加 authorName 和 postId 以便管理頁面使用
    return NextResponse.json({
      success: true,
      comment: {
        ...comment,
        authorName: comment.author?.username || '未知用戶',
        postId: comment.post // 評論所屬的帖子 ID
      }
    });
    
  } catch (error) {
    console.error("獲取評論失敗:", error);
    return NextResponse.json(
      { success: false, error: "獲取評論失敗" },
      { status: 500 }
    );
  }
}

// 刪除評論
export async function DELETE(req, { params }) {
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
    
    const comment = await DiscussionComment.findById(id);
    if (!comment) {
      return NextResponse.json(
        { success: false, error: "評論不存在" },
        { status: 404 }
      );
    }
    
    // 檢查權限：作者或管理員可以刪除
    const isAuthor = comment.author.toString() === currentUser._id.toString();
    const isAdmin = currentUser.role === 'admin';
    
    if (!isAuthor && !isAdmin) {
      return NextResponse.json(
        { success: false, error: "無權限刪除此評論" },
        { status: 403 }
      );
    }
    
    console.log(`🗑️ [討論區評論] 刪除評論 (by ${isAdmin ? '管理員' : '作者'}: ${currentUser.username})`);
    
    // 如果有回覆，也一併刪除
    if (comment.replies && comment.replies.length > 0) {
      await DiscussionComment.deleteMany({ _id: { $in: comment.replies } });
    }
    
    // 從父評論的 replies 中移除（如果是回覆）
    if (comment.parentCommentId) {
      await DiscussionComment.findByIdAndUpdate(
        comment.parentCommentId,
        { $pull: { replies: id } }
      );
    }
    
    // 從帖子的 comments 中移除
    await DiscussionPost.findByIdAndUpdate(
      comment.post,
      { 
        $pull: { comments: id },
        $inc: { commentsCount: -1 }
      }
    );
    
    // 刪除評論
    await DiscussionComment.findByIdAndDelete(id);
    
    return NextResponse.json({
      success: true,
      message: "評論刪除成功"
    });
    
  } catch (error) {
    console.error("刪除評論失敗:", error);
    return NextResponse.json(
      { success: false, error: "刪除評論失敗" },
      { status: 500 }
    );
  }
}

