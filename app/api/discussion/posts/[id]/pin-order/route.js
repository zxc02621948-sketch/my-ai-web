import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getCurrentUserFromRequest } from "@/lib/serverAuth";
import DiscussionPost from "@/models/DiscussionPost";

// 調整置頂帖子順序
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
    
    // 檢查是否為管理員
    if (currentUser.role !== 'admin' && !currentUser.isAdmin) {
      return NextResponse.json(
        { success: false, error: "無權限進行此操作" },
        { status: 403 }
      );
    }
    
    const { id } = await params;
    const { direction } = await req.json(); // 'up' or 'down'
    
    const post = await DiscussionPost.findById(id);
    if (!post) {
      return NextResponse.json(
        { success: false, error: "帖子不存在" },
        { status: 404 }
      );
    }
    
    if (!post.isPinned) {
      return NextResponse.json(
        { success: false, error: "此帖子未置頂" },
        { status: 400 }
      );
    }
    
    // 獲取所有置頂帖子，按 pinOrder 升序排序（pinOrder 小的在前）
    // 如果 pinOrder 為 0 或未設置，按 pinnedAt 或 createdAt 排序
    let pinnedPosts = await DiscussionPost.find({ isPinned: true })
      .select('_id pinOrder title pinnedAt createdAt')
      .lean();
    
    // 檢查是否有 pinOrder 為 0 的帖子，如果有則重新分配
    const needsReordering = pinnedPosts.some(p => !p.pinOrder || p.pinOrder === 0);
    if (needsReordering) {
      // 按 pinnedAt 或 createdAt 排序，然後重新分配 pinOrder
      pinnedPosts.sort((a, b) => {
        const aOrder = a.pinOrder || 0;
        const bOrder = b.pinOrder || 0;
        if (aOrder !== bOrder) return aOrder - bOrder;
        // 如果 pinOrder 相同，按 pinnedAt 或 createdAt 排序
        const aDate = a.pinnedAt || a.createdAt || new Date(0);
        const bDate = b.pinnedAt || b.createdAt || new Date(0);
        return new Date(aDate) - new Date(bDate);
      });
      
      // 重新分配 pinOrder（從 1 開始）
      for (let i = 0; i < pinnedPosts.length; i++) {
        const newOrder = i + 1;
        if (pinnedPosts[i].pinOrder !== newOrder) {
          await DiscussionPost.findByIdAndUpdate(pinnedPosts[i]._id, {
            pinOrder: newOrder
          });
          pinnedPosts[i].pinOrder = newOrder;
        }
      }
      
      // 重新獲取當前帖子（因為 pinOrder 可能已更新）
      const updatedPost = await DiscussionPost.findById(id);
      if (updatedPost) {
        post.pinOrder = updatedPost.pinOrder;
      }
    } else {
      // 如果都有 pinOrder，直接按 pinOrder 排序
      pinnedPosts.sort((a, b) => (a.pinOrder || 0) - (b.pinOrder || 0));
    }
    
    const currentIndex = pinnedPosts.findIndex(p => p._id.toString() === id);
    
    if (currentIndex === -1) {
      return NextResponse.json(
        { success: false, error: "找不到帖子位置" },
        { status: 400 }
      );
    }
    
    if (direction === 'up') {
      // 上移：在列表中位置更靠前（pinOrder 減小），與前一個交換
      if (currentIndex === 0) {
        return NextResponse.json(
          { success: false, error: "已經是最前面了" },
          { status: 400 }
        );
      }
      
      const prevPost = pinnedPosts[currentIndex - 1];
      const tempOrder = post.pinOrder;
      post.pinOrder = prevPost.pinOrder;
      
      await DiscussionPost.findByIdAndUpdate(prevPost._id, {
        pinOrder: tempOrder
      });
      await post.save();
      
    } else if (direction === 'down') {
      // 下移：在列表中位置更靠後（pinOrder 增大），與後一個交換
      if (currentIndex === pinnedPosts.length - 1) {
        return NextResponse.json(
          { success: false, error: "已經是最後面了" },
          { status: 400 }
        );
      }
      
      const nextPost = pinnedPosts[currentIndex + 1];
      const tempOrder = post.pinOrder;
      post.pinOrder = nextPost.pinOrder;
      
      await DiscussionPost.findByIdAndUpdate(nextPost._id, {
        pinOrder: tempOrder
      });
      await post.save();
      
    } else {
      return NextResponse.json(
        { success: false, error: "無效的方向參數" },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: direction === 'up' ? "已上移" : "已下移",
      pinOrder: post.pinOrder
    });
    
  } catch (error) {
    console.error("調整置頂順序失敗:", error);
    return NextResponse.json(
      { success: false, error: "操作失敗" },
      { status: 500 }
    );
  }
}

