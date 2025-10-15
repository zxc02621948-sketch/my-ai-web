import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getCurrentUserFromRequest } from "@/lib/serverAuth";
import DiscussionPost from "@/models/DiscussionPost";
import Image from "@/models/Image";
import { uploadToCloudflare } from "@/lib/uploadToCloudflare";

// 获取帖子列表
export async function GET(req) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || 10;
    const category = searchParams.get("category") || "all";
    const search = searchParams.get("search") || "";
    const sort = searchParams.get("sort") || "newest";
    
    // 构建查询条件
    const query = {};
    
    // 分类筛选
    if (category !== "all") {
      query.category = category;
    }
    
    // 搜索筛选
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { content: { $regex: search, $options: "i" } },
        { authorName: { $regex: search, $options: "i" } }
      ];
    }
    
    // 排序选项
    let sortOption = { createdAt: -1 };
    switch (sort) {
      case "popular":
        sortOption = { likesCount: -1, commentsCount: -1, createdAt: -1 };
        break;
      case "oldest":
        sortOption = { createdAt: 1 };
        break;
      case "most_commented":
        sortOption = { commentsCount: -1, createdAt: -1 };
        break;
    }
    
    // 执行查询
    const posts = await DiscussionPost.find(query)
      .populate("author", "username image currentFrame")
      .populate("imageRef", "title imageId")
      .sort(sortOption)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    
    // 获取总数
    const total = await DiscussionPost.countDocuments(query);
    
    return NextResponse.json({
      success: true,
      data: posts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error("获取帖子列表失败:", error);
    return NextResponse.json(
      { success: false, error: "获取帖子列表失败" },
      { status: 500 }
    );
  }
}

// 创建新帖子
export async function POST(req) {
  try {
    await dbConnect();
    
    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: "請先登入" },
        { status: 401 }
      );
    }
    
    const formData = await req.formData();
    const title = formData.get("title");
    const content = formData.get("content");
    const category = formData.get("category");
    const imageRefId = formData.get("imageRefId");
    const uploadedImage = formData.get("uploadedImage");
    
    // 验证必填字段
    if (!title || !content || !category) {
      return NextResponse.json(
        { success: false, error: "標題、內容和分類都是必填的" },
        { status: 400 }
      );
    }
    
    // 验证分类
    const validCategories = ["technical", "showcase", "question", "tutorial", "general"];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { success: false, error: "無效的分類" },
        { status: 400 }
      );
    }
    
    // 处理图片引用
    let imageRef = null;
    if (imageRefId) {
      const image = await Image.findById(imageRefId);
      if (!image) {
        return NextResponse.json(
          { success: false, error: "引用的圖片不存在" },
          { status: 400 }
        );
      }
      imageRef = imageRefId;
    }
    
    // 处理上传的图片
    let uploadedImageData = null;
    if (uploadedImage && uploadedImage.size > 0) {
      try {
        const uploadResult = await uploadToCloudflare(uploadedImage);
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
          return NextResponse.json(
            { success: false, error: "圖片上傳失敗" },
            { status: 500 }
          );
        }
      } catch (uploadError) {
        console.error("圖片上傳錯誤:", uploadError);
        return NextResponse.json(
          { success: false, error: "圖片上傳失敗" },
          { status: 500 }
        );
      }
    }
    
    // 创建帖子
    const post = new DiscussionPost({
      title: title.trim(),
      content: content.trim(),
      category,
      author: currentUser._id,
      authorName: currentUser.username,
      imageRef,
      uploadedImage: uploadedImageData
    });
    
    console.log('📝 [討論區] 準備保存帖子:', {
      title: post.title,
      category: post.category,
      author: post.authorName,
      hasImageRef: !!imageRef,
      hasUploadedImage: !!uploadedImageData
    });
    
    await post.save();
    
    console.log('✅ [討論區] 帖子已保存到數據庫，ID:', post._id);
    
    // 返回创建的帖子
    const createdPost = await DiscussionPost.findById(post._id)
      .populate("author", "username image currentFrame")
      .populate("imageRef", "title imageId")
      .lean();
    
    console.log('✅ [討論區] 帖子創建成功，返回數據');
    
    return NextResponse.json({
      success: true,
      data: createdPost,
      message: "帖子創建成功"
    });
    
  } catch (error) {
    console.error("創建帖子失敗:", error);
    return NextResponse.json(
      { success: false, error: "創建帖子失敗" },
      { status: 500 }
    );
  }
}
