import { dbConnect } from '../lib/db.js';
import User from '../models/User.js';

async function testPlayerCouponExpiry() {
  await dbConnect();
  console.log('\n🧪 播放器 1 日體驗券過期測試\n');

  // 測試場景
  const testScenarios = [
    {
      name: '剛激活（0 小時）',
      hoursAgo: 0,
      shouldExpire: false
    },
    {
      name: '12 小時後',
      hoursAgo: -12,
      shouldExpire: false
    },
    {
      name: '23 小時後',
      hoursAgo: -23,
      shouldExpire: false
    },
    {
      name: '24 小時後（恰好 1 天）',
      hoursAgo: -24,
      shouldExpire: true
    },
    {
      name: '25 小時後',
      hoursAgo: -25,
      shouldExpire: true
    },
    {
      name: '48 小時後（2 天）',
      hoursAgo: -48,
      shouldExpire: true
    }
  ];

  console.log('📋 測試場景：\n');

  testScenarios.forEach((scenario, index) => {
    const now = new Date();
    const expiryTime = new Date(now.getTime() + scenario.hoursAgo * 60 * 60 * 1000);
    const isExpired = expiryTime <= now;
    const status = isExpired ? '❌ 已過期' : '✅ 有效';
    const result = isExpired === scenario.shouldExpire ? '✅ 正確' : '❌ 錯誤';

    console.log(`${index + 1}. ${scenario.name}`);
    console.log(`   過期時間: ${expiryTime.toLocaleString('zh-TW')}`);
    console.log(`   當前時間: ${now.toLocaleString('zh-TW')}`);
    console.log(`   狀態: ${status}`);
    console.log(`   預期: ${scenario.shouldExpire ? '已過期' : '有效'}`);
    console.log(`   結果: ${result}\n`);
  });

  // 實際數據庫測試
  console.log('\n📊 數據庫實際測試:\n');

  // 查找所有有播放器過期時間的用戶
  const usersWithPlayer = await User.find({
    miniPlayerExpiry: { $exists: true, $ne: null }
  }).select('username miniPlayerExpiry playerCouponUsed miniPlayerPurchased');

  if (usersWithPlayer.length === 0) {
    console.log('⚠️  沒有用戶使用過播放器體驗券\n');
  } else {
    const now = new Date();
    
    usersWithPlayer.forEach(user => {
      const isExpired = user.miniPlayerExpiry <= now;
      const timeLeft = user.miniPlayerExpiry - now;
      const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
      const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

      console.log(`👤 用戶: ${user.username}`);
      console.log(`   過期時間: ${user.miniPlayerExpiry.toLocaleString('zh-TW')}`);
      console.log(`   當前時間: ${now.toLocaleString('zh-TW')}`);
      console.log(`   狀態: ${isExpired ? '❌ 已過期' : '✅ 有效'}`);
      
      if (!isExpired) {
        console.log(`   剩餘時間: ${hoursLeft} 小時 ${minutesLeft} 分鐘`);
      } else {
        const hoursOver = Math.abs(hoursLeft);
        const minutesOver = Math.abs(minutesLeft);
        console.log(`   已過期: ${hoursOver} 小時 ${minutesOver} 分鐘`);
      }
      
      console.log(`   已使用免費券: ${user.playerCouponUsed ? '是' : '否'}`);
      console.log(`   永久解鎖: ${user.miniPlayerPurchased ? '是' : '否'}\n`);
    });
  }

  // 播放器顯示邏輯測試
  console.log('\n🎵 播放器顯示邏輯驗證:\n');

  const testUser = await User.findOne({ username: 'cvb120g' });
  
  if (testUser) {
    const now = new Date();
    const hasValidCoupon = testUser.miniPlayerExpiry && testUser.miniPlayerExpiry > now;
    const hasPermanent = testUser.miniPlayerPurchased;
    const shouldShowPlayer = hasValidCoupon || hasPermanent;

    console.log(`👤 測試用戶: ${testUser.username}`);
    console.log(`   過期時間: ${testUser.miniPlayerExpiry ? testUser.miniPlayerExpiry.toLocaleString('zh-TW') : '未設置'}`);
    console.log(`   體驗券有效: ${hasValidCoupon ? '✅ 是' : '❌ 否'}`);
    console.log(`   永久解鎖: ${hasPermanent ? '✅ 是' : '❌ 否'}`);
    console.log(`   應顯示播放器: ${shouldShowPlayer ? '✅ 是' : '❌ 否'}\n`);

    // 提供前端邏輯代碼示例
    console.log('📝 前端判斷邏輯示例:\n');
    console.log('```javascript');
    console.log('// 判斷是否應該顯示播放器');
    console.log('const now = new Date();');
    console.log('const hasValidCoupon = userData.miniPlayerExpiry && new Date(userData.miniPlayerExpiry) > now;');
    console.log('const hasPermanent = userData.miniPlayerPurchased;');
    console.log('const shouldShowPlayer = hasValidCoupon || hasPermanent;');
    console.log('```\n');
  } else {
    console.log('⚠️  未找到測試用戶 cvb120g\n');
  }

  // 過期處理建議
  console.log('\n💡 過期處理建議:\n');
  console.log('1. ✅ 數據庫不需要清理過期數據');
  console.log('   - miniPlayerExpiry 保留作為歷史記錄');
  console.log('   - playerCouponUsed 保留以防止重複領取\n');
  
  console.log('2. ✅ 前端判斷邏輯');
  console.log('   - 每次載入時檢查 miniPlayerExpiry > now');
  console.log('   - 如果過期，不顯示播放器');
  console.log('   - 如果有 miniPlayerPurchased，永久顯示\n');

  console.log('3. ✅ 用戶體驗優化');
  console.log('   - 顯示剩餘時間提示（例如：體驗券剩餘 3 小時）');
  console.log('   - 過期後提示升級到 LV3 解鎖永久使用\n');

  console.log('✅ 測試完成！\n');
  process.exit(0);
}

testPlayerCouponExpiry().catch(err => {
  console.error('❌ 測試失敗:', err);
  process.exit(1);
});


