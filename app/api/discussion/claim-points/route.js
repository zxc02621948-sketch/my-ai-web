import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getCurrentUserFromRequest } from "@/lib/serverAuth";
import DiscussionPost from "@/models/DiscussionPost";
import User from "@/models/User";
import PointsTransaction from "@/models/PointsTransaction";

// 提領積分（全部多圖教學帖）
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
    
    const body = await req.json().catch(() => ({}));
    const { postId } = body; // 如果提供 postId，則只提領單個帖子
    
    const user = await User.findById(currentUser._id);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "用戶不存在" },
        { status: 404 }
      );
    }

    // 檢查是否達到最低提領門檻（5個愛心）- 管理員例外
    const pendingPoints = user.discussionPendingPoints || 0;
    if (pendingPoints < 5 && !currentUser.isAdmin) {
      return NextResponse.json({ 
        success: false, 
        error: `需要累積至少 5 個愛心才能提領，目前只有 ${pendingPoints} 個` 
      });
    }
    
    let totalClaimed = 0;
    let claimedPosts = [];
    
    if (postId) {
      // 單個帖子提領
      const post = await DiscussionPost.findById(postId);
      if (!post) {
        return NextResponse.json(
          { success: false, error: "帖子不存在" },
          { status: 404 }
        );
      }
      
      if (post.author.toString() !== currentUser._id.toString()) {
        return NextResponse.json(
          { success: false, error: "只能提領自己的帖子收益" },
          { status: 403 }
        );
      }
      
      if (post.pendingPoints <= 0) {
        return NextResponse.json(
          { success: false, error: "沒有待領取的積分" },
          { status: 400 }
        );
      }
      
      totalClaimed = post.pendingPoints;
      post.claimedPoints = (post.claimedPoints || 0) + post.pendingPoints;
      post.lastClaimedAt = new Date();
      post.pendingPoints = 0;
      await post.save();
      
      claimedPosts.push({
        postId: post._id,
        title: post.title,
        amount: totalClaimed
      });
      
    } else {
      // 全部提領
      const posts = await DiscussionPost.find({
        author: currentUser._id,
        pendingPoints: { $gt: 0 }
      });
      
      if (posts.length === 0) {
        return NextResponse.json(
          { success: false, error: "沒有待領取的積分" },
          { status: 400 }
        );
      }
      
      for (const post of posts) {
        const amount = post.pendingPoints;
        totalClaimed += amount;
        
        post.claimedPoints = (post.claimedPoints || 0) + amount;
        post.lastClaimedAt = new Date();
        post.pendingPoints = 0;
        await post.save();
        
        claimedPosts.push({
          postId: post._id,
          title: post.title,
          amount
        });
      }
    }
    
    // 更新用戶積分
    user.pointsBalance += totalClaimed;
    user.totalEarnedPoints = (user.totalEarnedPoints || 0) + totalClaimed;
    user.discussionPendingPoints = Math.max(0, (user.discussionPendingPoints || 0) - totalClaimed);
    await user.save();
    
    // 記錄積分交易
    const dateKey = new Date().toISOString().split('T')[0];
    await PointsTransaction.create({
      userId: currentUser._id,
      type: 'discussion_claim_reward',
      points: totalClaimed,
      sourceId: postId || null,
      dateKey,
      meta: {
        action: 'claim',
        postsCount: claimedPosts.length,
        posts: claimedPosts
      }
    });
    
    console.log(`💰 [討論區] 提領成功: ${user.username} +${totalClaimed} 積分（來自 ${claimedPosts.length} 個帖子）`);
    
    return NextResponse.json({
      success: true,
      claimed: totalClaimed,
      postsCount: claimedPosts.length,
      claimedPosts,
      newBalance: user.pointsBalance,
      remainingPending: user.discussionPendingPoints,
      message: `成功提領 ${totalClaimed} 積分！`
    });
    
  } catch (error) {
    console.error("提領積分失敗:", error);
    return NextResponse.json(
      { success: false, error: "提領積分失敗" },
      { status: 500 }
    );
  }
}

