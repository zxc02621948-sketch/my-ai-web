/**
 * 遷移討論區點讚數據到新的累積提領系統
 * 將現有的 likes 轉換為 rewardedUsers 和 pendingPoints
 */

import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://cvb120g:j3j79ru06@my-ai-web.9ugvdto.mongodb.net/myaiweb?retryWrites=true&w=majority&appName=my-ai-web';

const DiscussionPostSchema = new mongoose.Schema({}, { strict: false });
const UserSchema = new mongoose.Schema({}, { strict: false });

async function migrateDiscussionLikes() {
  try {
    console.log('🔄 開始遷移討論區點讚數據...\n');
    
    await mongoose.connect(MONGODB_URI, { dbName: 'myaiweb' });
    console.log('✅ 已連接到數據庫\n');
    
    const DiscussionPost = mongoose.model('DiscussionPost', DiscussionPostSchema, 'discussionposts');
    const User = mongoose.model('User', UserSchema, 'users');
    
    // 查找所有多圖教學帖
    const multiImagePosts = await DiscussionPost.find({
      imageCount: { $gte: 2 },
      pointsCost: { $gt: 0 }
    });
    
    console.log(`📊 找到 ${multiImagePosts.length} 個多圖教學帖\n`);
    
    let migratedPosts = 0;
    let totalPendingPoints = 0;
    const authorPendingMap = new Map(); // 記錄每個作者的待領取積分
    
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
        
        console.log(`✅ 遷移帖子: ${post.title}`);
        console.log(`   新增待領取: +${validNewLikes.length} 積分`);
        console.log(`   總待領取: ${post.pendingPoints}`);
        console.log(`   已領取: ${post.claimedPoints || 0}\n`);
      }
    }
    
    // 更新作者的 discussionPendingPoints
    console.log('📊 更新作者的待領取積分...\n');
    
    for (const [authorId, pendingPoints] of authorPendingMap.entries()) {
      const author = await User.findById(authorId);
      if (author) {
        author.discussionPendingPoints = (author.discussionPendingPoints || 0) + pendingPoints;
        await author.save();
        
        console.log(`✅ 更新作者: ${author.username}`);
        console.log(`   待領取積分: ${author.discussionPendingPoints}\n`);
      }
    }
    
    console.log('🎉 遷移完成！\n');
    console.log('📊 遷移統計:');
    console.log(`   處理帖子數: ${migratedPosts}`);
    console.log(`   累積待領取積分: ${totalPendingPoints}`);
    console.log(`   受影響作者: ${authorPendingMap.size}\n`);
    
    console.log('💡 提示: 現在用戶可以前往個人頁面提領積分！');
    
  } catch (error) {
    console.error('❌ 遷移失敗:', error);
  } finally {
    await mongoose.disconnect();
  }
}

migrateDiscussionLikes();

