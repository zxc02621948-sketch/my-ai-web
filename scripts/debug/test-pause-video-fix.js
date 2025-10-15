/**
 * 測試 pauseVideo 修復腳本
 * 專門測試 pauseVideo 調用時的 null 引用錯誤修復
 */

const fs = require('fs');
const path = require('path');

class PauseVideoFixTester {
  constructor() {
    this.testResults = [];
  }

  // 檢查 pauseVideo 修復
  testPauseVideoFix() {
    console.log('🔍 檢查 pauseVideo 修復...');
    
    const filePath = path.join(__dirname, 'components/player/GlobalYouTubeBridge.jsx');
    const content = fs.readFileSync(filePath, 'utf8');
    
    const checks = [
      {
        name: 'pauseVideo 函數檢查',
        pattern: /typeof ytRef\.current\.pauseVideo === 'function'/,
        required: true
      },
      {
        name: 'getPlayerState 函數檢查',
        pattern: /typeof ytRef\.current\.getPlayerState === 'function'/,
        required: true
      },
      {
        name: '狀態有效性檢查',
        pattern: /state !== undefined && state !== null/,
        required: true
      },
      {
        name: '安全調用 stopVideo',
        pattern: /typeof ytRef\.current\.stopVideo === 'function'/,
        required: true
      },
      {
        name: '安全調用 destroy',
        pattern: /typeof ytRef\.current\.destroy === 'function'/,
        required: true
      },
      {
        name: '防重複初始化',
        pattern: /if \(ytRef\.current === p\)/,
        required: true
      }
    ];

    console.log('📋 檢查結果:');
    checks.forEach(check => {
      const found = check.pattern.test(content);
      const status = found ? '✅' : '❌';
      console.log(`  ${status} ${check.name}`);
      
      this.testResults.push({
        test: check.name,
        status: found ? 'PASS' : 'FAIL',
        required: check.required
      });
    });

    return this.testResults;
  }

  // 檢查錯誤處理改進
  testErrorHandlingImprovements() {
    console.log('\n🔍 檢查錯誤處理改進...');
    
    const filePath = path.join(__dirname, 'components/player/GlobalYouTubeBridge.jsx');
    const content = fs.readFileSync(filePath, 'utf8');
    
    const improvements = [
      {
        name: 'Try-catch 包裝',
        pattern: /try\s*\{[\s\S]*pauseVideo[\s\S]*\}\s*catch/,
        found: /try\s*\{[\s\S]*pauseVideo[\s\S]*\}\s*catch/.test(content)
      },
      {
        name: 'Null 檢查',
        pattern: /ytRef\?\.current/,
        found: /ytRef\?\.current/.test(content)
      },
      {
        name: '函數存在性檢查',
        pattern: /typeof.*=== 'function'/,
        found: /typeof.*=== 'function'/.test(content)
      }
    ];

    console.log('📋 改進檢查:');
    improvements.forEach(improvement => {
      const status = improvement.found ? '✅' : '❌';
      console.log(`  ${status} ${improvement.name}`);
    });

    return improvements;
  }

  // 檢查可能的問題
  checkPotentialIssues() {
    console.log('\n🔍 檢查潛在問題...');
    
    const filePath = path.join(__dirname, 'components/player/GlobalYouTubeBridge.jsx');
    const content = fs.readFileSync(filePath, 'utf8');
    
    const issues = [];
    
    // 檢查是否有直接調用 pauseVideo 而沒有檢查的地方
    const directPauseCalls = content.match(/ytRef\.current\.pauseVideo\(\)/g);
    const safePauseCalls = content.match(/typeof ytRef\.current\.pauseVideo === 'function'/g);
    
    if (directPauseCalls && safePauseCalls) {
      if (directPauseCalls.length > safePauseCalls.length) {
        issues.push({
          type: '不安全的 pauseVideo 調用',
          severity: 'HIGH',
          message: `發現 ${directPauseCalls.length} 個 pauseVideo 調用，但只有 ${safePauseCalls.length} 個安全檢查`
        });
      }
    }
    
    // 檢查是否有 src 操作
    const srcOperations = content.match(/\.src\s*=/g);
    if (srcOperations) {
      issues.push({
        type: 'Src 操作',
        severity: 'HIGH',
        message: `發現 ${srcOperations.length} 個 src 操作，可能導致錯誤`
      });
    }
    
    // 檢查重複初始化
    const onReadyCalls = content.match(/onReady.*=.*useCallback/g);
    if (onReadyCalls && onReadyCalls.length > 1) {
      issues.push({
        type: '重複 onReady 定義',
        severity: 'MEDIUM',
        message: `發現 ${onReadyCalls.length} 個 onReady 定義`
      });
    }

    if (issues.length > 0) {
      console.log('⚠️ 發現潛在問題:');
      issues.forEach(issue => {
        const severityIcon = issue.severity === 'HIGH' ? '🔴' : '🟡';
        console.log(`  ${severityIcon} ${issue.type}: ${issue.message}`);
      });
    } else {
      console.log('✅ 未發現明顯問題');
    }

    return issues;
  }

  // 生成修復建議
  generateFixSuggestions() {
    console.log('\n💡 修復建議:');
    
    const failedTests = this.testResults.filter(r => r.status === 'FAIL' && r.required);
    
    if (failedTests.length > 0) {
      console.log('🔧 需要修復的問題:');
      failedTests.forEach(test => {
        console.log(`  - ${test.test}`);
      });
    } else {
      console.log('✅ 所有關鍵修復都已實施');
    }
    
    console.log('\n🧪 測試建議:');
    console.log('1. 重新啟動開發服務器');
    console.log('2. 清除瀏覽器緩存');
    console.log('3. 測試切換歌曲功能');
    console.log('4. 檢查控制台是否還有 pauseVideo 錯誤');
  }

  // 運行完整測試
  runFullTest() {
    console.log('🧪 開始 pauseVideo 修復測試...\n');
    
    const pauseVideoResults = this.testPauseVideoFix();
    const errorHandlingResults = this.testErrorHandlingImprovements();
    const potentialIssues = this.checkPotentialIssues();
    
    this.generateFixSuggestions();
    
    // 生成測試報告
    const totalTests = pauseVideoResults.length;
    const passedTests = pauseVideoResults.filter(r => r.status === 'PASS').length;
    const successRate = (passedTests / totalTests) * 100;
    
    console.log('\n📊 測試總結:');
    console.log(`✅ 通過: ${passedTests}/${totalTests}`);
    console.log(`📈 成功率: ${successRate.toFixed(1)}%`);
    
    if (successRate === 100) {
      console.log('🎉 所有修復都已正確實施！');
    } else {
      console.log('⚠️ 部分修復可能需要進一步檢查');
    }
    
    return {
      totalTests,
      passedTests,
      successRate,
      issues: potentialIssues
    };
  }
}

// 運行測試
const tester = new PauseVideoFixTester();
tester.runFullTest();
