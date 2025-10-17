import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getCurrentUserFromRequest } from "@/lib/serverAuth";
import DiscussionPost from "@/models/DiscussionPost";
import User from "@/models/User";

/**
 * 遷移討論區點讚數據到新的累積提領系統
 * 僅限管理員使用
 */
export async function POST(req) {
  try {
    await dbConnect();
    
    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser || (currentUser.role !== 'admin' && !currentUser.isAdmin)) {
      return NextResponse.json(
        { success: false, error: "僅限管理員操作" },
        { status: 403 }
      );
    }
    
    console.log('🔄 [遷移] 開始遷移討論區點讚數據...');
    
    // 查找所有多圖教學帖
    const multiImagePosts = await DiscussionPost.find({
      imageCount: { $gte: 2 },
      pointsCost: { $gt: 0 }
    });
    
    console.log(`📊 [遷移] 找到 ${multiImagePosts.length} 個多圖教學帖`);
    
    let migratedPosts = 0;
    let totalPendingPoints = 0;
    const authorPendingMap = new Map();
    
    for (const post of multiImagePosts) {
      const likes = post.likes || [];
      const rewardedUsers = post.rewardedUsers || [];
      
      // 找出新的點讚（在 likes 但不在 rewardedUsers）
      const newLikes = likes.filter(likeId => 
        !rewardedUsers.some(rewardedId => 
          String(rewardedId) === String(likeId)
        )
      );
      
      // 排除作者自己的點讚
      const validNewLikes = [];
      for (const likeId of newLikes) {
        if (String(likeId) !== String(post.author)) {
          validNewLikes.push(likeId);
        }
      }
      
      if (validNewLikes.length > 0) {
        // 更新帖子
        post.rewardedUsers = [...rewardedUsers, ...validNewLikes];
        post.pendingPoints = (post.pendingPoints || 0) + validNewLikes.length;
        await post.save();
        
        // 累計作者的待領取積分
        const authorId = String(post.author);
        authorPendingMap.set(
          authorId, 
          (authorPendingMap.get(authorId) || 0) + validNewLikes.length
        );
        
        migratedPosts++;
        totalPendingPoints += validNewLikes.length;
        
        console.log(`✅ [遷移] 帖子: ${post.title} -> +${validNewLikes.length} 積分`);
      }
    }
    
    // 更新作者的 discussionPendingPoints
    console.log(`📊 [遷移] 更新 ${authorPendingMap.size} 個作者的待領取積分...`);
    
    const authorUpdates = [];
    for (const [authorId, pendingPoints] of authorPendingMap.entries()) {
      const author = await User.findById(authorId);
      if (author) {
        author.discussionPendingPoints = (author.discussionPendingPoints || 0) + pendingPoints;
        await author.save();
        
        authorUpdates.push({
          username: author.username,
          pendingPoints: author.discussionPendingPoints
        });
        
        console.log(`✅ [遷移] 作者 ${author.username} -> 待領取 ${author.discussionPendingPoints} 積分`);
      }
    }
    
    console.log('🎉 [遷移] 遷移完成！');
    
    return NextResponse.json({
      success: true,
      message: '遷移完成！',
      stats: {
        totalPosts: multiImagePosts.length,
        migratedPosts,
        totalPendingPoints,
        affectedAuthors: authorPendingMap.size,
        authorUpdates
      }
    });
    
  } catch (error) {
    console.error('❌ [遷移] 遷移失敗:', error);
    return NextResponse.json(
      { success: false, error: `遷移失敗: ${error.message}` },
      { status: 500 }
    );
  }
}

