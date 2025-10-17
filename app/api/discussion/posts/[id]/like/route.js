import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getCurrentUserFromRequest } from "@/lib/serverAuth";
import DiscussionPost from "@/models/DiscussionPost";
import User from "@/models/User";
import PointsTransaction from "@/models/PointsTransaction";
import { creditPoints } from "@/services/pointsService";

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
    
    // 檢查是否為多圖教學帖（需要積分獎勵）
    const isMultiImagePost = post.imageCount >= 2 && post.pointsCost > 0;
    const postAuthorId = post.author.toString();
    
    // 🔄 自動遷移：將現有的 likes 轉換為 rewardedUsers（僅執行一次）
    if (isMultiImagePost && (!post.rewardedUsers || post.rewardedUsers.length === 0)) {
      const likes = post.likes || [];
      const validLikes = likes.filter(likeId => String(likeId) !== String(post.author));
      
      if (validLikes.length > 0) {
        post.rewardedUsers = validLikes;
        post.pendingPoints = validLikes.length;
        await post.save();
        
        // 更新作者的待領取積分
        const author = await User.findById(postAuthorId);
        if (author) {
          author.discussionPendingPoints = (author.discussionPendingPoints || 0) + validLikes.length;
          await author.save();
          console.log(`🔄 [自動遷移] 帖子「${post.title}」-> 累積 ${validLikes.length} 個待領取積分`);
        }
      }
    }
    
    
    if (isLiked) {
      // 取消點讚 - 只移除愛心，不扣除積分（認可不可撤回）
      await post.removeLike(currentUser._id);
    } else {
      // 點讚 - 累積待領取積分
      await post.addLike(currentUser._id);
      
      // 🎁 點讚者獲得積分（like_given，與圖片點讚共用每日 5 分上限）
      if (postAuthorId !== currentUser._id.toString()) {
        try {
          await creditPoints({ 
            userId: currentUser._id, 
            type: "like_given", 
            sourceId: post._id, 
            actorUserId: currentUser._id, 
            meta: { discussionPostId: post._id, discussionPostTitle: post.title } 
          });
        } catch (e) {
          console.warn("[討論區點讚] like_given 入帳失敗：", e);
        }
      }
      
      // 如果是多圖教學帖，累積待領取積分
      if (isMultiImagePost && postAuthorId !== currentUser._id.toString()) {
        // 檢查是否已經獎勵過這個用戶（防止重複累積）
        const alreadyRewarded = post.rewardedUsers?.some(
          userId => userId.toString() === currentUser._id.toString()
        );
        
        if (!alreadyRewarded) {
          // 第一次點讚，累積積分
          post.pendingPoints = (post.pendingPoints || 0) + 1;
          post.rewardedUsers = post.rewardedUsers || [];
          post.rewardedUsers.push(currentUser._id);
          await post.save();
          
          // 更新作者的總待領取積分
          const author = await User.findById(postAuthorId);
          if (author) {
            author.discussionPendingPoints = (author.discussionPendingPoints || 0) + 1;
            await author.save();
            
            console.log(`💰 [討論區] 累積獎勵: 待領取 +1 積分（總計 ${author.discussionPendingPoints}）`);
          }
        }
      }
    }
    
    const updatedPost = await DiscussionPost.findById(id)
      .populate("author", "username image currentFrame")
      .populate("imageRef", "title imageId")
      .lean();
    
    return NextResponse.json({
      success: true,
      data: updatedPost,
      isLiked: !isLiked,
      pointsRewarded: isMultiImagePost && postAuthorId !== currentUser._id.toString(),
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
