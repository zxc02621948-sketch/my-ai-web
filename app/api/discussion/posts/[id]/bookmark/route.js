import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getCurrentUserFromRequest } from "@/lib/serverAuth";
import DiscussionPost from "@/models/DiscussionPost";

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
    
    // 切换收藏状态
    const isBookmarked = post.isBookmarkedBy(currentUser._id);
    
    if (isBookmarked) {
      await post.removeBookmark(currentUser._id);
    } else {
      await post.addBookmark(currentUser._id);
    }
    
    const updatedPost = await DiscussionPost.findById(id)
      .populate("author", "username avatar")
      .populate("imageRef", "title imageId thumbnail")
      .lean();
    
    return NextResponse.json({
      success: true,
      data: updatedPost,
      isBookmarked: !isBookmarked,
      message: !isBookmarked ? "收藏成功" : "取消收藏成功"
    });
    
  } catch (error) {
    console.error("收藏操作失败:", error);
    return NextResponse.json(
      { success: false, error: "收藏操作失败" },
      { status: 500 }
    );
  }
}
