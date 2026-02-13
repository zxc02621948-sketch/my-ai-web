import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getCurrentUserFromRequest } from "@/lib/serverAuth";
import DiscussionPost from "@/models/DiscussionPost";
import DiscussionComment from "@/models/DiscussionComment";
import User from "@/models/User";
import { sanitizePostContent, sanitizeTitle } from "@/lib/sanitizeUserContent";

// 获取单个帖子详情
export async function GET(req, { params }) {
  try {
    await dbConnect();
    
    const { id } = await params;
    
    const post = await DiscussionPost.findById(id)
      .populate("author", "username image currentFrame frameSettings")
      .populate("imageRef", "title imageId")
      .lean();
    
    if (!post) {
      return NextResponse.json(
        { success: false, error: "帖子不存在" },
        { status: 404 }
      );
    }
    
    // 增加浏览量
    await DiscussionPost.findByIdAndUpdate(id, { $inc: { viewCount: 1 } });
    
    // 檢查當前用戶是否收藏了這個帖子
    const currentUser = await getCurrentUserFromRequest(req);
    if (currentUser) {
      const user = await User.findById(currentUser._id).select('bookmarkedDiscussionPosts').lean();
      if (user && user.bookmarkedDiscussionPosts) {
        post.isBookmarkedByCurrentUser = user.bookmarkedDiscussionPosts.some(
          bookmarkId => bookmarkId.toString() === id.toString()
        );
      }
    }
    
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
    
    // 支援 FormData 和 JSON 兩種格式
    let title, content, category, imageRefId, uploadedImage;
    
    const contentType = req.headers.get('content-type');
    if (contentType && contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      title = formData.get('title');
      content = formData.get('content');
      category = formData.get('category');
      imageRefId = formData.get('imageRefId');
      uploadedImage = formData.get('uploadedImage');
    } else {
      const body = await req.json();
      title = body.title;
      content = body.content;
      category = body.category;
      imageRefId = body.imageRefId;
      uploadedImage = body.uploadedImage;
    }
    
    const post = await DiscussionPost.findById(id);
    if (!post) {
      return NextResponse.json(
        { success: false, error: "帖子不存在" },
        { status: 404 }
      );
    }
    
    // 检查权限：作者或管理員可以編輯
    const isAuthor = post.author.toString() === currentUser._id.toString();
    const isAdmin = currentUser.role === 'admin' || currentUser.isAdmin;
    
    if (!isAuthor && !isAdmin) {
      return NextResponse.json(
        { success: false, error: "無權限修改此帖子" },
        { status: 403 }
      );
    }
    
    // 驗證分類
    const validCategories = ["announcement", "technical", "showcase", "question", "tutorial", "general"];
    if (category && !validCategories.includes(category)) {
      return NextResponse.json(
        { success: false, error: "無效的分類" },
        { status: 400 }
      );
    }
    
    // 處理圖片引用
    let imageRef = null;
    if (imageRefId) {
      const Image = (await import('@/models/Image')).default;
      const image = await Image.findById(imageRefId);
      if (!image) {
        return NextResponse.json(
          { success: false, error: "引用的圖片不存在" },
          { status: 400 }
        );
      }
      imageRef = imageRefId;
    }
    
    // 處理上傳的圖片
    let uploadedImageData = null;
    if (uploadedImage && uploadedImage.size && uploadedImage.size > 0) {
      try {
        console.log("🔧 [編輯] 開始上傳圖片:", { 
          fileName: uploadedImage.name, 
          size: uploadedImage.size,
          type: uploadedImage.type 
        });
        
        const { uploadToCloudflare } = await import('@/lib/uploadToCloudflare');
        const uploadResult = await uploadToCloudflare(uploadedImage);
        
        console.log("🔧 [編輯] 上傳結果:", uploadResult);
        
        if (uploadResult.success) {
          uploadedImageData = {
            url: uploadResult.url,
            imageId: uploadResult.imageId,
            fileName: uploadedImage.name,
            fileSize: uploadedImage.size,
            width: uploadResult.width,
            height: uploadResult.height
          };
        } else {
          console.error("❌ [編輯] 上傳失敗:", uploadResult.error);
          return NextResponse.json(
            { success: false, error: `圖片上傳失敗: ${uploadResult.error}` },
            { status: 500 }
          );
        }
      } catch (uploadError) {
        console.error("❌ [編輯] 圖片上傳錯誤:", uploadError);
        return NextResponse.json(
          { success: false, error: `圖片上傳失敗: ${uploadError.message}` },
          { status: 500 }
        );
      }
    } else if (uploadedImage && uploadedImage.size === 0) {
      console.log("🔧 [編輯] 跳過空文件上傳");
    }
    
    // 更新帖子（儲存前清洗）
    if (typeof title === "string") {
      const safeTitle = sanitizeTitle(title);
      if (!safeTitle) {
        return NextResponse.json(
          { success: false, error: "標題不可為空" },
          { status: 400 }
        );
      }
      post.title = safeTitle;
    }
    if (typeof content === "string") {
      const safeContent = sanitizePostContent(content);
      if (!safeContent) {
        return NextResponse.json(
          { success: false, error: "內容不可為空" },
          { status: 400 }
        );
      }
      post.content = safeContent;
    }
    if (category) post.category = category;
    if (imageRef !== null) post.imageRef = imageRef; // 允許清除圖片引用
    if (uploadedImageData !== null) post.uploadedImage = uploadedImageData; // 允許清除上傳圖片
    
    await post.save();
    
    const updatedPost = await DiscussionPost.findById(id)
      .populate("author", "username image currentFrame")
      .populate("imageRef", "title imageId")
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
