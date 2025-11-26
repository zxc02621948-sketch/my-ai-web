import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getCurrentUserFromRequest } from "@/lib/serverAuth";
import DiscussionPost from "@/models/DiscussionPost";

// 置頂/取消置頂帖子
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
    const { action } = await req.json(); // 'pin' or 'unpin'
    
    const post = await DiscussionPost.findById(id);
    if (!post) {
      return NextResponse.json(
        { success: false, error: "帖子不存在" },
        { status: 404 }
      );
    }
    
    if (action === 'pin') {
      // 置頂 - 設置為最大的 pinOrder + 1（放在最後）
      const maxPinOrder = await DiscussionPost.findOne({ isPinned: true })
        .sort({ pinOrder: -1 })
        .select('pinOrder')
        .lean();
      const newPinOrder = maxPinOrder ? maxPinOrder.pinOrder + 1 : 1;
      
      post.isPinned = true;
      post.pinOrder = newPinOrder;
      post.pinnedAt = new Date();
      post.pinnedBy = currentUser._id;
      await post.save();
      
      console.log(`📌 [討論區] 帖子已置頂: ${post.title} (by 管理員: ${currentUser.username})`);
      
      return NextResponse.json({
        success: true,
        message: "帖子已置頂",
        isPinned: true
      });
    } else if (action === 'unpin') {
      // 取消置頂
      post.isPinned = false;
      post.pinOrder = 0;
      post.pinnedAt = null;
      post.pinnedBy = null;
      await post.save();
      
      console.log(`📍 [討論區] 取消置頂: ${post.title} (by 管理員: ${currentUser.username})`);
      
      return NextResponse.json({
        success: true,
        message: "已取消置頂",
        isPinned: false
      });
    } else {
      return NextResponse.json(
        { success: false, error: "無效的操作" },
        { status: 400 }
      );
    }
    
  } catch (error) {
    console.error("置頂操作失敗:", error);
    return NextResponse.json(
      { success: false, error: "操作失敗" },
      { status: 500 }
    );
  }
}

