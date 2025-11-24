#!/usr/bin/env node

/**
 * 單個內容詳情 API 壓力測試
 * 測試彈窗加載時的 API 性能（圖片/影片/音樂詳情）
 * 
 * 使用方式:
 *   node scripts/stress-test-details.js --url http://localhost:3000
 *   node scripts/stress-test-details.js --url http://localhost:3000 --concurrent 10 --requests 50
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

// ==================== 配置 ====================
const DEFAULT_CONFIG = {
  baseUrl: process.env.TEST_URL || 'http://localhost:3000',
  concurrent: parseInt(process.env.CONCURRENT) || 5,
  requests: parseInt(process.env.REQUESTS) || 50,
  timeout: 30000,
  warmupRequests: 3,
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
  }
}

// ==================== 先獲取一些實際的 ID ====================
async function fetchSampleIds(baseUrl, timeout = 10000) {
  const client = baseUrl.startsWith('https') ? https : http;
  const parsedUrl = new URL(baseUrl);
  
  const fetchIds = async (path) => {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: path,
        method: 'GET',
        headers: {
          'User-Agent': 'StressTest/1.0',
          'Accept': 'application/json',
        },
        timeout: timeout,
      };

      const req = client.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            const items = json.items || json.videos || json.music || json.images || [];
            resolve(items.slice(0, 10).map(item => item._id || item.id).filter(Boolean));
          } catch (e) {
            resolve([]);
          }
        });
      });

      req.on('error', () => resolve([]));
      req.on('timeout', () => { req.destroy(); resolve([]); });
      req.end();
    });
  };

  try {
    const [images, videos, music] = await Promise.all([
      fetchIds('/api/images?page=1&limit=10&sort=popular'),
      fetchIds('/api/videos?page=1&limit=10&sort=popular'),
      fetchIds('/api/music?page=1&limit=10&sort=popular'),
    ]);

    return { images, videos, music };
  } catch (error) {
    console.error('⚠️ 無法獲取測試 ID，將使用示例 ID');
    return { images: [], videos: [], music: [] };
  }
}

// ==================== API 端點 ====================
async function getDetailEndpoints(baseUrl) {
  const ids = await fetchSampleIds(baseUrl);
  const endpoints = [];

  // 圖片詳情
  ids.images.forEach(id => {
    endpoints.push({
      path: `/api/images/${id}`,
      name: '圖片詳情',
      method: 'GET',
      type: 'image',
    });
  });

  // 影片詳情
  ids.videos.forEach(id => {
    endpoints.push({
      path: `/api/videos/${id}`,
      name: '影片詳情',
      method: 'GET',
      type: 'video',
    });
  });

  // 音樂詳情
  ids.music.forEach(id => {
    endpoints.push({
      path: `/api/music/${id}`,
      name: '音樂詳情',
      method: 'GET',
      type: 'music',
    });
  });

  return endpoints;
}

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
    this.byType = { image: [], video: [], music: [] };
    this.startTime = null;
    this.endTime = null;
  }

  recordRequest(statusCode, responseTime, error = null, type = null) {
    this.totalRequests++;
    this.responseTimes.push(responseTime);

    if (statusCode >= 200 && statusCode < 300) {
      this.successfulRequests++;
    } else {
      this.failedRequests++;
    }

    if (type && (statusCode >= 200 && statusCode < 300)) {
      this.byType[type].push(responseTime);
    }

    if (error) {
      this.errors.push({
        code: statusCode,
        message: error,
        time: responseTime,
        type,
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

    const getTypeStats = (times) => {
      if (times.length === 0) return null;
      const sorted = [...times].sort((a, b) => a - b);
      const calcP = (p) => {
        const idx = Math.ceil((sorted.length * p) / 100) - 1;
        return sorted[Math.max(0, idx)];
      };
      return {
        count: times.length,
        avg: times.reduce((a, b) => a + b, 0) / times.length,
        min: Math.min(...times),
        max: Math.max(...times),
        p50: calcP(50),
        p95: calcP(95),
        p99: calcP(99),
      };
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
      byType: {
        image: getTypeStats(this.byType.image),
        video: getTypeStats(this.byType.video),
        music: getTypeStats(this.byType.music),
      },
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
        statusCode: 0,
        error: error.message,
        responseTime,
      });
    });

    req.on('timeout', () => {
      req.destroy();
      const responseTime = Date.now() - startTime;
      reject({
        statusCode: 0,
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

  try {
    const response = await makeRequest(url, endpoint.method, config.timeout);
    stats.recordRequest(response.statusCode, response.responseTime, null, endpoint.type);
    
    if (config.verbose) {
      const icon = response.statusCode >= 200 && response.statusCode < 300 ? '✅' : '❌';
      console.log(`${icon} ${endpoint.name}: ${response.statusCode} (${response.responseTime}ms)`);
    }
  } catch (error) {
    stats.recordRequest(error.statusCode || 0, error.responseTime, error.error || error.message, endpoint.type);
    
    if (config.verbose) {
      console.log(`❌ ${endpoint.name}: ${error.error || error.message} (${error.responseTime}ms)`);
    }
  }
}

// ==================== 並發測試 ====================
async function runConcurrentTests(config, endpoints) {
  const stats = new Statistics();
  
  if (endpoints.length === 0) {
    throw new Error('沒有可用的測試端點，請確保網站有內容數據');
  }

  stats.startTime = Date.now();
  
  // 預熱請求
  if (config.warmupRequests > 0) {
    console.log(`\n🔥 預熱中... (${config.warmupRequests} 個請求)`);
    const warmupPromises = [];
    for (let i = 0; i < config.warmupRequests && i < endpoints.length; i++) {
      warmupPromises.push(runTest(endpoints[i], config, stats));
    }
    await Promise.all(warmupPromises);
  }

  // 正式測試
  console.log(`\n🚀 開始壓力測試...`);
  console.log(`   目標: ${config.requests} 個請求`);
  console.log(`   並發數: ${config.concurrent}`);
  console.log(`   可用端點: ${endpoints.length} 個`);
  console.log(`   圖片: ${endpoints.filter(e => e.type === 'image').length} 個`);
  console.log(`   影片: ${endpoints.filter(e => e.type === 'video').length} 個`);
  console.log(`   音樂: ${endpoints.filter(e => e.type === 'music').length} 個\n`);

  const allEndpoints = [];
  for (let i = 0; i < config.requests; i++) {
    const randomEndpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
    allEndpoints.push(randomEndpoint);
  }

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
  console.log('📊 詳情 API 壓力測試報告');
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

  // 按類型分組統計
  console.log('📊 按內容類型分組:');
  ['image', 'video', 'music'].forEach(type => {
    const typeStats = report.byType[type];
    if (typeStats) {
      const typeName = { image: '圖片', video: '影片', music: '音樂' }[type];
      console.log(`   ${typeName}:`);
      console.log(`      數量: ${typeStats.count}`);
      console.log(`      平均: ${typeStats.avg.toFixed(2)}ms`);
      console.log(`      P95: ${typeStats.p95.toFixed(2)}ms`);
      console.log(`      P99: ${typeStats.p99.toFixed(2)}ms`);
    }
  });
  console.log();

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
      const typeName = error.type ? { image: '圖片', video: '影片', music: '音樂' }[error.type] : '未知';
      console.log(`   ${index + 1}. [${typeName}] ${error.code || 'N/A'}: ${error.message} (${error.time}ms)`);
    });
  }

  console.log('\n═══════════════════════════════════════════════════════════\n');

  // 健康評估
  console.log('💡 健康評估:');
  if (parseFloat(report.successRate) >= 99) {
    console.log('   ✅ 優秀：成功率 ≥ 99%');
  } else if (parseFloat(report.successRate) >= 95) {
    console.log('   ⚠️  良好：成功率 ≥ 95%');
  } else {
    console.log('   ❌ 需要關注：成功率 < 95%');
  }

  if (report.avg < 500) {
    console.log('   ✅ 優秀：平均響應時間 < 500ms');
  } else if (report.avg < 1000) {
    console.log('   ⚠️  可接受：平均響應時間 < 1000ms');
  } else {
    console.log('   ❌ 需要優化：平均響應時間 > 1000ms');
  }

  console.log('\n');
}

// ==================== 主函數 ====================
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔥 詳情 API 壓力測試工具（彈窗加載測試）');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  console.log('⚙️  測試配置:');
  console.log(`   目標 URL: ${DEFAULT_CONFIG.baseUrl}`);
  console.log(`   並發數: ${DEFAULT_CONFIG.concurrent}`);
  console.log(`   總請求數: ${DEFAULT_CONFIG.requests}`);
  console.log(`   請求超時: ${DEFAULT_CONFIG.timeout}ms\n`);

  try {
    console.log('📋 正在獲取測試用的內容 ID...');
    const endpoints = await getDetailEndpoints(DEFAULT_CONFIG.baseUrl);
    
    if (endpoints.length === 0) {
      console.error('❌ 無法獲取測試用的內容 ID，請確保：');
      console.error('   1. 網站正在運行');
      console.error('   2. 網站中有圖片、影片或音樂內容');
      process.exit(1);
    }

    console.log(`✅ 找到 ${endpoints.length} 個可用的測試端點\n`);

    const stats = await runConcurrentTests(DEFAULT_CONFIG, endpoints);
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

module.exports = { runConcurrentTests, getDetailEndpoints, Statistics };

