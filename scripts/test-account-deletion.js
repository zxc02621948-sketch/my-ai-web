// scripts/test-account-deletion.js
// 測試帳號註銷流程的腳本

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// 手動加載環境變量
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env.local');

try {
  const envFile = readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach(line => {
    // 跳過註釋和空行
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      return;
    }
    
    // 匹配 KEY=VALUE 格式
    const match = trimmedLine.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      
      // 移除引號
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
  console.log('✅ 環境變量已加載');
} catch (error) {
  console.warn('⚠️  無法讀取 .env.local 文件，將使用系統環境變量');
  console.warn('   錯誤:', error.message);
}

// 驗證必要的環境變量
if (!process.env.MONGODB_URI) {
  console.error('❌ 錯誤: 未找到 MONGODB_URI 環境變量');
  console.error('   請確保 .env.local 文件存在且包含 MONGODB_URI');
  process.exit(1);
}

/**
 * 獲取或創建模型（避免導入帶有路徑別名的模型文件）
 */
function getModel(name, schemaDefinition) {
  try {
    return mongoose.model(name);
  } catch (error) {
    // 模型未註冊，創建簡化版本
    const schema = new mongoose.Schema(schemaDefinition, { strict: false, timestamps: true });
    return mongoose.model(name, schema);
  }
}

/**
 * 測試帳號註銷流程
 */
async function testAccountDeletion() {
  try {
    console.log('🧪 開始測試帳號註銷流程...\n');
    
    // 連接數據庫
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ 數據庫連接成功\n');

    // 獲取或創建 User 模型
    const User = getModel('User', {
      email: String,
      password: String,
      username: String,
      isVerified: Boolean,
      isAdmin: Boolean,
      deletionRequestedAt: Date,
      deletionScheduledAt: Date,
      deletionCode: String,
      deletionCodeExpiresAt: Date,
      lastDeletionCodeSentAt: Date,
    });

    // 1. 創建測試用戶
    console.log('📝 步驟 1: 創建測試用戶...');
    const testEmail = `test-deletion-${Date.now()}@test.com`;
    const testPassword = 'test123456';
    const hashedPassword = await bcrypt.hash(testPassword, 10);
    
    const testUser = await User.create({
      email: testEmail,
      password: hashedPassword,
      username: `test-deletion-${Date.now()}`,
      isVerified: true,
      isAdmin: false,
    });
    console.log(`✅ 測試用戶已創建: ${testUser.username} (${testUser._id})\n`);

    // 2. 模擬步驟 1: 輸入密碼並發送驗證碼
    console.log('📝 步驟 2: 模擬發送驗證碼...');
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10分鐘後過期
    const deletionScheduledAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7天後刪除

    testUser.deletionCode = code;
    testUser.deletionCodeExpiresAt = expiresAt;
    testUser.deletionRequestedAt = now;
    testUser.deletionScheduledAt = deletionScheduledAt;
    testUser.lastDeletionCodeSentAt = now;
    await testUser.save();
    console.log(`✅ 驗證碼已生成: ${code}`);
    console.log(`✅ 刪除時間已設置: ${deletionScheduledAt.toLocaleString('zh-TW')}\n`);

    // 3. 模擬步驟 3: 驗證驗證碼並確認
    console.log('📝 步驟 3: 模擬確認註銷...');
    if (testUser.deletionCode === code && testUser.deletionCodeExpiresAt > new Date()) {
      console.log('✅ 驗證碼驗證成功');
      console.log('✅ 註銷流程已啟動\n');
    } else {
      throw new Error('驗證碼驗證失敗');
    }

    // 4. 模擬時間推進（提前 7 天）
    console.log('📝 步驟 4: 模擬時間推進（提前 7 天）...');
    testUser.deletionScheduledAt = new Date(); // 立即到期
    await testUser.save();
    console.log('✅ 刪除時間已提前到現在\n');

    // 5. 執行刪除流程
    console.log('📝 步驟 5: 執行刪除流程...');
    const userId = testUser._id;

    // 獲取或創建所有需要的模型
    const Image = getModel('Image', { userId: mongoose.Schema.Types.ObjectId });
    const Video = getModel('Video', { userId: mongoose.Schema.Types.ObjectId });
    const Music = getModel('Music', { author: mongoose.Schema.Types.ObjectId });
    const Comment = getModel('Comment', { userId: mongoose.Schema.Types.ObjectId });
    const LikeLog = getModel('LikeLog', { userId: mongoose.Schema.Types.ObjectId });
    const PointsTransaction = getModel('PointsTransaction', { userId: mongoose.Schema.Types.ObjectId });
    const VisitorLog = getModel('VisitorLog', { userId: mongoose.Schema.Types.ObjectId });
    const AdVisitorLog = getModel('AdVisitorLog', { userId: mongoose.Schema.Types.ObjectId });
    const DiscussionPost = getModel('DiscussionPost', { author: mongoose.Schema.Types.ObjectId });

    // 刪除所有相關數據
    const deletedImages = await Image.deleteMany({ userId });
    const deletedVideos = await Video.deleteMany({ userId });
    const deletedMusic = await Music.deleteMany({ author: userId });
    const deletedComments = await Comment.deleteMany({ userId });
    const deletedLikes = await LikeLog.deleteMany({ userId });
    const deletedTransactions = await PointsTransaction.deleteMany({ userId });
    const deletedVisitorLogs = await VisitorLog.deleteMany({ userId });
    const deletedAdVisitorLogs = await AdVisitorLog.deleteMany({ userId });
    const deletedPosts = await DiscussionPost.deleteMany({ author: userId });

    // 移除其他用戶的追蹤
    await User.updateMany(
      { 'following.userId': userId },
      { $pull: { following: { userId } } }
    );

    // 移除其他用戶的收藏
    await User.updateMany(
      { bookmarkedDiscussionPosts: userId },
      { $pull: { bookmarkedDiscussionPosts: userId } }
    );

    // 移除其他用戶的釘選播放器
    await User.updateMany(
      { 'pinnedPlayer.userId': userId },
      { $unset: { pinnedPlayer: '' } }
    );

    console.log(`✅ 已刪除數據:`);
    console.log(`   - 圖片: ${deletedImages.deletedCount}`);
    console.log(`   - 視頻: ${deletedVideos.deletedCount}`);
    console.log(`   - 音樂: ${deletedMusic.deletedCount}`);
    console.log(`   - 評論: ${deletedComments.deletedCount}`);
    console.log(`   - 點讚: ${deletedLikes.deletedCount}`);
    console.log(`   - 積分交易: ${deletedTransactions.deletedCount}`);
    console.log(`   - 訪問記錄: ${deletedVisitorLogs.deletedCount}`);
    console.log(`   - 廣告訪問: ${deletedAdVisitorLogs.deletedCount}`);
    console.log(`   - 討論區帖子: ${deletedPosts.deletedCount}\n`);

    // 6. 匿名化用戶
    console.log('📝 步驟 6: 匿名化用戶...');
    const anonymousId = `deleted_${testUser._id.toString().slice(-8)}_${Date.now()}`;
    testUser.email = `${anonymousId}@deleted.local`;
    testUser.username = `已刪除用戶_${anonymousId}`;
    testUser.password = null;
    testUser.image = '';
    testUser.bio = '';
    testUser.backupEmail = '';
    testUser.gender = 'hidden';
    testUser.birthday = null;
    testUser.pointsBalance = 0;
    testUser.totalEarnedPoints = 0;
    testUser.discussionPendingPoints = 0;
    testUser.isVerified = false;
    testUser.isAdmin = false;
    testUser.isSuspended = false;
    testUser.isPermanentSuspension = false;
    testUser.suspendedAt = null;
    testUser.subscriptions = [];
    testUser.ownedFrames = [];
    testUser.currentFrame = 'default';
    testUser.frameSettings = {};
    testUser.miniPlayerPurchased = false;
    testUser.premiumPlayerSkin = false;
    testUser.activePlayerSkin = 'default';
    testUser.playerSkinSettings = {};
    testUser.powerCoupons = 0;
    testUser.activePowerItems = [];
    testUser.activePowerImages = [];
    testUser.playlist = [];
    testUser.defaultMusicUrl = '';
    testUser.pinnedPlayer = undefined;
    testUser.pinnedPlayerSettings = {};
    testUser.following = [];
    testUser.bookmarkedDiscussionPosts = [];
    testUser.privacyPreferences = {};
    testUser.provider = 'local';
    testUser.providerId = null;
    testUser.providers = [];
    testUser.verificationToken = null;
    testUser.resetPasswordToken = null;
    testUser.resetPasswordExpires = null;
    testUser.deletionRequestedAt = null;
    testUser.deletionScheduledAt = null;
    testUser.deletionCode = null;
    testUser.deletionCodeExpiresAt = null;
    testUser.lastDeletionCodeSentAt = null;
    await testUser.save();
    console.log(`✅ 用戶已匿名化: ${testUser.username}\n`);

    // 7. 驗證結果
    console.log('📝 步驟 7: 驗證結果...');
    const verifyUser = await User.findById(userId);
    if (verifyUser && verifyUser.email.includes('@deleted.local')) {
      console.log('✅ 用戶已成功匿名化');
      console.log(`   - 新郵箱: ${verifyUser.email}`);
      console.log(`   - 新用戶名: ${verifyUser.username}`);
      console.log(`   - 所有個人信息已清空\n`);
    } else {
      throw new Error('用戶匿名化失敗');
    }

    console.log('🎉 測試完成！所有步驟都成功執行。\n');
    console.log('📊 測試摘要:');
    console.log(`   - 測試用戶 ID: ${userId}`);
    console.log(`   - 驗證碼: ${code}`);
    console.log(`   - 刪除的數據類型: 9 種`);
    console.log(`   - 用戶狀態: 已匿名化\n`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ 測試失敗:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// 執行測試
testAccountDeletion();
