/**
 * 🧪 完整系統測試套件
 * 用途：一次執行所有穩定性測試
 */

const { spawn } = require('child_process');
const path = require('path');

const tests = [
  {
    name: '資料完整性測試',
    script: 'data-integrity-test.js',
    description: '檢查資料庫數據一致性',
    emoji: '🔒'
  },
  {
    name: '播放器系統測試',
    script: 'player-system-test.js',
    description: '測試播放器功能完整性',
    emoji: '🎵'
  },
  // 注意：冒煙測試需要開發伺服器運行，所以放在最後
  {
    name: '冒煙測試',
    script: 'smoke-test.js',
    description: '測試核心 API 功能（需要伺服器運行）',
    emoji: '🔥',
    requiresServer: true
  }
];

async function runTest(test) {
  return new Promise((resolve) => {
    console.log(`\n${test.emoji} 開始執行: ${test.name}`);
    console.log(`📝 說明: ${test.description}`);
    console.log('━'.repeat(50));

    const child = spawn('node', [path.join(__dirname, test.script)], {
      stdio: 'inherit',
      shell: true
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${test.name} 通過`);
        resolve({ name: test.name, passed: true });
      } else {
        console.log(`❌ ${test.name} 失敗`);
        resolve({ name: test.name, passed: false });
      }
    });

    child.on('error', (error) => {
      console.log(`❌ ${test.name} 執行錯誤: ${error.message}`);
      resolve({ name: test.name, passed: false, error: error.message });
    });
  });
}

async function runAllTests() {
  console.log('🧪 開始執行完整系統測試套件');
  console.log('================================');
  console.log(`📋 總共 ${tests.length} 個測試\n`);

  const results = [];

  for (const test of tests) {
    if (test.requiresServer) {
      console.log('\n⚠️  下一個測試需要開發伺服器運行');
      console.log('💡 如果伺服器未運行，此測試將失敗');
      console.log('💡 可以按 Ctrl+C 跳過此測試\n');
      
      // 等待 3 秒讓用戶有時間取消
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    const result = await runTest(test);
    results.push(result);
  }

  // 總結報告
  console.log('\n');
  console.log('═'.repeat(50));
  console.log('📊 測試結果總結');
  console.log('═'.repeat(50));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  results.forEach(result => {
    const status = result.passed ? '✅' : '❌';
    const error = result.error ? ` (${result.error})` : '';
    console.log(`${status} ${result.name}${error}`);
  });

  console.log('\n📈 統計:');
  console.log(`   通過: ${passed}/${tests.length}`);
  console.log(`   失敗: ${failed}/${tests.length}`);
  console.log(`   成功率: ${((passed / tests.length) * 100).toFixed(1)}%`);

  if (failed === 0) {
    console.log('\n🎉 所有測試通過！系統穩定性良好');
    console.log('✅ 系統可以安全運行');
  } else {
    console.log('\n⚠️  部分測試失敗，建議檢查問題');
    console.log('💡 查看上方詳細錯誤信息');
  }

  console.log('\n💡 提示：');
  console.log('   - 可以單獨執行每個測試腳本查看詳細信息');
  console.log('   - 資料完整性測試和播放器測試不需要伺服器運行');
  console.log('   - 冒煙測試需要先啟動開發伺服器 (npm run dev)');

  process.exit(failed === 0 ? 0 : 1);
}

runAllTests().catch(error => {
  console.error('❌ 測試套件執行失敗:', error);
  process.exit(1);
});

