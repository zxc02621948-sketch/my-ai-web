// 移除用戶的高階播放器造型權限（用於測試購買流程）
// 使用方式：node scripts/revoke-premium-skin.js <userId>

const mongoose = require('mongoose');
const User = require('../models/User').default || require('../models/User');

async function revokePremiumSkin(userId) {
  try {
    // 連接數據庫
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/my-ai-web');
    console.log('✅ 已連接到數據庫');

    // 查找用戶
    const user = await User.findById(userId);
    
    if (!user) {
      console.error('❌ 找不到用戶:', userId);
      process.exit(1);
    }

    console.log(`\n找到用戶: ${user.username} (${user.email})`);
    console.log(`當前狀態: premiumPlayerSkin = ${user.premiumPlayerSkin}`);

    // 移除高階造型權限
    user.premiumPlayerSkin = false;
    user.premiumPlayerSkinExpiry = null;

    await user.save();

    console.log('\n✅ 高階播放器造型已移除！');
    console.log('   - premiumPlayerSkin: false');
    console.log('   現在可以測試購買流程了！');

  } catch (error) {
    console.error('❌ 錯誤:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ 已斷開數據庫連接');
  }
}

// 從命令行參數獲取 userId
const userId = process.argv[2];

if (!userId) {
  console.error('❌ 請提供用戶 ID');
  console.log('使用方式：node scripts/revoke-premium-skin.js <userId>');
  process.exit(1);
}

revokePremiumSkin(userId);

