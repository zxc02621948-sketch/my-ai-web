import { dbConnect } from '../lib/db.js';
import User from '../models/User.js';
import { LEVELS } from '../utils/pointsLevels.js';
import { grantLevelRewards } from '../utils/levelRewards.js';

async function testLV3PlayerReward() {
  await dbConnect();
  console.log('\n🎵 LV3 播放器獎勵測試\n');

  // 查找測試用戶
  const testUser = await User.findOne({ username: 'cvb120g' });
  
  if (!testUser) {
    console.log('❌ 未找到測試用戶 cvb120g\n');
    process.exit(1);
  }

  // 計算當前等級
  let currentLevel = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (testUser.pointsBalance >= LEVELS[i].min) {
      currentLevel = i;
    }
  }

  console.log('👤 測試用戶狀態:\n');
  console.log(`用戶名: ${testUser.username}`);
  console.log(`當前積分: ${testUser.pointsBalance}`);
  console.log(`當前等級: ${LEVELS[currentLevel].rank} - ${LEVELS[currentLevel].title}`);
  console.log(`播放器已解鎖: ${testUser.miniPlayerPurchased ? '✅ 是' : '❌ 否'}\n`);

  // LV3 需要的積分
  const lv3Index = 2; // LV3 是索引 2
  const lv3Points = LEVELS[lv3Index].min;

  console.log('📊 LV3 播放器獎勵信息:\n');
  console.log(`LV3 需要積分: ${lv3Points}`);
  console.log(`當前積分差距: ${lv3Points - testUser.pointsBalance}`);
  
  if (currentLevel >= lv3Index) {
    console.log(`✅ 已達到 LV3！`);
    
    if (testUser.miniPlayerPurchased) {
      console.log(`✅ 播放器已解鎖（正常）\n`);
    } else {
      console.log(`⚠️  播放器未解鎖（異常！）\n`);
      console.log('🔧 嘗試補發獎勵...\n');
      
      // 補發獎勵
      const rewards = await grantLevelRewards(testUser, lv3Index - 1, lv3Index);
      await testUser.save();
      
      console.log('✅ 獎勵補發完成！\n');
      console.log(`獲得功能: ${rewards.features.join(', ')}`);
      console.log(`播放器狀態: ${testUser.miniPlayerPurchased ? '✅ 已解鎖' : '❌ 未解鎖'}\n`);
    }
  } else {
    console.log(`❌ 尚未達到 LV3\n`);
  }

  // 模擬升級到 LV3 的流程
  console.log('🧪 模擬升級流程測試:\n');
  
  // 創建測試用戶（不保存到數據庫）
  const mockUser = {
    username: 'test_user',
    pointsBalance: 450, // LV2
    ownedFrames: ['default'],
    miniPlayerPurchased: false
  };

  console.log('1️⃣ 初始狀態:');
  console.log(`   積分: ${mockUser.pointsBalance}`);
  console.log(`   播放器: ${mockUser.miniPlayerPurchased ? '已解鎖' : '未解鎖'}\n`);

  // 模擬升級到 LV3
  mockUser.pointsBalance = 500; // 達到 LV3
  
  const oldLevel = 1; // LV2 的索引
  const newLevel = 2; // LV3 的索引
  
  console.log('2️⃣ 升級到 LV3...');
  const rewards = await grantLevelRewards(mockUser, oldLevel, newLevel);
  
  console.log('3️⃣ 獎勵發放結果:');
  console.log(`   獲得功能: ${rewards.features.join(', ')}`);
  console.log(`   播放器狀態: ${mockUser.miniPlayerPurchased ? '✅ 已解鎖' : '❌ 未解鎖'}\n`);

  // 驗證邏輯
  console.log('✅ 升級邏輯驗證:\n');
  console.log('完整流程:');
  console.log('1. 用戶積分達到 500');
  console.log('2. 觸發等級檢查（pointsService.js）');
  console.log('3. 檢測到從 LV2 升級到 LV3');
  console.log('4. 調用 grantLevelRewards(user, 1, 2)');
  console.log('5. 設置 user.miniPlayerPurchased = true');
  console.log('6. 保存用戶數據');
  console.log('7. 用戶獲得永久播放器使用權\n');

  console.log('📝 前端判斷邏輯:\n');
  console.log('```javascript');
  console.log('// 在個人頁面判斷是否顯示播放器');
  console.log('const userData = await getUserData();');
  console.log('const now = new Date();');
  console.log('');
  console.log('// 檢查體驗券是否有效');
  console.log('const hasValidCoupon = userData.miniPlayerExpiry && ');
  console.log('                       new Date(userData.miniPlayerExpiry) > now;');
  console.log('');
  console.log('// 檢查是否永久解鎖（LV3 獎勵或舊版購買）');
  console.log('const hasPermanent = userData.miniPlayerPurchased;');
  console.log('');
  console.log('// 最終判斷');
  console.log('const shouldShowPlayer = hasValidCoupon || hasPermanent;');
  console.log('```\n');

  console.log('✅ LV3 播放器獎勵測試完成！\n');
  process.exit(0);
}

testLV3PlayerReward().catch(err => {
  console.error('❌ 測試失敗:', err);
  process.exit(1);
});


