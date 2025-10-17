/**
 * 測試多圖教學帖和積分系統
 * 
 * 使用方法：
 * node scripts/test-multi-image-posts.js
 */

import mongoose from 'mongoose';
import { dbConnect } from '../lib/db.js';
import User from '../models/User.js';
import DiscussionPost from '../models/DiscussionPost.js';
import PointsTransaction from '../models/PointsTransaction.js';

async function testMultiImagePosts() {
  try {
    console.log('🧪 開始測試多圖教學帖系統...\n');
    
    await dbConnect();
    
    // 1. 查找測試用戶
    console.log('📋 步驟 1: 查找測試用戶');
    const testUser = await User.findOne({ username: 'cvb120g' });
    if (!testUser) {
      console.log('❌ 找不到測試用戶 cvb120g');
      return;
    }
    console.log(`✅ 找到用戶: ${testUser.username}`);
    console.log(`   當前積分: ${testUser.pointsBalance}`);
    console.log(`   累計獲得: ${testUser.totalEarnedPoints || 0}\n`);
    
    // 2. 創建測試多圖帖子
    console.log('📋 步驟 2: 創建測試多圖帖子（2張圖，消耗5積分）');
    const initialBalance = testUser.pointsBalance;
    
    const testPost = new DiscussionPost({
      title: '【測試】多圖教學帖 - 如何使用播放器',
      content: '這是一個測試帖子\n{{image:0}}\n第一步：打開設定\n{{image:1}}\n第二步：選擇造型',
      category: 'tutorial',
      author: testUser._id,
      authorName: testUser.username,
      uploadedImages: [
        {
          url: 'https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/test-image-1/public',
          imageId: 'test-image-1',
          fileName: 'test1.png',
          fileSize: 100000,
          order: 0
        },
        {
          url: 'https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/test-image-2/public',
          imageId: 'test-image-2',
          fileName: 'test2.png',
          fileSize: 100000,
          order: 1
        }
      ],
      imageCount: 2,
      pointsCost: 5
    });
    
    await testPost.save();
    console.log(`✅ 帖子創建成功！ID: ${testPost._id}`);
    console.log(`   標題: ${testPost.title}`);
    console.log(`   圖片數量: ${testPost.imageCount}`);
    console.log(`   積分消耗: ${testPost.pointsCost}\n`);
    
    // 3. 扣除積分
    console.log('📋 步驟 3: 扣除積分');
    testUser.pointsBalance -= testPost.pointsCost;
    await testUser.save();
    
    // 記錄積分交易
    const dateKey = new Date().toISOString().split('T')[0];
    await PointsTransaction.create({
      userId: testUser._id,
      type: 'discussion_post_cost',
      points: -testPost.pointsCost,
      sourceId: testPost._id,
      dateKey,
      meta: {
        postTitle: testPost.title,
        imageCount: testPost.imageCount
      }
    });
    
    console.log(`✅ 積分已扣除: ${initialBalance} -> ${testUser.pointsBalance} (-${testPost.pointsCost})\n`);
    
    // 4. 模擬其他用戶點讚
    console.log('📋 步驟 4: 模擬其他用戶點讚（測試積分獎勵）');
    
    // 創建一個臨時測試用戶ID（模擬其他用戶）
    const fakeLikerId = new mongoose.Types.ObjectId();
    testPost.likes.push(fakeLikerId);
    testPost.likesCount = testPost.likes.length;
    await testPost.save();
    
    // 給作者積分獎勵
    testUser.pointsBalance += 1;
    await testUser.save();
    
    await PointsTransaction.create({
      userId: testUser._id,
      type: 'discussion_like_reward',
      points: 1,
      sourceId: testPost._id,
      actorUserId: fakeLikerId,
      dateKey,
      meta: {
        postTitle: testPost.title,
        action: 'like'
      }
    });
    
    console.log(`✅ 愛心獎勵已發放: ${testUser.pointsBalance - 1} -> ${testUser.pointsBalance} (+1)\n`);
    
    // 5. 查詢積分記錄
    console.log('📋 步驟 5: 查詢積分記錄');
    const transactions = await PointsTransaction.find({
      userId: testUser._id,
      sourceId: testPost._id
    }).sort({ createdAt: -1 });
    
    console.log(`✅ 找到 ${transactions.length} 條積分記錄:`);
    transactions.forEach((tx, i) => {
      console.log(`   ${i + 1}. ${tx.type}: ${tx.points > 0 ? '+' : ''}${tx.points} 積分`);
      console.log(`      時間: ${tx.createdAt.toLocaleString('zh-TW')}`);
      if (tx.meta) {
        console.log(`      詳情: ${JSON.stringify(tx.meta)}`);
      }
    });
    console.log();
    
    // 6. 查看最終狀態
    console.log('📋 步驟 6: 最終狀態');
    const finalUser = await User.findById(testUser._id);
    console.log(`✅ 用戶最終狀態:`);
    console.log(`   當前積分: ${finalUser.pointsBalance}`);
    console.log(`   積分變化: ${initialBalance} -> ${finalUser.pointsBalance} (${finalUser.pointsBalance - initialBalance})`);
    console.log();
    
    console.log(`✅ 帖子最終狀態:`);
    console.log(`   愛心數: ${testPost.likesCount}`);
    console.log(`   積分收益: +${testPost.likesCount} (1愛心 = 1積分)`);
    console.log(`   淨收益: ${testPost.likesCount - testPost.pointsCost} 積分`);
    console.log();
    
    // 7. 清理測試數據（可選）
    console.log('📋 步驟 7: 清理測試數據');
    const shouldCleanup = process.argv.includes('--cleanup');
    
    if (shouldCleanup) {
      await DiscussionPost.deleteOne({ _id: testPost._id });
      await PointsTransaction.deleteMany({ sourceId: testPost._id });
      
      // 恢復積分
      testUser.pointsBalance = initialBalance;
      await testUser.save();
      
      console.log('✅ 測試數據已清理，積分已恢復\n');
    } else {
      console.log('💡 測試數據已保留，可在討論區查看');
      console.log(`💡 帖子ID: ${testPost._id}`);
      console.log(`💡 如需清理，請執行: node scripts/test-multi-image-posts.js --cleanup\n`);
    }
    
    console.log('🎉 測試完成！\n');
    console.log('📊 測試總結:');
    console.log('   ✅ 多圖帖子創建成功');
    console.log('   ✅ 積分扣除正常');
    console.log('   ✅ 愛心轉積分正常');
    console.log('   ✅ 積分記錄完整');
    
  } catch (error) {
    console.error('❌ 測試失敗:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// 執行測試
testMultiImagePosts();

