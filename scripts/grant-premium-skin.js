// 臨時腳本：給指定用戶添加高階播放器造型權限（測試用）
// 使用方式：node scripts/grant-premium-skin.js <userId>

const mongoose = require('mongoose');
const User = require('../models/User').default || require('../models/User');

async function grantPremiumSkin(userId) {
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

    // 啟用高階造型
    user.premiumPlayerSkin = true;
    user.premiumPlayerSkinExpiry = null; // 永久
    
    // 初始化預設顏色設定
    if (!user.playerSkinSettings) {
      user.playerSkinSettings = {
        mode: 'rgb',
        speed: 0.02,
        saturation: 50,
        lightness: 60,
        hue: 0
      };
    }

    await user.save();

    console.log('\n✅ 高階播放器造型已啟用！');
    console.log('   - premiumPlayerSkin: true');
    console.log('   - premiumPlayerSkinExpiry: null (永久)');
    console.log('   - playerSkinSettings:', JSON.stringify(user.playerSkinSettings, null, 2));

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
  console.log('使用方式：node scripts/grant-premium-skin.js <userId>');
  console.log('例如：node scripts/grant-premium-skin.js 688d7b8f37f458cc460f1438');
  process.exit(1);
}

grantPremiumSkin(userId);

