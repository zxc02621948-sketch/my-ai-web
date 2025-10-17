import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getCurrentUserFromRequest } from "@/lib/serverAuth";
import DiscussionPost from "@/models/DiscussionPost";
import User from "@/models/User";

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
    
    const post = await DiscussionPost.findById(id);
    if (!post) {
      return NextResponse.json(
        { success: false, error: "帖子不存在" },
        { status: 404 }
      );
    }
    
    // 獲取用戶數據
    const user = await User.findById(currentUser._id);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "用戶不存在" },
        { status: 404 }
      );
    }
    
    // 切換收藏狀態
    const bookmarks = user.bookmarkedDiscussionPosts || [];
    const isBookmarked = bookmarks.some(
      bookmarkId => bookmarkId.toString() === id.toString()
    );
    
    if (isBookmarked) {
      // 取消收藏
      user.bookmarkedDiscussionPosts = bookmarks.filter(
        bookmarkId => bookmarkId.toString() !== id.toString()
      );
    } else {
      // 添加收藏
      user.bookmarkedDiscussionPosts = [...bookmarks, id];
    }
    
    await user.save();
    
    // 返回更新後的帖子（包含收藏狀態）
    const updatedPost = await DiscussionPost.findById(id)
      .populate("author", "username image currentFrame")
      .populate("imageRef", "title imageId")
      .lean();
    
    // 添加當前用戶的收藏狀態
    updatedPost.isBookmarkedByCurrentUser = !isBookmarked;
    
    return NextResponse.json({
      success: true,
      data: updatedPost,
      isBookmarked: !isBookmarked,
      message: isBookmarked ? "已取消收藏" : "已添加收藏"
    });
    
  } catch (error) {
    console.error("收藏操作失敗:", error);
    return NextResponse.json(
      { success: false, error: "收藏操作失敗" },
      { status: 500 }
    );
  }
}
