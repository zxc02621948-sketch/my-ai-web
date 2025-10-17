/**
 * 🔒 資料完整性測試
 * 用途：檢查資料庫數據的一致性和完整性
 */

const mongoose = require('mongoose');

// 優先使用環境變數，否則使用本地資料庫
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/myaiweb';

// Schema 定義
const UserSchema = new mongoose.Schema({}, { strict: false });
const ImageSchema = new mongoose.Schema({}, { strict: false });
const CommentSchema = new mongoose.Schema({}, { strict: false });

async function testDataIntegrity() {
  console.log('🔒 開始資料完整性測試...');
  console.log('================================\n');

  const issues = [];
  const warnings = [];

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ 成功連接到資料庫\n');

    const User = mongoose.model('User', UserSchema);
    const Image = mongoose.model('Image', ImageSchema);
    const Comment = mongoose.model('Comment', CommentSchema);

    // 測試 1: 用戶積分一致性
    console.log('📋 測試 1: 用戶積分數據一致性');
    const users = await User.find({}).lean();
    
    let pointsIssues = 0;
    for (const user of users) {
      // 檢查必要欄位
      if (user.pointsBalance === undefined) {
        pointsIssues++;
        issues.push(`用戶 ${user.username} 缺少 pointsBalance`);
      }
      if (user.totalEarnedPoints === undefined) {
        pointsIssues++;
        issues.push(`用戶 ${user.username} 缺少 totalEarnedPoints`);
      }
      // 檢查邏輯
      if (user.pointsBalance !== undefined && user.totalEarnedPoints !== undefined) {
        if (user.pointsBalance > user.totalEarnedPoints) {
          pointsIssues++;
          issues.push(`用戶 ${user.username} 積分異常: 當前 ${user.pointsBalance} > 累計 ${user.totalEarnedPoints}`);
        }
      }
    }

    if (pointsIssues === 0) {
      console.log(`✅ ${users.length} 個用戶積分數據正常`);
    } else {
      console.log(`❌ 發現 ${pointsIssues} 個積分問題`);
    }

    // 測試 2: 圖片愛心數一致性
    console.log('\n📋 測試 2: 圖片愛心數據一致性');
    const images = await Image.find({}).lean();
    
    let likeIssues = 0;
    for (const image of images) {
      const actualLikes = (image.likes || []).length;
      const recordedLikes = image.likesCount || 0;
      
      if (actualLikes !== recordedLikes) {
        likeIssues++;
        warnings.push(`圖片 ${image._id} 愛心數不一致: 實際 ${actualLikes} vs 記錄 ${recordedLikes}`);
      }
    }

    if (likeIssues === 0) {
      console.log(`✅ ${images.length} 張圖片愛心數據正常`);
    } else {
      console.log(`⚠️  發現 ${likeIssues} 個愛心數不一致（可用 repairLikes 修復）`);
    }

    // 測試 3: 播放器造型數據
    console.log('\n📋 測試 3: 播放器造型數據');
    const usersWithSkin = await User.find({ premiumPlayerSkin: true }).lean();
    
    let skinIssues = 0;
    for (const user of usersWithSkin) {
      if (!user.activePlayerSkin) {
        skinIssues++;
        warnings.push(`用戶 ${user.username} 已購買造型但未設置 activePlayerSkin`);
      }
      if (!user.playerSkinSettings) {
        skinIssues++;
        warnings.push(`用戶 ${user.username} 已購買造型但缺少 playerSkinSettings`);
      }
    }

    if (skinIssues === 0) {
      console.log(`✅ ${usersWithSkin.length} 個用戶的播放器造型數據正常`);
    } else {
      console.log(`⚠️  發現 ${skinIssues} 個造型數據問題`);
    }

    // 測試 4: 基本數據統計
    console.log('\n📋 測試 4: 資料庫統計');
    const commentCount = await Comment.countDocuments();
    console.log(`📊 用戶數: ${users.length}`);
    console.log(`📊 圖片數: ${images.length}`);
    console.log(`📊 留言數: ${commentCount}`);

    // 總結
    console.log('\n================================');
    console.log('📊 測試結果總結:');
    console.log(`❌ 嚴重問題: ${issues.length} 項`);
    console.log(`⚠️  警告: ${warnings.length} 項`);

    if (issues.length > 0) {
      console.log('\n❌ 發現嚴重問題:');
      issues.forEach(issue => console.log(`   - ${issue}`));
    }

    if (warnings.length > 0) {
      console.log('\n⚠️  發現警告:');
      warnings.forEach(warning => console.log(`   - ${warning}`));
    }

    if (issues.length === 0 && warnings.length === 0) {
      console.log('\n🎉 資料完整性測試通過！所有數據正常');
    } else if (issues.length === 0) {
      console.log('\n✅ 無嚴重問題，但有一些可優化項目');
    } else {
      console.log('\n⚠️  建議立即修復嚴重問題');
    }

  } catch (error) {
    console.error('❌ 測試失敗:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

testDataIntegrity();

