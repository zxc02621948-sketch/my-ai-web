#!/usr/bin/env node

/**
 * 計算壓力測試結果對應的用戶規模
 * 分析100個請求相當於多少日活躍用戶
 */

// 測試結果
const testResults = {
  totalRequests: 100,
  duration: 1.22, // 秒
  rps: 81.83, // 請求/秒
  avgResponseTime: 43.64, // 毫秒
};

// 用戶行為假設
const userBehavior = {
  // 平均每個用戶在一個會話中的API請求數
  requestsPerSession: 10, // 瀏覽列表(1) + 查看3個內容(3) + 搜索(1) + 其他操作(5) = 約10個請求
  
  // 用戶平均會話時長（分鐘）
  sessionDuration: 15, // 15分鐘
  
  // 用戶訪問頻率（每日會話數）
  sessionsPerDay: 2, // 平均每天訪問2次
  
  // 活躍時間段（每天網站活躍的小時數）
  activeHoursPerDay: 16, // 早上8點到晚上12點
  
  // 峰值係數（峰值流量是平均流量的倍數）
  peakMultiplier: 3, // 峰值時段流量是平均的3倍
};

console.log('═══════════════════════════════════════════════════════════');
console.log('📊 壓力測試結果分析：用戶規模估算');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('🔍 測試結果:');
console.log(`   總請求數: ${testResults.totalRequests}`);
console.log(`   持續時間: ${testResults.duration} 秒`);
console.log(`   請求速率: ${testResults.rps} 請求/秒\n`);

console.log('👤 用戶行為假設:');
console.log(`   每次會話的API請求數: ${userBehavior.requestsPerSession} 個`);
console.log(`   平均會話時長: ${userBehavior.sessionDuration} 分鐘`);
console.log(`   每日會話數: ${userBehavior.sessionsPerDay} 次`);
console.log(`   網站活躍時段: ${userBehavior.activeHoursPerDay} 小時/天`);
console.log(`   峰值係數: ${userBehavior.peakMultiplier}x\n`);

// 計算方式 1: 基於測試時的並發用戶數
const concurrentUsers = testResults.totalRequests / userBehavior.requestsPerSession;
console.log('═══════════════════════════════════════════════════════════');
console.log('📈 估算結果');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('1️⃣  瞬時並發用戶數（測試期間）:');
console.log(`   ${testResults.totalRequests} 個請求 ÷ ${userBehavior.requestsPerSession} 請求/用戶`);
console.log(`   = ${concurrentUsers.toFixed(1)} 個用戶同時在線\n`);

// 計算方式 2: 基於請求速率推算
const requestsPerUserPerDay = userBehavior.requestsPerSession * userBehavior.sessionsPerDay;
console.log('2️⃣  每用戶每日請求數:');
console.log(`   ${userBehavior.requestsPerSession} 請求/會話 × ${userBehavior.sessionsPerDay} 會話/天`);
console.log(`   = ${requestsPerUserPerDay} 請求/用戶/天\n`);

// 計算方式 3: 如果網站以測試速率運行
const requestsPerDayAtTestRate = testResults.rps * 60 * 60 * 24; // RPS × 秒/小時 × 小時/天
const dailyUsersAtTestRate = requestsPerDayAtTestRate / requestsPerUserPerDay;
console.log('3️⃣  如果網站持續以測試速率運行:');
console.log(`   每日請求數: ${testResults.rps.toFixed(2)} RPS × 86,400 秒/天`);
console.log(`   = ${requestsPerDayAtTestRate.toLocaleString()} 請求/天`);
console.log(`   每日用戶數: ${requestsPerDayAtTestRate.toLocaleString()} ÷ ${requestsPerUserPerDay}`);
console.log(`   = ${dailyUsersAtTestRate.toLocaleString()} 日活躍用戶\n`);

// 計算方式 4: 基於活躍時段和峰值係數（更現實）
const avgRPS = testResults.rps / userBehavior.peakMultiplier; // 平均RPS = 峰值RPS / 峰值係數
const requestsPerDayRealistic = avgRPS * 60 * 60 * userBehavior.activeHoursPerDay;
const dailyUsersRealistic = requestsPerDayRealistic / requestsPerUserPerDay;
console.log('4️⃣  基於活躍時段和峰值係數（更現實）:');
console.log(`   平均RPS: ${testResults.rps.toFixed(2)} ÷ ${userBehavior.peakMultiplier} = ${avgRPS.toFixed(2)} RPS`);
console.log(`   活躍時段請求數: ${avgRPS.toFixed(2)} RPS × ${userBehavior.activeHoursPerDay * 60 * 60} 秒`);
console.log(`   = ${requestsPerDayRealistic.toLocaleString()} 請求/天`);
console.log(`   日活躍用戶數: ${requestsPerDayRealistic.toLocaleString()} ÷ ${requestsPerUserPerDay}`);
console.log(`   = ${dailyUsersRealistic.toLocaleString()} 日活躍用戶\n`);

// 計算方式 5: 不同場景下的估算
console.log('═══════════════════════════════════════════════════════════');
console.log('🎯 不同場景下的用戶規模估算');
console.log('═══════════════════════════════════════════════════════════\n');

const scenarios = [
  { name: '輕度使用', requestsPerSession: 5, sessionsPerDay: 1 },
  { name: '中度使用', requestsPerSession: 10, sessionsPerDay: 2 },
  { name: '重度使用', requestsPerSession: 20, sessionsPerDay: 3 },
  { name: '專業用戶', requestsPerSession: 30, sessionsPerDay: 5 },
];

scenarios.forEach(scenario => {
  const reqPerDay = scenario.requestsPerSession * scenario.sessionsPerDay;
  const users = requestsPerDayRealistic / reqPerDay;
  console.log(`📱 ${scenario.name}:`);
  console.log(`   ${scenario.requestsPerSession} 請求/會話 × ${scenario.sessionsPerDay} 會話/天 = ${reqPerDay} 請求/天`);
  console.log(`   日活躍用戶數: ${users.toLocaleString()} 人\n`);
});

// 計算峰值負載能力
console.log('═══════════════════════════════════════════════════════════');
console.log('⚡ 峰值負載能力分析');
console.log('═══════════════════════════════════════════════════════════\n');

const peakRequestsPerSecond = testResults.rps;
const peakConcurrentUsers = peakRequestsPerSecond / userBehavior.requestsPerSession;

console.log(`當前測試性能: ${peakRequestsPerSecond.toFixed(2)} RPS`);
console.log(`峰值並發用戶數: ${peakConcurrentUsers.toFixed(0)} 用戶/秒\n`);

console.log('💡 建議:');
console.log('   • 這個測試代表網站可以同時處理約 ' + Math.floor(peakConcurrentUsers) + ' 個活躍用戶');
console.log('   • 如果平均每個用戶每 ' + (userBehavior.sessionDuration * 60 / userBehavior.requestsPerSession).toFixed(0) + ' 秒發送一個請求');
console.log('   • 實際並發在線用戶數可能會更高（因為有間隔時間）');
console.log('   • 建議預留 50% 的緩衝空間，以應對流量波動\n');

console.log('═══════════════════════════════════════════════════════════\n');

