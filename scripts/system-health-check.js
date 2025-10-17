/**
 * 🏥 系統健康檢查
 * 用途：通過應用 API 檢查系統狀態（不需要直接連接資料庫）
 */

const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function healthCheck() {
  console.log('🏥 開始系統健康檢查...');
  console.log('================================');
  console.log(`📍 目標: ${BASE_URL}\n`);

  const results = {
    passed: [],
    failed: [],
    warnings: []
  };

  // 測試 1: 基本連接
  console.log('📋 測試 1: 應用基本連接');
  try {
    const response = await axios.get(`${BASE_URL}/api/images?limit=1`, { 
      timeout: 10000,
      validateStatus: (status) => status < 500
    });
    
    if (response.status === 200) {
      console.log('✅ 應用正常運行');
      console.log(`📊 回應時間: ${response.headers['x-response-time'] || '未知'}`);
      results.passed.push('應用連接');
    } else {
      console.log(`⚠️  應用回應異常: ${response.status}`);
      results.warnings.push(`應用回應 ${response.status}`);
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ 應用未運行，請先啟動開發伺服器 (npm run dev)');
      console.log('💡 此測試需要應用正在運行');
      return { error: '應用未運行', canContinue: false };
    } else {
      console.log(`❌ 連接失敗: ${error.message}`);
      results.failed.push('應用連接');
    }
  }

  // 測試 2: 資料庫連接狀態
  console.log('\n📋 測試 2: 資料庫連接狀態');
  try {
    const response = await axios.get(`${BASE_URL}/api/images?limit=1`, { timeout: 10000 });
    
    if (response.data) {
      console.log('✅ 資料庫連接正常');
      console.log(`📊 圖片數據: ${response.data.images ? response.data.images.length : 0} 筆`);
      results.passed.push('資料庫連接');
    }
  } catch (error) {
    console.log(`❌ 資料庫連接異常: ${error.message}`);
    results.failed.push('資料庫連接');
  }

  // 測試 3: 用戶系統
  console.log('\n📋 測試 3: 用戶系統');
  try {
    const response = await axios.get(`${BASE_URL}/api/user-info`, { 
      timeout: 10000,
      validateStatus: (status) => status < 500
    });
    
    if (response.status === 401 || response.status === 200) {
      console.log('✅ 用戶 API 正常運行');
      results.passed.push('用戶系統');
    } else {
      console.log(`⚠️  用戶 API 回應異常: ${response.status}`);
      results.warnings.push(`用戶 API ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ 用戶系統異常: ${error.message}`);
    results.failed.push('用戶系統');
  }

  // 測試 4: 播放器系統
  console.log('\n📋 測試 4: 播放器系統');
  try {
    const response = await axios.get(`${BASE_URL}/api/player/skin-settings`, { 
      timeout: 10000,
      validateStatus: (status) => status < 500
    });
    
    if (response.status === 401 || response.status === 200) {
      console.log('✅ 播放器 API 正常運行');
      results.passed.push('播放器系統');
    } else {
      console.log(`⚠️  播放器 API 回應異常: ${response.status}`);
      results.warnings.push(`播放器 API ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ 播放器系統異常: ${error.message}`);
    results.failed.push('播放器系統');
  }

  // 測試 5: 商城系統
  console.log('\n📋 測試 5: 商城系統');
  try {
    const response = await axios.post(`${BASE_URL}/api/store/purchase-premium-skin`, {}, { 
      timeout: 10000,
      validateStatus: (status) => status < 500
    });
    
    if (response.status === 401 || response.status === 400 || response.status === 200) {
      console.log('✅ 商城 API 正常運行');
      results.passed.push('商城系統');
    } else {
      console.log(`⚠️  商城 API 回應異常: ${response.status}`);
      results.warnings.push(`商城 API ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ 商城系統異常: ${error.message}`);
    results.failed.push('商城系統');
  }

  // 測試 6: 愛心數據一致性檢查（乾跑模式）
  console.log('\n📋 測試 6: 愛心數據一致性');
  try {
    const response = await axios.get(`${BASE_URL}/api/images?repairLikes=1&dry=1`, { 
      timeout: 30000 
    });
    
    if (response.data) {
      const { scanned, modified } = response.data;
      console.log(`✅ 掃描了 ${scanned} 張圖片`);
      
      if (modified === 0) {
        console.log('✅ 所有圖片愛心數據一致');
        results.passed.push('愛心數據一致性');
      } else {
        console.log(`⚠️  發現 ${modified} 張圖片需要修復`);
        console.log('💡 可執行修復: curl "http://localhost:3000/api/images?repairLikes=1"');
        results.warnings.push(`${modified} 張圖片需要修復`);
      }
    }
  } catch (error) {
    console.log(`⚠️  無法檢查愛心數據: ${error.message}`);
    results.warnings.push('無法檢查愛心數據');
  }

  // 總結
  console.log('\n================================');
  console.log('📊 健康檢查結果總結:');
  console.log(`✅ 正常: ${results.passed.length} 項`);
  console.log(`❌ 異常: ${results.failed.length} 項`);
  console.log(`⚠️  警告: ${results.warnings.length} 項`);

  if (results.passed.length > 0) {
    console.log('\n✅ 通過的項目:');
    results.passed.forEach(item => console.log(`   - ${item}`));
  }

  if (results.failed.length > 0) {
    console.log('\n❌ 異常的項目:');
    results.failed.forEach(item => console.log(`   - ${item}`));
  }

  if (results.warnings.length > 0) {
    console.log('\n⚠️  警告的項目:');
    results.warnings.forEach(item => console.log(`   - ${item}`));
  }

  // 評分
  const totalTests = results.passed.length + results.failed.length + results.warnings.length;
  const score = ((results.passed.length / totalTests) * 100).toFixed(1);
  
  console.log(`\n📈 健康評分: ${score}%`);

  if (results.failed.length === 0 && results.warnings.length === 0) {
    console.log('🎉 系統完全健康！');
    return { health: 'excellent', score: 100 };
  } else if (results.failed.length === 0) {
    console.log('✅ 系統基本健康，有一些可優化項目');
    return { health: 'good', score: parseFloat(score) };
  } else if (results.passed.length > results.failed.length) {
    console.log('⚠️  系統部分功能異常，建議檢查');
    return { health: 'warning', score: parseFloat(score) };
  } else {
    console.log('❌ 系統存在嚴重問題，需要立即修復');
    return { health: 'critical', score: parseFloat(score) };
  }
}

// 執行健康檢查
console.log('💡 提示：此測試需要應用正在運行');
console.log('💡 如果應用未運行，請先執行: npm run dev\n');

healthCheck()
  .then(result => {
    if (result.error === '應用未運行') {
      console.log('\n💡 請先啟動應用，然後重新運行此測試');
      process.exit(1);
    } else if (result.health === 'excellent' || result.health === 'good') {
      process.exit(0);
    } else {
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ 健康檢查失敗:', error.message);
    process.exit(1);
  });

