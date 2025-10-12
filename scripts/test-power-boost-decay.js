// scripts/test-power-boost-decay.js
// 測試權力券遞減邏輯

console.log('🧪 權力券遞減邏輯測試（單一加成系統）\n');
console.log('💡 核心概念：使用權力券 = 重置上架時間\n');

// 模擬常數（與後端一致）
const POP_NEW_WINDOW_HOURS = 10;

// 測試數據
const testCases = [
  { name: '剛使用權力券', hoursElapsed: 0 },
  { name: '使用後 1 小時', hoursElapsed: 1 },
  { name: '使用後 2.5 小時', hoursElapsed: 2.5 },
  { name: '使用後 5 小時', hoursElapsed: 5 },
  { name: '使用後 7.5 小時', hoursElapsed: 7.5 },
  { name: '使用後 9 小時', hoursElapsed: 9 },
  { name: '使用後 9.9 小時', hoursElapsed: 9.9 },
  { name: '使用後 10 小時', hoursElapsed: 10 },
  { name: '使用後 11 小時（過期）', hoursElapsed: 11 },
  { name: '使用後 24 小時（過期）', hoursElapsed: 24 },
];

// 模擬圖片數據
const mockImage = {
  initialBoost: 100, // 假設權力券給了 100 分加成
  clicks: 10,
  likesCount: 5,
  completenessScore: 50,
};

// 計算基礎分數
const POP_W_CLICK = 1.0;
const POP_W_LIKE = 8.0;
const POP_W_COMPLETE = 0.05;

const baseScore = 
  mockImage.clicks * POP_W_CLICK + 
  mockImage.likesCount * POP_W_LIKE + 
  mockImage.completenessScore * POP_W_COMPLETE;

console.log('📊 測試圖片數據:');
console.log(`   clicks: ${mockImage.clicks}`);
console.log(`   likesCount: ${mockImage.likesCount}`);
console.log(`   completenessScore: ${mockImage.completenessScore}`);
console.log(`   initialBoost: ${mockImage.initialBoost}`);
console.log(`   基礎分數: ${baseScore.toFixed(1)}\n`);

console.log('⏱️  權力券遞減測試:\n');

testCases.forEach((testCase) => {
  const { name, hoursElapsed } = testCase;
  
  // 計算權力券加成（模擬後端邏輯）
  let powerBoostCalc = 0;
  
  if (hoursElapsed < POP_NEW_WINDOW_HOURS) {
    // 計算遞減係數
    const powerBoostFactor = Math.max(0, 1 - (hoursElapsed / POP_NEW_WINDOW_HOURS));
    powerBoostCalc = Math.round(mockImage.initialBoost * powerBoostFactor);
  } else {
    // 超過 10 小時，加成為 0
    powerBoostCalc = 0;
  }
  
  const totalScore = baseScore + powerBoostCalc;
  const boostPercentage = ((powerBoostCalc / mockImage.initialBoost) * 100).toFixed(1);
  
  console.log(`🕐 ${name}:`);
  console.log(`   經過時間: ${hoursElapsed} 小時`);
  console.log(`   權力券加成: ${powerBoostCalc} 分 (${boostPercentage}%)`);
  console.log(`   總分: ${totalScore.toFixed(1)} (基礎 ${baseScore.toFixed(1)} + 加成 ${powerBoostCalc})`);
  
  // 檢查是否符合預期
  if (hoursElapsed === 0 && powerBoostCalc !== mockImage.initialBoost) {
    console.log(`   ❌ 錯誤: 應該是 100% 加成`);
  } else if (hoursElapsed === 5 && Math.abs(powerBoostCalc - mockImage.initialBoost * 0.5) > 1) {
    console.log(`   ❌ 錯誤: 應該是 50% 加成`);
  } else if (hoursElapsed >= 10 && powerBoostCalc !== 0) {
    console.log(`   ❌ 錯誤: 應該完全失效 (0 分)`);
  } else {
    console.log(`   ✅ 符合預期`);
  }
  
  console.log('');
});

console.log('📈 遞減曲線視覺化:\n');
console.log('時間 (小時) | 加成百分比 | 視覺化');
console.log('----------|----------|' + '-'.repeat(50));

for (let h = 0; h <= 12; h += 0.5) {
  let powerBoostFactor = 0;
  
  if (h < POP_NEW_WINDOW_HOURS) {
    powerBoostFactor = Math.max(0, 1 - (h / POP_NEW_WINDOW_HOURS));
  }
  
  const percentage = (powerBoostFactor * 100).toFixed(0);
  const barLength = Math.round(powerBoostFactor * 40);
  const bar = '█'.repeat(barLength) + '░'.repeat(40 - barLength);
  
  const timeStr = h.toFixed(1).padStart(4);
  const percentStr = percentage.padStart(3);
  
  console.log(`${timeStr}      | ${percentStr}%      | ${bar}`);
}

console.log('\n✅ 測試完成！\n');
console.log('💡 關鍵點:');
console.log('   • 0 小時: 100% 加成（完整的 initialBoost）');
console.log('   • 5 小時: 50% 加成（線性遞減）');
console.log('   • 10 小時: 0% 加成（完全失效）');
console.log('   • 10+ 小時: 保持 0%（不會變負數）\n');

