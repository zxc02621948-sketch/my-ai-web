/**
 * 🎵 播放器系統測試
 * 用途：測試播放器相關功能的完整性
 */

const mongoose = require('mongoose');

// 優先使用環境變數，否則使用本地資料庫
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/myaiweb';

const UserSchema = new mongoose.Schema({}, { strict: false });

async function testPlayerSystem() {
  console.log('🎵 開始播放器系統測試...');
  console.log('================================\n');

  const results = {
    passed: [],
    failed: [],
    warnings: []
  };

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ 成功連接到資料庫\n');

    const User = mongoose.model('User', UserSchema);

    // 測試 1: 檢查預設造型設置
    console.log('📋 測試 1: 預設造型設置');
    const allUsers = await User.find({}).lean();
    
    let missingDefaults = 0;
    for (const user of allUsers) {
      if (!user.activePlayerSkin) {
        missingDefaults++;
      }
    }

    if (missingDefaults === 0) {
      console.log(`✅ 所有 ${allUsers.length} 個用戶都有預設造型設置`);
      results.passed.push('預設造型設置');
    } else {
      console.log(`⚠️  ${missingDefaults} 個用戶缺少預設造型設置`);
      results.warnings.push(`${missingDefaults} 個用戶缺少預設造型`);
    }

    // 測試 2: 檢查已購買用戶的造型數據
    console.log('\n📋 測試 2: 已購買用戶的造型數據');
    const purchasedUsers = await User.find({ premiumPlayerSkin: true }).lean();
    
    console.log(`📊 找到 ${purchasedUsers.length} 個已購買高階造型的用戶`);
    
    let skinDataIssues = 0;
    for (const user of purchasedUsers) {
      console.log(`\n👤 用戶: ${user.username}`);
      console.log(`   已購買: ${user.premiumPlayerSkin}`);
      console.log(`   啟用造型: ${user.activePlayerSkin || '未設置'}`);
      
      // 檢查設置完整性
      if (!user.playerSkinSettings) {
        console.log(`   ❌ 缺少 playerSkinSettings`);
        skinDataIssues++;
      } else {
        const settings = user.playerSkinSettings;
        console.log(`   設置模式: ${settings.mode || '未設置'}`);
        console.log(`   速度: ${settings.speed || '未設置'}`);
        console.log(`   飽和度: ${settings.saturation || '未設置'}`);
        console.log(`   亮度: ${settings.lightness || '未設置'}`);
        console.log(`   透明度: ${settings.opacity || '未設置'}`);
        
        // 檢查必要欄位
        const requiredFields = ['mode', 'speed', 'saturation', 'lightness', 'opacity'];
        const missingFields = requiredFields.filter(field => settings[field] === undefined);
        
        if (missingFields.length > 0) {
          console.log(`   ⚠️  缺少欄位: ${missingFields.join(', ')}`);
          skinDataIssues++;
        } else {
          console.log(`   ✅ 設置完整`);
        }
      }
    }

    if (skinDataIssues === 0) {
      console.log(`\n✅ 所有已購買用戶的造型數據完整`);
      results.passed.push('已購買用戶造型數據');
    } else {
      console.log(`\n❌ 發現 ${skinDataIssues} 個造型數據問題`);
      results.failed.push('造型數據完整性');
    }

    // 測試 3: 檢查造型權限一致性
    console.log('\n📋 測試 3: 造型權限一致性');
    const catHeadphoneUsers = await User.find({ activePlayerSkin: 'cat-headphone' }).lean();
    
    let permissionIssues = 0;
    for (const user of catHeadphoneUsers) {
      if (!user.premiumPlayerSkin) {
        console.log(`❌ 用戶 ${user.username} 使用貓耳造型但未購買`);
        permissionIssues++;
      }
    }

    if (permissionIssues === 0) {
      console.log(`✅ 所有使用高階造型的用戶都有權限`);
      results.passed.push('造型權限一致性');
    } else {
      console.log(`❌ 發現 ${permissionIssues} 個權限問題`);
      results.failed.push('造型權限一致性');
    }

    // 測試 4: 統計數據
    console.log('\n📋 測試 4: 播放器使用統計');
    const defaultUsers = await User.countDocuments({ activePlayerSkin: 'default' });
    const catHeadphoneCount = await User.countDocuments({ activePlayerSkin: 'cat-headphone' });
    const noSkinSet = await User.countDocuments({ activePlayerSkin: { $exists: false } });
    
    console.log(`📊 使用預設造型: ${defaultUsers} 人`);
    console.log(`📊 使用貓耳造型: ${catHeadphoneCount} 人`);
    console.log(`📊 未設置造型: ${noSkinSet} 人`);
    console.log(`📊 已購買高階造型: ${purchasedUsers.length} 人`);

    // 總結
    console.log('\n================================');
    console.log('📊 測試結果總結:');
    console.log(`✅ 通過: ${results.passed.length} 項`);
    console.log(`❌ 失敗: ${results.failed.length} 項`);
    console.log(`⚠️  警告: ${results.warnings.length} 項`);

    if (results.failed.length === 0 && results.warnings.length === 0) {
      console.log('\n🎉 播放器系統測試通過！所有功能正常');
      return true;
    } else if (results.failed.length === 0) {
      console.log('\n✅ 播放器系統基本正常，有一些可優化項目');
      return true;
    } else {
      console.log('\n⚠️  播放器系統存在問題，需要修復');
      return false;
    }

  } catch (error) {
    console.error('❌ 測試失敗:', error.message);
    return false;
  } finally {
    await mongoose.disconnect();
  }
}

testPlayerSystem().then(success => {
  process.exit(success ? 0 : 1);
});

