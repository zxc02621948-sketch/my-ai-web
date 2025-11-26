import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getCurrentUserFromRequest } from "@/lib/serverAuth";
import DiscussionPost from "@/models/DiscussionPost";
import Image from "@/models/Image";
import User from "@/models/User";
import PointsTransaction from "@/models/PointsTransaction";
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
    const rating = searchParams.get("rating");
    const excludeRating = searchParams.get("excludeRating");
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
    
    // 分級過濾
    if (rating) {
      // 只顯示指定分級（例如：只顯示 18+）
      query.rating = rating;
    } else if (excludeRating) {
      // 排除指定分級（例如：排除 18+）
      query.rating = { $ne: excludeRating };
    }
    
    // 排序选项（置頂帖子永遠在最前面，按 pinOrder 排序）
    // 注意：如果 pinOrder 為 0，需要按 pinnedAt 或 createdAt 排序
    let sortOption = { isPinned: -1, pinOrder: 1, createdAt: -1 };
    switch (sort) {
      case "popular":
        sortOption = { isPinned: -1, pinOrder: 1, likesCount: -1, commentsCount: -1, createdAt: -1 };
        break;
      case "oldest":
        sortOption = { isPinned: -1, pinOrder: 1, createdAt: 1 };
        break;
      case "most_commented":
        sortOption = { isPinned: -1, pinOrder: 1, commentsCount: -1, createdAt: -1 };
        break;
    }
    
    // 执行查询
    let posts = await DiscussionPost.find(query)
      .populate("author", "username image currentFrame frameSettings")
      .populate("imageRef", "title imageId")
      .sort(sortOption)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    
    // 手動處理置頂帖子的排序（確保 pinOrder 為 0 的帖子也能正確排序）
    const pinnedPosts = posts.filter(p => p.isPinned);
    const nonPinnedPosts = posts.filter(p => !p.isPinned);
    
    if (pinnedPosts.length > 0) {
      // 對置頂帖子進行手動排序
      pinnedPosts.sort((a, b) => {
        const aOrder = a.pinOrder || 0;
        const bOrder = b.pinOrder || 0;
        if (aOrder !== bOrder) return aOrder - bOrder;
        // 如果 pinOrder 相同或為 0，按 pinnedAt 或 createdAt 排序
        const aDate = a.pinnedAt || a.createdAt || new Date(0);
        const bDate = b.pinnedAt || b.createdAt || new Date(0);
        return new Date(aDate) - new Date(bDate);
      });
      
      // 合併：置頂帖子在前，非置頂帖子在後
      posts = [...pinnedPosts, ...nonPinnedPosts];
    }
    
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
    const rating = formData.get("rating") || "一般";
    const imageRefId = formData.get("imageRefId");
    
    // 獲取多圖上傳
    const uploadedImages = [];
    let imageIndex = 0;
    while (formData.has(`uploadedImages[${imageIndex}]`)) {
      uploadedImages.push(formData.get(`uploadedImages[${imageIndex}]`));
      imageIndex++;
    }
    
    // 验证必填字段
    if (!title || !content || !category) {
      return NextResponse.json(
        { success: false, error: "標題、內容和分類都是必填的" },
        { status: 400 }
      );
    }
    
    // 验证分类
    const validCategories = ["announcement", "technical", "showcase", "question", "tutorial", "general"];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { success: false, error: "無效的分類" },
        { status: 400 }
      );
    }
    
    // 檢查官方公告權限（只有管理員可以發布）
    if (category === "announcement") {
      if (currentUser.role !== 'admin' && !currentUser.isAdmin) {
        return NextResponse.json(
          { success: false, error: "只有管理員可以發布官方公告" },
          { status: 403 }
        );
      }
    }
    
    // 檢查圖片數量限制
    if (uploadedImages.length > 9) {
      return NextResponse.json(
        { success: false, error: "最多只能上傳 9 張圖片" },
        { status: 400 }
      );
    }
    
    // 計算積分消耗
    let pointsCost = 0;
    const imageCount = uploadedImages.length;
    if (imageCount >= 2 && imageCount <= 5) {
      pointsCost = 5;
    } else if (imageCount >= 6) {
      pointsCost = 10;
    }
    
    // 檢查積分是否足夠
    if (pointsCost > 0) {
      const user = await User.findById(currentUser._id);
      if (!user) {
        return NextResponse.json(
          { success: false, error: "用戶不存在" },
          { status: 404 }
        );
      }
      
      if (user.pointsBalance < pointsCost) {
        return NextResponse.json(
          { 
            success: false, 
            error: `積分不足！需要 ${pointsCost} 積分，當前僅有 ${user.pointsBalance} 積分`,
            suggestion: "簽到、上傳作品或參與互動來獲得積分"
          },
          { status: 400 }
        );
      }
      
      // 檢查每日多圖帖發布限制
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dailyMultiImagePosts = await DiscussionPost.countDocuments({
        author: currentUser._id,
        imageCount: { $gte: 2 },
        createdAt: { $gte: today }
      });
      
      if (dailyMultiImagePosts >= 5) {
        return NextResponse.json(
          { 
            success: false, 
            error: "今日多圖帖發布數量已達上限（5個）",
            suggestion: "明天再來發布，或升級為 VIP 解除限制"
          },
          { status: 429 }
        );
      }
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
    
    // 处理多圖上傳
    const uploadedImagesData = [];
    if (uploadedImages.length > 0) {
      for (let i = 0; i < uploadedImages.length; i++) {
        const file = uploadedImages[i];
        if (file && file.size > 0) {
          try {
            const uploadResult = await uploadToCloudflare(file);
            if (uploadResult.success) {
              uploadedImagesData.push({
                url: uploadResult.url,
                imageId: uploadResult.imageId,
                fileName: file.name,
                fileSize: file.size,
                width: uploadResult.width,
                height: uploadResult.height,
                order: i
              });
            } else {
              return NextResponse.json(
                { success: false, error: `圖片 ${i + 1} 上傳失敗` },
                { status: 500 }
              );
            }
          } catch (uploadError) {
            console.error(`圖片 ${i + 1} 上傳錯誤:`, uploadError);
            return NextResponse.json(
              { success: false, error: `圖片 ${i + 1} 上傳失敗` },
              { status: 500 }
            );
          }
        }
      }
    }
    
    // 创建帖子
    const post = new DiscussionPost({
      title: title.trim(),
      content: content.trim(),
      category,
      rating,
      author: currentUser._id,
      authorName: currentUser.username,
      imageRef,
      uploadedImages: uploadedImagesData,
      imageCount: uploadedImagesData.length,
      pointsCost
    });
    
    console.log('📝 [討論區] 準備保存帖子:', {
      title: post.title,
      category: post.category,
      author: post.authorName,
      hasImageRef: !!imageRef,
      imageCount: uploadedImagesData.length,
      pointsCost
    });
    
    await post.save();
    
    // 扣除積分（如果需要）
    if (pointsCost > 0) {
      const user = await User.findById(currentUser._id);
      user.pointsBalance -= pointsCost;
      await user.save();
      
      // 記錄積分交易
      const dateKey = new Date().toISOString().split('T')[0];
      await PointsTransaction.create({
        userId: currentUser._id,
        type: 'discussion_post_cost',
        points: -pointsCost,
        sourceId: post._id,
        dateKey,
        meta: {
          postTitle: post.title,
          imageCount: uploadedImagesData.length
        }
      });
      
      console.log(`💰 [討論區] 扣除積分: ${currentUser.username} -${pointsCost} 積分（多圖教學帖）`);
    }
    
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
      pointsCost,
      message: pointsCost > 0 ? `帖子創建成功！已消耗 ${pointsCost} 積分` : "帖子創建成功"
    });
    
  } catch (error) {
    console.error("創建帖子失敗:", error);
    return NextResponse.json(
      { success: false, error: `創建帖子失敗: ${error.message}` },
      { status: 500 }
    );
  }
}
