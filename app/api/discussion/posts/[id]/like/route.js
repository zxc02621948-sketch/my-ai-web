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
    
    // 切换点赞状态
    const isLiked = post.isLikedBy(currentUser._id);
    
    if (isLiked) {
      await post.removeLike(currentUser._id);
    } else {
      await post.addLike(currentUser._id);
    }
    
    const updatedPost = await DiscussionPost.findById(id)
      .populate("author", "username image currentFrame")
      .populate("imageRef", "title imageId")
      .lean();
    
    return NextResponse.json({
      success: true,
      data: updatedPost,
      isLiked: !isLiked,
      message: !isLiked ? "點讚成功" : "取消點讚成功"
    });
    
  } catch (error) {
    console.error("点赞操作失败:", error);
    return NextResponse.json(
      { success: false, error: "点赞操作失败" },
      { status: 500 }
    );
  }
}
