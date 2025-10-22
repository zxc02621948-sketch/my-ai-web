// scripts/sync-comments-count.js
// 為所有圖片同步 commentsCount 並重新計算 popScore

import { dbConnect } from '../lib/db.js';
import Image from '../models/Image.js';
import Comment from '../models/Comment.js';
import { computePopScore } from '../utils/score.js';

async function syncCommentsCount() {
  await dbConnect();
  
  console.log('🔍 開始同步留言數...\n');
  
  // 獲取所有圖片
  const images = await Image.find({}).lean();
  console.log(`找到 ${images.length} 張圖片\n`);
  
  let updated = 0;
  
  for (const image of images) {
    const oldCommentsCount = image.commentsCount || 0;
    const oldPopScore = image.popScore || 0;
    
    // 計算實際留言數
    const actualCommentsCount = await Comment.countDocuments({ imageId: image._id.toString() });
    
    // 重新計算 popScore
    const imageWithComments = {
      ...image,
      commentsCount: actualCommentsCount
    };
    const newPopScore = computePopScore(imageWithComments);
    
    // 只有當數據有變化時才更新
    if (oldCommentsCount !== actualCommentsCount || Math.abs(oldPopScore - newPopScore) > 0.01) {
      await Image.updateOne(
        { _id: image._id },
        {
          $set: {
            commentsCount: actualCommentsCount,
            popScore: newPopScore
          }
        }
      );
      
      updated++;
      
      console.log(`✅ [${updated}/${images.length}] ${image.title}`);
      console.log(`   留言數: ${oldCommentsCount} → ${actualCommentsCount}`);
      console.log(`   popScore: ${oldPopScore.toFixed(2)} → ${newPopScore.toFixed(2)}`);
      
      if (actualCommentsCount > 0) {
        console.log(`   分數增加: +${((actualCommentsCount * 2)).toFixed(2)} (${actualCommentsCount} 條留言 × 2)`);
      }
      console.log('');
    }
  }
  
  console.log(`\n✅ 同步完成！`);
  console.log(`📊 總共處理: ${images.length} 張圖片`);
  console.log(`✅ 成功更新: ${updated} 張圖片\n`);
  
  // 統計
  const withComments = await Image.find({ commentsCount: { $gt: 0 } }).lean();
  console.log('📈 統計資訊:');
  console.log(`   有留言的圖片: ${withComments.length} 張`);
  
  if (withComments.length > 0) {
    const totalComments = withComments.reduce((sum, img) => sum + (img.commentsCount || 0), 0);
    const avgComments = totalComments / withComments.length;
    const maxComments = Math.max(...withComments.map(img => img.commentsCount || 0));
    
    console.log(`   總留言數: ${totalComments} 條`);
    console.log(`   平均留言數: ${avgComments.toFixed(2)} 條/張`);
    console.log(`   最多留言: ${maxComments} 條`);
  }
  
  process.exit(0);
}

syncCommentsCount().catch(err => {
  console.error('❌ 錯誤:', err);
  process.exit(1);
});

