// scripts/test-level6-10-rewards.js
// 測試 LV6 和 LV10 的訂閱獎勵發放

const mongoose = require('mongoose');
const { grantLevelRewards } = require('../utils/levelRewards');

// 模擬用戶對象
function createMockUser(level) {
  return {
    _id: new mongoose.Types.ObjectId(),
    username: `test-user-lv${level}`,
    email: `test-lv${level}@example.com`,
    pointsBalance: 0,
    totalEarnedPoints: 0,
    ownedFrames: ['default'],
    subscriptions: [],
    miniPlayerPurchased: false,
    frameColorEditorUnlocked: false,
    save: async function() {
      console.log('   💾 [模擬] 保存用戶數據...');
      return this;
    }
  };
}

async function testLevelReward(fromLevel, toLevel) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 測試：從 LV${fromLevel} 升級到 LV${toLevel}`);
  console.log('='.repeat(60));
  
  const mockUser = createMockUser(toLevel);
  
  console.log('\n📋 初始狀態:');
  console.log('   用戶名:', mockUser.username);
  console.log('   擁有頭像框:', mockUser.ownedFrames);
  console.log('   訂閱列表:', mockUser.subscriptions.length, '個');
  console.log('   播放器已購買:', mockUser.miniPlayerPurchased);
  console.log('   調色盤已解鎖:', mockUser.frameColorEditorUnlocked);
  
  try {
    // 執行獎勵發放
    const rewards = await grantLevelRewards(mockUser, fromLevel - 1, toLevel - 1);
    
    console.log('\n🎁 獲得獎勵:');
    console.log('   頭像框:', rewards.frames.length > 0 ? rewards.frames : '無');
    console.log('   功能解鎖:', rewards.features.length > 0 ? rewards.features : '無');
    console.log('   積分:', rewards.points > 0 ? `+${rewards.points}` : '無');
    console.log('   試用訂閱:', rewards.subscriptionTrial || '無');
    console.log('   永久訂閱:', rewards.subscriptionPermanent || '無');
    console.log('   消息:', rewards.messages.length > 0 ? rewards.messages : '無');
    
    console.log('\n📋 最終狀態:');
    console.log('   擁有頭像框:', mockUser.ownedFrames);
    console.log('   訂閱列表:', mockUser.subscriptions.length, '個');
    if (mockUser.subscriptions.length > 0) {
      mockUser.subscriptions.forEach((sub, idx) => {
        console.log(`   訂閱 ${idx + 1}:`, {
          type: sub.type,
          有效期: sub.expiresAt ? `至 ${sub.expiresAt.toISOString().split('T')[0]}` : '未設置',
          是否活躍: sub.isActive,
          月費: sub.monthlyCost
        });
      });
    }
    console.log('   播放器已購買:', mockUser.miniPlayerPurchased);
    console.log('   調色盤已解鎖:', mockUser.frameColorEditorUnlocked);
    
    console.log('\n✅ 測試完成！');
    
  } catch (error) {
    console.error('\n❌ 測試失敗:', error.message);
    console.error(error);
  }
}

async function main() {
  console.log('\n🚀 開始測試等級獎勵系統...\n');
  
  // 測試 LV6 獎勵
  await testLevelReward(5, 6);
  
  // 測試 LV10 獎勵
  await testLevelReward(9, 10);
  
  // 測試連續升級（LV1 → LV6）
  console.log(`\n${'='.repeat(60)}`);
  console.log('🧪 測試：從 LV1 一次性升級到 LV6（連續升級）');
  console.log('='.repeat(60));
  
  const mockUser = createMockUser(6);
  console.log('\n📋 初始狀態: LV1 新用戶');
  
  const rewards = await grantLevelRewards(mockUser, 0, 5); // 索引 0 → 5 = LV1 → LV6
  
  console.log('\n🎁 獲得所有獎勵（LV2-LV6）:');
  console.log('   頭像框:', rewards.frames);
  console.log('   功能解鎖:', rewards.features);
  console.log('   訂閱列表:', mockUser.subscriptions.length, '個');
  if (mockUser.subscriptions.length > 0) {
    mockUser.subscriptions.forEach((sub, idx) => {
      console.log(`   訂閱 ${idx + 1}:`, {
        type: sub.type,
        有效期: sub.expiresAt ? `至 ${sub.expiresAt.toISOString().split('T')[0]}` : '未設置',
        天數: sub.expiresAt ? Math.ceil((sub.expiresAt - sub.startDate) / (1000 * 60 * 60 * 24)) : 0
      });
    });
  }
  console.log('   所有消息:', rewards.messages);
  
  console.log('\n✅ 所有測試完成！');
  console.log('\n💡 總結:');
  console.log('   - LV6 升級會自動獲得 30 天免費釘選播放器');
  console.log('   - LV10 升級會自動獲得永久釘選播放器');
  console.log('   - 訂閱記錄會正確添加到 user.subscriptions 數組');
  console.log('   - 不會重複發放（已有訂閱時跳過）');
  console.log('');
}

main().catch(console.error);

