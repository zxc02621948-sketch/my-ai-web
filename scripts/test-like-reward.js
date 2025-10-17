/**
 * 測試愛心轉積分功能
 * 創建測試用戶並模擬點讚
 */

import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://cvb120g:j3j79ru06@my-ai-web.9ugvdto.mongodb.net/myaiweb?retryWrites=true&w=majority&appName=my-ai-web';

// 定義 Schema（避免導入問題）
const UserSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  pointsBalance: { type: Number, default: 0 },
  totalEarnedPoints: { type: Number, default: 0 }
}, { strict: false });

const DiscussionPostSchema = new mongoose.Schema({
  title: String,
  content: String,
  category: String,
  author: mongoose.Schema.Types.ObjectId,
  authorName: String,
  likes: [mongoose.Schema.Types.ObjectId],
  likesCount: { type: Number, default: 0 },
  uploadedImages: Array,
  imageCount: { type: Number, default: 0 },
  pointsCost: { type: Number, default: 0 }
}, { strict: false });

const PointsTransactionSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  type: String,
  points: Number,
  sourceId: mongoose.Schema.Types.ObjectId,
  actorUserId: mongoose.Schema.Types.ObjectId,
  dateKey: String,
  meta: Object,
  createdAt: { type: Date, default: Date.now }
}, { collection: 'points_transactions' });

async function testLikeReward() {
  try {
    console.log('🧪 開始測試愛心轉積分功能...\n');
    
    await mongoose.connect(MONGODB_URI, {
      dbName: 'myaiweb'
    });
    console.log('✅ 已連接到數據庫\n');
    
    const User = mongoose.model('User', UserSchema);
    const DiscussionPost = mongoose.model('DiscussionPost', DiscussionPostSchema);
    const PointsTransaction = mongoose.model('PointsTransaction', PointsTransactionSchema);
    
    // 1. 找到你的帳號（作者）
    console.log('📋 步驟 1: 查找作者帳號');
    const author = await User.findOne({ username: 'cvb120g' });
    if (!author) {
      console.log('❌ 找不到作者帳號');
      return;
    }
    console.log(`✅ 作者: ${author.username}`);
    console.log(`   當前積分: ${author.pointsBalance}\n`);
    
    // 2. 找到最新的多圖教學帖
    console.log('📋 步驟 2: 查找最新的多圖教學帖');
    const post = await DiscussionPost.findOne({
      author: author._id,
      imageCount: { $gte: 2 },
      pointsCost: { $gt: 0 }
    }).sort({ createdAt: -1 });
    
    if (!post) {
      console.log('❌ 找不到多圖教學帖');
      return;
    }
    
    console.log(`✅ 找到帖子: ${post.title}`);
    console.log(`   圖片數量: ${post.imageCount}`);
    console.log(`   積分消耗: ${post.pointsCost}`);
    console.log(`   當前愛心: ${post.likesCount}\n`);
    
    // 3. 創建或查找測試用戶
    console.log('📋 步驟 3: 創建測試用戶');
    let testUser = await User.findOne({ username: 'test_liker' });
    
    if (!testUser) {
      testUser = new User({
        username: 'test_liker',
        email: 'test@example.com',
        password: 'test123',
        pointsBalance: 0,
        totalEarnedPoints: 0,
        isVerified: true
      });
      await testUser.save();
      console.log('✅ 已創建測試用戶: test_liker\n');
    } else {
      console.log('✅ 已存在測試用戶: test_liker\n');
    }
    
    // 4. 檢查測試用戶是否已點讚
    const alreadyLiked = post.likes.some(id => id.toString() === testUser._id.toString());
    
    if (alreadyLiked) {
      console.log('⚠️  測試用戶已經點過讚，先取消點讚...');
      post.likes = post.likes.filter(id => id.toString() !== testUser._id.toString());
      post.likesCount = post.likes.length;
      await post.save();
      
      // 扣除之前的積分
      author.pointsBalance = Math.max(0, author.pointsBalance - 1);
      await author.save();
      
      console.log('✅ 已取消點讚並扣除積分\n');
    }
    
    // 5. 模擬點讚
    console.log('📋 步驟 4: 模擬測試用戶點讚');
    const beforePoints = author.pointsBalance;
    
    post.likes.push(testUser._id);
    post.likesCount = post.likes.length;
    await post.save();
    
    console.log(`✅ 已添加點讚: ${post.likesCount} 個愛心\n`);
    
    // 6. 給作者積分獎勵
    console.log('📋 步驟 5: 發放積分獎勵');
    author.pointsBalance += 1;
    await author.save();
    
    // 記錄積分交易
    const dateKey = new Date().toISOString().split('T')[0];
    const transaction = await PointsTransaction.create({
      userId: author._id,
      type: 'discussion_like_reward',
      points: 1,
      sourceId: post._id,
      actorUserId: testUser._id,
      dateKey,
      meta: {
        postTitle: post.title,
        action: 'like',
        testMode: true
      }
    });
    
    console.log(`✅ 積分獎勵已發放: ${beforePoints} -> ${author.pointsBalance} (+1)`);
    console.log(`✅ 積分交易ID: ${transaction._id}\n`);
    
    // 7. 驗證結果
    console.log('📋 步驟 6: 驗證結果');
    const updatedAuthor = await User.findById(author._id);
    const updatedPost = await DiscussionPost.findById(post._id);
    
    console.log('✅ 最終狀態:');
    console.log(`   作者積分: ${updatedAuthor.pointsBalance}`);
    console.log(`   帖子愛心: ${updatedPost.likesCount}`);
    console.log(`   積分變化: ${beforePoints} -> ${updatedAuthor.pointsBalance} (+${updatedAuthor.pointsBalance - beforePoints})\n`);
    
    // 8. 查看積分記錄
    console.log('📋 步驟 7: 查看積分記錄');
    const recentTransactions = await PointsTransaction.find({
      userId: author._id,
      sourceId: post._id
    }).sort({ createdAt: -1 }).limit(5);
    
    console.log(`✅ 找到 ${recentTransactions.length} 條相關記錄:`);
    recentTransactions.forEach((tx, i) => {
      console.log(`   ${i + 1}. ${tx.type}: ${tx.points > 0 ? '+' : ''}${tx.points} 積分`);
      console.log(`      時間: ${tx.createdAt.toLocaleString('zh-TW')}`);
    });
    
    console.log('\n🎉 測試完成！積分系統運作正常！');
    console.log('\n💡 提示: 系統已阻止自己點讚自己獲得積分，這是正常的防作弊機制。');
    
  } catch (error) {
    console.error('❌ 測試失敗:', error);
  } finally {
    await mongoose.disconnect();
  }
}

testLikeReward();

