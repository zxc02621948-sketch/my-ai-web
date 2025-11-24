#!/usr/bin/env node

/**
 * 網站壓力測試腳本
 * 測試主要 API 端點的負載能力和響應時間
 * 
 * 使用方式:
 *   node scripts/stress-test.js
 *   node scripts/stress-test.js --url http://localhost:3000 --concurrent 10 --requests 100
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

// ==================== 配置 ====================
const DEFAULT_CONFIG = {
  baseUrl: process.env.TEST_URL || 'http://localhost:3000',
  concurrent: parseInt(process.env.CONCURRENT) || 5, // 並發數
  requests: parseInt(process.env.REQUESTS) || 100, // 總請求數
  timeout: 30000, // 請求超時（毫秒）
  warmupRequests: 5, // 預熱請求數
  verbose: process.argv.includes('--verbose') || process.argv.includes('-v'),
};

// 解析命令行參數
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i += 2) {
  const key = args[i];
  const value = args[i + 1];
  if (key === '--url' || key === '-u') {
    DEFAULT_CONFIG.baseUrl = value;
  } else if (key === '--concurrent' || key === '-c') {
    DEFAULT_CONFIG.concurrent = parseInt(value);
  } else if (key === '--requests' || key === '-r') {
    DEFAULT_CONFIG.requests = parseInt(value);
  } else if (key === '--timeout' || key === '-t') {
    DEFAULT_CONFIG.timeout = parseInt(value);
  }
}

// ==================== API 端點列表 ====================
const ENDPOINTS = [
  // 圖片相關
  { path: '/api/images?page=1&limit=20&sort=popular', name: '圖片列表（熱門）', method: 'GET', requiresAuth: false },
  { path: '/api/images?page=1&limit=20&sort=newest', name: '圖片列表（最新）', method: 'GET', requiresAuth: false },
  { path: '/api/images?page=1&limit=20&sort=random', name: '圖片列表（隨機）', method: 'GET', requiresAuth: false },
  
  // 影片相關
  { path: '/api/videos?page=1&limit=20&sort=popular', name: '影片列表（熱門）', method: 'GET', requiresAuth: false },
  { path: '/api/videos?page=1&limit=20&sort=newest', name: '影片列表（最新）', method: 'GET', requiresAuth: false },
  
  // 音樂相關
  { path: '/api/music?page=1&limit=20&sort=popular', name: '音樂列表（熱門）', method: 'GET', requiresAuth: false },
  { path: '/api/music?page=1&limit=20&sort=newest', name: '音樂列表（最新）', method: 'GET', requiresAuth: false },
  
  // 用戶相關（需要認證，但 401 視為正常）
  { path: '/api/current-user', name: '當前用戶', method: 'GET', requiresAuth: true },
  { path: '/api/user-info', name: '用戶資訊', method: 'GET', requiresAuth: true },
  
  // 健康檢查
  { path: '/api/health-check', name: '健康檢查', method: 'GET', requiresAuth: false },
  
  // 其他
  { path: '/api/points/level', name: '積分等級', method: 'GET', requiresAuth: true },
  { path: '/api/trending-searches', name: '熱門搜尋', method: 'GET', requiresAuth: false },
];

// 可選：僅測試公開端點（排除需要認證的）
const PUBLIC_ONLY_MODE = process.argv.includes('--public-only');

// ==================== 統計數據 ====================
class Statistics {
  constructor() {
    this.reset();
  }

  reset() {
    this.totalRequests = 0;
    this.successfulRequests = 0;
    this.failedRequests = 0;
    this.responseTimes = [];
    this.errors = [];
    this.statusCodes = {};
    this.startTime = null;
    this.endTime = null;
  }

  recordRequest(statusCode, responseTime, error = null, isExpectedAuthError = false) {
    this.totalRequests++;
    this.responseTimes.push(responseTime);

    // 如果是預期的認證錯誤（401/403），不計入失敗
    if (isExpectedAuthError && (statusCode === 401 || statusCode === 403)) {
      this.successfulRequests++; // 視為"正常"響應
    } else if (statusCode >= 200 && statusCode < 300) {
      this.successfulRequests++;
    } else {
      this.failedRequests++;
    }

    if (error && !isExpectedAuthError) {
      this.errors.push({
        code: statusCode,
        message: error,
        time: responseTime,
      });
    }

    this.statusCodes[statusCode] = (this.statusCodes[statusCode] || 0) + 1;
  }

  getStats() {
    const sortedTimes = [...this.responseTimes].sort((a, b) => a - b);
    const count = sortedTimes.length;

    const calculatePercentile = (percentile) => {
      if (count === 0) return 0;
      const index = Math.ceil((count * percentile) / 100) - 1;
      return sortedTimes[Math.max(0, index)];
    };

    return {
      total: this.totalRequests,
      successful: this.successfulRequests,
      failed: this.failedRequests,
      successRate: ((this.successfulRequests / this.totalRequests) * 100).toFixed(2),
      min: count > 0 ? Math.min(...sortedTimes) : 0,
      max: count > 0 ? Math.max(...sortedTimes) : 0,
      avg: count > 0 ? sortedTimes.reduce((a, b) => a + b, 0) / count : 0,
      p50: calculatePercentile(50),
      p75: calculatePercentile(75),
      p90: calculatePercentile(90),
      p95: calculatePercentile(95),
      p99: calculatePercentile(99),
      statusCodes: this.statusCodes,
      errors: this.errors,
      duration: this.endTime ? this.endTime - this.startTime : 0,
      rps: this.endTime ? (this.totalRequests / ((this.endTime - this.startTime) / 1000)).toFixed(2) : 0,
    };
  }
}

// ==================== HTTP 請求函數 ====================
function makeRequest(url, method = 'GET', timeout = DEFAULT_CONFIG.timeout) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    const startTime = Date.now();

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: method,
      headers: {
        'User-Agent': 'StressTest/1.0',
        'Accept': 'application/json',
      },
      timeout: timeout,
    };

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          responseTime,
        });
      });
    });

    req.on('error', (error) => {
      const responseTime = Date.now() - startTime;
      reject({
        error: error.message,
        responseTime,
      });
    });

    req.on('timeout', () => {
      req.destroy();
      const responseTime = Date.now() - startTime;
      reject({
        error: 'Request timeout',
        responseTime,
      });
    });

    req.end();
  });
}

// ==================== 測試函數 ====================
async function runTest(endpoint, config, stats) {
  const url = `${config.baseUrl}${endpoint.path}`;
  const isExpectedAuthError = endpoint.requiresAuth === true;

  try {
    const response = await makeRequest(url, endpoint.method, config.timeout);
    // 如果是公開模式且端點不需要認證，但返回 401，這是不正常的
    const shouldIgnoreAuthError = isExpectedAuthError && !PUBLIC_ONLY_MODE;
    stats.recordRequest(response.statusCode, response.responseTime, null, shouldIgnoreAuthError);
    
    if (config.verbose) {
      const icon = (response.statusCode >= 200 && response.statusCode < 300) || 
                   (shouldIgnoreAuthError && (response.statusCode === 401 || response.statusCode === 403))
                   ? '✅' : '❌';
      console.log(`${icon} ${endpoint.name}: ${response.statusCode} (${response.responseTime}ms)`);
    }
  } catch (error) {
    const errorCode = error.statusCode || 0;
    const shouldIgnoreAuthError = isExpectedAuthError && !PUBLIC_ONLY_MODE && (errorCode === 401 || errorCode === 403);
    
    stats.recordRequest(errorCode, error.responseTime, error.error || error.message, shouldIgnoreAuthError);
    
    if (config.verbose) {
      const icon = shouldIgnoreAuthError ? '⚠️' : '❌';
      console.log(`${icon} ${endpoint.name}: ${error.error || error.message} (${error.responseTime}ms)`);
    }
  }
}

// ==================== 並發控制 ====================
async function runConcurrentTests(config) {
  const stats = new Statistics();
  const allEndpoints = [];
  
  // 如果使用 --public-only 模式，只測試公開端點
  const availableEndpoints = PUBLIC_ONLY_MODE 
    ? ENDPOINTS.filter(e => !e.requiresAuth)
    : ENDPOINTS;
  
  if (availableEndpoints.length === 0) {
    throw new Error('沒有可用的測試端點');
  }
  
  // 生成所有要測試的端點（隨機選擇以模擬真實場景）
  for (let i = 0; i < config.requests; i++) {
    const randomEndpoint = availableEndpoints[Math.floor(Math.random() * availableEndpoints.length)];
    allEndpoints.push(randomEndpoint);
  }

  stats.startTime = Date.now();
  
  // 預熱請求
  if (config.warmupRequests > 0) {
    console.log(`\n🔥 預熱中... (${config.warmupRequests} 個請求)`);
    const warmupPromises = [];
    for (let i = 0; i < config.warmupRequests; i++) {
      const endpoint = availableEndpoints[i % availableEndpoints.length];
      warmupPromises.push(runTest(endpoint, config, stats));
    }
    await Promise.all(warmupPromises);
  }

  // 正式測試
  console.log(`\n🚀 開始壓力測試...`);
  console.log(`   目標: ${config.requests} 個請求`);
  console.log(`   並發數: ${config.concurrent}`);
  console.log(`   端點數量: ${availableEndpoints.length} 種`);
  if (PUBLIC_ONLY_MODE) {
    console.log(`   ⚠️  僅測試公開端點（已排除需要認證的端點）`);
  }
  console.log();

  let completed = 0;
  let index = config.warmupRequests;

  while (index < allEndpoints.length) {
    const batch = [];
    for (let i = 0; i < config.concurrent && index < allEndpoints.length; i++) {
      batch.push(runTest(allEndpoints[index], config, stats));
      index++;
    }

    await Promise.all(batch);
    completed += batch.length;

    // 顯示進度
    const progress = ((completed / config.requests) * 100).toFixed(1);
    process.stdout.write(`\r   進度: ${completed}/${config.requests} (${progress}%)`);
  }

  stats.endTime = Date.now();
  console.log('\n');

  return stats;
}

// ==================== 報告生成 ====================
function printReport(stats, config) {
  const report = stats.getStats();
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 壓力測試報告');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  console.log('📈 總體統計:');
  console.log(`   總請求數: ${report.total}`);
  console.log(`   成功請求: ${report.successful} (${report.successRate}%)`);
  console.log(`   失敗請求: ${report.failed}`);
  console.log(`   持續時間: ${(report.duration / 1000).toFixed(2)} 秒`);
  console.log(`   請求速率: ${report.rps} 請求/秒\n`);

  console.log('⏱️  響應時間 (毫秒):');
  console.log(`   最小: ${report.min.toFixed(2)}`);
  console.log(`   最大: ${report.max.toFixed(2)}`);
  console.log(`   平均: ${report.avg.toFixed(2)}`);
  console.log(`   P50: ${report.p50.toFixed(2)}`);
  console.log(`   P75: ${report.p75.toFixed(2)}`);
  console.log(`   P90: ${report.p90.toFixed(2)}`);
  console.log(`   P95: ${report.p95.toFixed(2)}`);
  console.log(`   P99: ${report.p99.toFixed(2)}\n`);

  console.log('📊 HTTP 狀態碼分佈:');
  Object.entries(report.statusCodes)
    .sort((a, b) => b[1] - a[1])
    .forEach(([code, count]) => {
      const percentage = ((count / report.total) * 100).toFixed(1);
      console.log(`   ${code}: ${count} (${percentage}%)`);
    });

  if (report.errors.length > 0) {
    console.log('\n❌ 錯誤詳情 (前 10 個):');
    report.errors.slice(0, 10).forEach((error, index) => {
      console.log(`   ${index + 1}. ${error.code || 'N/A'}: ${error.message} (${error.time}ms)`);
    });
  }

  console.log('\n═══════════════════════════════════════════════════════════\n');

  // 健康評估
  console.log('💡 健康評估:');
  if (parseFloat(report.successRate) >= 99) {
    console.log('   ✅ 優秀：成功率 ≥ 99%');
  } else if (parseFloat(report.successRate) >= 95) {
    console.log('   ⚠️  良好：成功率 ≥ 95%，但仍有改進空間');
  } else {
    console.log('   ❌ 需要關注：成功率 < 95%，建議檢查伺服器狀態');
  }

  if (report.avg < 500) {
    console.log('   ✅ 優秀：平均響應時間 < 500ms');
  } else if (report.avg < 1000) {
    console.log('   ⚠️  可接受：平均響應時間 < 1000ms');
  } else {
    console.log('   ❌ 需要優化：平均響應時間 > 1000ms');
  }

  if (parseFloat(report.rps) >= 50) {
    console.log('   ✅ 優秀：吞吐量 ≥ 50 請求/秒');
  } else if (parseFloat(report.rps) >= 20) {
    console.log('   ⚠️  可接受：吞吐量 ≥ 20 請求/秒');
  } else {
    console.log('   ❌ 需要提升：吞吐量 < 20 請求/秒');
  }

  console.log('\n');
}

// ==================== 主函數 ====================
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔥 網站壓力測試工具');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const availableEndpoints = PUBLIC_ONLY_MODE 
    ? ENDPOINTS.filter(e => !e.requiresAuth)
    : ENDPOINTS;
  
  console.log('⚙️  測試配置:');
  console.log(`   目標 URL: ${DEFAULT_CONFIG.baseUrl}`);
  console.log(`   並發數: ${DEFAULT_CONFIG.concurrent}`);
  console.log(`   總請求數: ${DEFAULT_CONFIG.requests}`);
  console.log(`   請求超時: ${DEFAULT_CONFIG.timeout}ms`);
  console.log(`   測試端點: ${availableEndpoints.length} 個`);
  if (PUBLIC_ONLY_MODE) {
    console.log(`   模式: 僅公開端點（已排除 ${ENDPOINTS.filter(e => e.requiresAuth).length} 個需要認證的端點）`);
  } else {
    console.log(`   模式: 全部端點（含需要認證的，401/403 視為正常響應）`);
  }
  console.log();

  try {
    const stats = await runConcurrentTests(DEFAULT_CONFIG);
    printReport(stats, DEFAULT_CONFIG);
  } catch (error) {
    console.error('\n❌ 測試執行失敗:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 執行測試
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ 未處理的錯誤:', error);
    process.exit(1);
  });
}

module.exports = { runConcurrentTests, ENDPOINTS, Statistics };

