import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getCurrentUserFromRequest } from "@/lib/serverAuth";
import DiscussionPost from "@/models/DiscussionPost";
import DiscussionComment from "@/models/DiscussionComment";

// 获取单个帖子详情
export async function GET(req, { params }) {
  try {
    await dbConnect();
    
    const { id } = await params;
    
    const post = await DiscussionPost.findById(id)
      .populate("author", "username avatar")
      .populate("imageRef", "title imageId thumbnail")
      .lean();
    
    if (!post) {
      return NextResponse.json(
        { success: false, error: "帖子不存在" },
        { status: 404 }
      );
    }
    
    // 增加浏览量
    await DiscussionPost.findByIdAndUpdate(id, { $inc: { viewCount: 1 } });
    
    return NextResponse.json({
      success: true,
      data: post
    });
    
  } catch (error) {
    console.error("获取帖子详情失败:", error);
    return NextResponse.json(
      { success: false, error: "获取帖子详情失败" },
      { status: 500 }
    );
  }
}

// 更新帖子
export async function PUT(req, { params }) {
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
    const { title, content, category } = await req.json();
    
    const post = await DiscussionPost.findById(id);
    if (!post) {
      return NextResponse.json(
        { success: false, error: "帖子不存在" },
        { status: 404 }
      );
    }
    
    // 检查权限
    if (post.author.toString() !== currentUser._id.toString()) {
      return NextResponse.json(
        { success: false, error: "無權限修改此帖子" },
        { status: 403 }
      );
    }
    
    // 更新帖子
    if (title) post.title = title.trim();
    if (content) post.content = content.trim();
    if (category) post.category = category;
    
    await post.save();
    
    const updatedPost = await DiscussionPost.findById(id)
      .populate("author", "username avatar")
      .populate("imageRef", "title imageId thumbnail")
      .lean();
    
    return NextResponse.json({
      success: true,
      data: updatedPost,
      message: "帖子更新成功"
    });
    
  } catch (error) {
    console.error("更新帖子失败:", error);
    return NextResponse.json(
      { success: false, error: "更新帖子失败" },
      { status: 500 }
    );
  }
}

// 删除帖子
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
    
    const post = await DiscussionPost.findById(id);
    if (!post) {
      return NextResponse.json(
        { success: false, error: "帖子不存在" },
        { status: 404 }
      );
    }
    
    // 检查权限：作者或管理員可以刪除
    const isAuthor = post.author.toString() === currentUser._id.toString();
    const isAdmin = currentUser.role === 'admin';
    
    if (!isAuthor && !isAdmin) {
      return NextResponse.json(
        { success: false, error: "無權限刪除此帖子" },
        { status: 403 }
      );
    }
    
    console.log(`🗑️ [討論區] 刪除帖子: ${post.title} (by ${isAdmin ? '管理員' : '作者'}: ${currentUser.username})`);

    
    // 删除相关评论
    await DiscussionComment.deleteMany({ post: id });
    
    // 删除帖子
    await DiscussionPost.findByIdAndDelete(id);
    
    return NextResponse.json({
      success: true,
      message: "帖子刪除成功"
    });
    
  } catch (error) {
    console.error("删除帖子失败:", error);
    return NextResponse.json(
      { success: false, error: "删除帖子失败" },
      { status: 500 }
    );
  }
}
