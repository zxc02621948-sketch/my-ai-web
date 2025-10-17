/**
 * 🔥 冒煙測試 - 快速檢查核心功能
 * 用途：確認系統基本功能正常運行
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const TEST_USER = {
  username: 'cvb120g',
  // 注意：實際使用時需要有效的登入 token
};

async function smokeTest() {
  console.log('🔥 開始冒煙測試...');
  console.log('================================\n');

  const results = {
    passed: [],
    failed: [],
    warnings: []
  };

  // 測試 1: 首頁載入
  console.log('📋 測試 1: 首頁載入');
  try {
    const response = await axios.get(`${BASE_URL}`, { timeout: 5000 });
    if (response.status === 200) {
      console.log('✅ 首頁載入正常');
      results.passed.push('首頁載入');
    }
  } catch (error) {
    console.log(`❌ 首頁載入失敗: ${error.message}`);
    results.failed.push('首頁載入');
  }

  // 測試 2: API 健康檢查
  console.log('\n📋 測試 2: API 健康檢查');
  const apiEndpoints = [
    '/api/images',
    '/api/user-info',
    '/api/current-user',
  ];

  for (const endpoint of apiEndpoints) {
    try {
      const response = await axios.get(`${BASE_URL}${endpoint}`, { 
        timeout: 5000,
        validateStatus: (status) => status < 500 // 接受所有非 5xx 錯誤
      });
      if (response.status < 500) {
        console.log(`✅ ${endpoint} 回應正常 (${response.status})`);
        results.passed.push(endpoint);
      }
    } catch (error) {
      console.log(`❌ ${endpoint} 失敗: ${error.message}`);
      results.failed.push(endpoint);
    }
  }

  // 測試 3: 資料庫連接
  console.log('\n📋 測試 3: 資料庫連接');
  try {
    const response = await axios.get(`${BASE_URL}/api/images?limit=1`, { timeout: 5000 });
    if (response.status === 200) {
      console.log('✅ 資料庫連接正常');
      results.passed.push('資料庫連接');
    }
  } catch (error) {
    console.log(`❌ 資料庫連接失敗: ${error.message}`);
    results.failed.push('資料庫連接');
  }

  // 測試 4: 播放器相關 API
  console.log('\n📋 測試 4: 播放器功能');
  const playerEndpoints = [
    '/api/player/skin-settings',
  ];

  for (const endpoint of playerEndpoints) {
    try {
      const response = await axios.get(`${BASE_URL}${endpoint}`, { 
        timeout: 5000,
        validateStatus: (status) => status < 500
      });
      if (response.status < 500) {
        console.log(`✅ ${endpoint} 回應正常 (${response.status})`);
        results.passed.push(endpoint);
      }
    } catch (error) {
      console.log(`❌ ${endpoint} 失敗: ${error.message}`);
      results.failed.push(endpoint);
    }
  }

  // 總結
  console.log('\n================================');
  console.log('📊 測試結果總結:');
  console.log(`✅ 通過: ${results.passed.length} 項`);
  console.log(`❌ 失敗: ${results.failed.length} 項`);
  console.log(`⚠️  警告: ${results.warnings.length} 項`);

  if (results.failed.length === 0) {
    console.log('\n🎉 所有測試通過！系統運行正常');
    return true;
  } else {
    console.log('\n⚠️  發現問題，需要修復:');
    results.failed.forEach(item => console.log(`   - ${item}`));
    return false;
  }
}

// 執行測試
console.log('💡 提示：請確保開發伺服器正在運行 (npm run dev)');
console.log('💡 如果伺服器未運行，此測試將失敗\n');

smokeTest().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ 測試執行失敗:', error);
  process.exit(1);
});

