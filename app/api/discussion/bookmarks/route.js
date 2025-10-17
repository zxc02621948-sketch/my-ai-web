import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getCurrentUserFromRequest } from "@/lib/serverAuth";
import User from "@/models/User";
import DiscussionPost from "@/models/DiscussionPost";

export async function GET(req) {
  try {
    await dbConnect();
    
    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: "請先登入" },
        { status: 401 }
      );
    }
    
    // 獲取用戶的收藏列表
    const user = await User.findById(currentUser._id)
      .select('bookmarkedDiscussionPosts')
      .lean();
    
    if (!user || !user.bookmarkedDiscussionPosts || user.bookmarkedDiscussionPosts.length === 0) {
      return NextResponse.json({
        success: true,
        data: []
      });
    }
    
    // 獲取收藏的帖子詳細信息
    const posts = await DiscussionPost.find({
      _id: { $in: user.bookmarkedDiscussionPosts }
    })
      .populate("author", "username image currentFrame frameSettings")
      .populate("imageRef", "title imageId")
      .sort({ createdAt: -1 }) // 最新的排在前面
      .lean();
    
    // 添加收藏狀態（所有都是已收藏）
    const postsWithBookmarkStatus = posts.map(post => ({
      ...post,
      isBookmarkedByCurrentUser: true
    }));
    
    return NextResponse.json({
      success: true,
      data: postsWithBookmarkStatus
    });
    
  } catch (error) {
    console.error("獲取收藏列表失敗:", error);
    return NextResponse.json(
      { success: false, error: "獲取收藏列表失敗" },
      { status: 500 }
    );
  }
}

