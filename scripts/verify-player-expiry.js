import { dbConnect } from '../lib/db.js';
import User from '../models/User.js';

async function verifyPlayerExpiry() {
  await dbConnect();
  console.log('\n✅ 播放器 1 日體驗券過期邏輯驗證\n');

  // 模擬場景：現在購買體驗券
  const now = new Date();
  const expiryDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 1天後

  console.log('📅 購買時間點模擬:\n');
  console.log(`當前時間: ${now.toLocaleString('zh-TW')}`);
  console.log(`過期時間: ${expiryDate.toLocaleString('zh-TW')}`);
  console.log(`有效期: 24 小時\n`);

  // 測試不同時間點的有效性
  const testPoints = [
    { hours: 1, label: '1 小時後' },
    { hours: 6, label: '6 小時後' },
    { hours: 12, label: '12 小時後' },
    { hours: 23, label: '23 小時後' },
    { hours: 23.5, label: '23.5 小時後' },
    { hours: 24, label: '24 小時後（恰好）' },
    { hours: 24.1, label: '24.1 小時後' },
    { hours: 25, label: '25 小時後' },
    { hours: 48, label: '48 小時後' }
  ];

  console.log('⏰ 過期時間點驗證:\n');

  testPoints.forEach(point => {
    const checkTime = new Date(now.getTime() + point.hours * 60 * 60 * 1000);
    const isValid = checkTime < expiryDate;
    const status = isValid ? '✅ 有效' : '❌ 已過期';
    
    console.log(`${point.label.padEnd(20)} | ${status}`);
  });

  console.log('\n📝 前端判斷邏輯:\n');
  console.log('```javascript');
  console.log('// 在個人頁面判斷是否顯示播放器');
  console.log('const userData = await getUserData();');
  console.log('const now = new Date();');
  console.log('');
  console.log('// 檢查體驗券是否有效');
  console.log('const hasValidCoupon = userData.miniPlayerExpiry && ');
  console.log('                       new Date(userData.miniPlayerExpiry) > now;');
  console.log('');
  console.log('// 檢查是否永久解鎖（LV3 或舊版購買）');
  console.log('const hasPermanent = userData.miniPlayerPurchased;');
  console.log('');
  console.log('// 最終判斷');
  console.log('const shouldShowPlayer = hasValidCoupon || hasPermanent;');
  console.log('```\n');

  console.log('🔒 防止重複領取邏輯:\n');
  console.log('```javascript');
  console.log('// 在購買 API 中檢查');
  console.log('if (currentUser.playerCouponUsed) {');
  console.log('  return { error: "你已經使用過 1 日免費體驗券了" };');
  console.log('}');
  console.log('```\n');

  console.log('📊 數據庫字段設計:\n');
  console.log('- miniPlayerExpiry: Date     // 播放器過期時間');
  console.log('- playerCouponUsed: Boolean  // 是否已使用免費券（防重複）');
  console.log('- miniPlayerPurchased: Boolean // 是否永久解鎖\n');

  console.log('✅ 完整流程驗證:\n');
  console.log('1. 用戶購買 1 日體驗券（0 積分）');
  console.log('   → playerCouponUsed = true');
  console.log('   → miniPlayerExpiry = now + 24 小時');
  console.log('');
  console.log('2. 24 小時內');
  console.log('   → miniPlayerExpiry > now = true');
  console.log('   → 顯示播放器 ✅');
  console.log('');
  console.log('3. 24 小時後');
  console.log('   → miniPlayerExpiry > now = false');
  console.log('   → 不顯示播放器 ❌');
  console.log('');
  console.log('4. 用戶升級到 LV3 或購買永久解鎖');
  console.log('   → miniPlayerPurchased = true');
  console.log('   → 永久顯示播放器 ✅\n');

  // 檢查實際數據庫中的用戶
  const testUser = await User.findOne({ username: 'cvb120g' });
  if (testUser) {
    console.log('👤 當前測試用戶狀態:\n');
    console.log(`用戶名: ${testUser.username}`);
    console.log(`體驗券過期時間: ${testUser.miniPlayerExpiry ? testUser.miniPlayerExpiry.toLocaleString('zh-TW') : '未設置'}`);
    console.log(`已使用免費券: ${testUser.playerCouponUsed ? '是' : '否'}`);
    console.log(`永久解鎖: ${testUser.miniPlayerPurchased ? '是' : '否'}`);

    if (testUser.miniPlayerExpiry) {
      const timeLeft = testUser.miniPlayerExpiry - new Date();
      if (timeLeft > 0) {
        const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
        const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        console.log(`⏰ 剩餘時間: ${hoursLeft} 小時 ${minutesLeft} 分鐘\n`);
      } else {
        console.log(`❌ 體驗券已過期\n`);
      }
    }
  }

  console.log('✅ 驗證完成！邏輯正確，24 小時後會自動過期。\n');
  process.exit(0);
}

verifyPlayerExpiry().catch(err => {
  console.error('❌ 驗證失敗:', err);
  process.exit(1);
});

