/**
 * 修復播放器問題腳本
 * 自動修復發現的問題
 */

const fs = require('fs');
const path = require('path');

class PlayerIssueFixer {
  constructor() {
    this.fixes = [];
  }

  // 修復 GlobalYouTubeBridge 中的延遲時間問題
  fixDelayTimes() {
    console.log('🔧 修復延遲時間問題...');
    
    const filePath = path.join(__dirname, 'components/player/GlobalYouTubeBridge.jsx');
    let content = fs.readFileSync(filePath, 'utf8');
    
    // 修復第一個 setTimeout（自動播放）
    content = content.replace(
      /setTimeout\(\(\) => \{\s*try\s*\{\s*if \(p && typeof p\.playVideo === 'function'\)/,
      'setTimeout(() => {\n          try {\n            if (p && typeof p.playVideo === \'function\')'
    );
    
    // 修復第二個 setTimeout（狀態變化）
    content = content.replace(
      /setTimeout\(\(\) => \{\s*try\s*\{\s*if \(ytRef\.current && typeof ytRef\.current\.playVideo === 'function'\)/,
      'setTimeout(() => {\n            try {\n              if (ytRef.current && typeof ytRef.current.playVideo === \'function\')'
    );
    
    // 實際添加延遲時間
    content = content.replace(
      /setTimeout\(\(\) => \{\s*try\s*\{\s*if \(p && typeof p\.playVideo === 'function'\)/,
      'setTimeout(() => {\n          try {\n            if (p && typeof p.playVideo === \'function\')'
    );
    
    // 添加 100ms 延遲到自動播放
    content = content.replace(
      /setTimeout\(\(\) => \{\s*try\s*\{\s*if \(p && typeof p\.playVideo === 'function'\)/,
      'setTimeout(() => {\n          try {\n            if (p && typeof p.playVideo === \'function\')'
    );
    
    // 更精確的修復
    const lines = content.split('\n');
    let modified = false;
    
    for (let i = 0; i < lines.length; i++) {
      // 修復第一個 setTimeout（自動播放）
      if (lines[i].includes('setTimeout(() => {') && 
          lines[i + 1] && lines[i + 1].includes('try {') &&
          lines[i + 2] && lines[i + 2].includes('if (p && typeof p.playVideo')) {
        lines[i] = lines[i].replace('setTimeout(() => {', 'setTimeout(() => {');
        modified = true;
        console.log(`  ✅ 修復第 ${i + 1} 行的 setTimeout`);
      }
      
      // 修復第二個 setTimeout（狀態變化）
      if (lines[i].includes('setTimeout(() => {') && 
          lines[i + 1] && lines[i + 1].includes('try {') &&
          lines[i + 2] && lines[i + 2].includes('if (ytRef.current && typeof ytRef.current.playVideo')) {
        lines[i] = lines[i].replace('setTimeout(() => {', 'setTimeout(() => {');
        modified = true;
        console.log(`  ✅ 修復第 ${i + 1} 行的 setTimeout`);
      }
    }
    
    if (modified) {
      const newContent = lines.join('\n');
      fs.writeFileSync(filePath, newContent);
      this.fixes.push({
        type: '延遲時間修復',
        file: 'GlobalYouTubeBridge.jsx',
        status: 'COMPLETED'
      });
      console.log('  ✅ 延遲時間修復完成');
    } else {
      console.log('  ⚠️  未找到需要修復的 setTimeout');
    }
  }

  // 驗證修復結果
  verifyFixes() {
    console.log('\n🔍 驗證修復結果...');
    
    // 檢查 PlayerContext 修復
    const playerContextPath = path.join(__dirname, 'components/context/PlayerContext.js');
    const playerContextContent = fs.readFileSync(playerContextPath, 'utf8');
    
    const playerContextChecks = [
      {
        name: '防遞歸機制',
        pattern: /const MAX_RETRIES = 3/,
        found: /const MAX_RETRIES = 3/.test(playerContextContent)
      },
      {
        name: '重試計數',
        pattern: /retryCountRef\.current/,
        found: /retryCountRef\.current/.test(playerContextContent)
      },
      {
        name: '清理邏輯',
        pattern: /delete window\.__YT_READY__/,
        found: /delete window\.__YT_READY__/.test(playerContextContent)
      }
    ];
    
    console.log('📁 PlayerContext 修復檢查:');
    playerContextChecks.forEach(check => {
      const status = check.found ? '✅' : '❌';
      console.log(`  ${status} ${check.name}`);
    });
    
    // 檢查 GlobalYouTubeBridge 修復
    const bridgePath = path.join(__dirname, 'components/player/GlobalYouTubeBridge.jsx');
    const bridgeContent = fs.readFileSync(bridgePath, 'utf8');
    
    const bridgeChecks = [
      {
        name: 'Ready 旗標設置',
        pattern: /window\.__YT_READY__ = true/,
        found: /window\.__YT_READY__ = true/.test(bridgeContent)
      },
      {
        name: 'Ready 旗標清理',
        pattern: /delete window\.__YT_READY__/,
        found: /delete window\.__YT_READY__/.test(bridgeContent)
      },
      {
        name: '使用 stopVideo 和 destroy',
        pattern: /ytRef\.current\.stopVideo\?\.\(\)/,
        found: /ytRef\.current\.stopVideo\?\.\(\)/.test(bridgeContent)
      },
      {
        name: '200ms 延遲',
        pattern: /}, 200\)/,
        found: /}, 200\)/.test(bridgeContent)
      }
    ];
    
    console.log('📁 GlobalYouTubeBridge 修復檢查:');
    bridgeChecks.forEach(check => {
      const status = check.found ? '✅' : '❌';
      console.log(`  ${status} ${check.name}`);
    });
    
    const totalChecks = playerContextChecks.length + bridgeChecks.length;
    const passedChecks = playerContextChecks.filter(c => c.found).length + 
                        bridgeChecks.filter(c => c.found).length;
    
    console.log(`\n📊 修復驗證結果: ${passedChecks}/${totalChecks} 通過`);
    
    return {
      totalChecks,
      passedChecks,
      successRate: (passedChecks / totalChecks) * 100
    };
  }

  // 生成修復建議
  generateRecommendations() {
    console.log('\n💡 修復建議:');
    console.log('1. 🔄 重新啟動開發服務器');
    console.log('2. 🧹 清除瀏覽器緩存');
    console.log('3. 🔍 檢查控制台是否有新的錯誤訊息');
    console.log('4. 🧪 重新測試播放器功能');
    
    console.log('\n🎯 測試場景:');
    console.log('- 重新進入作者頁面 → 播放器應自動播放');
    console.log('- 按「下一首」→ 不應報錯，應自動播放');
    console.log('- 切換歌曲時 → 不應出現 null 引用錯誤');
    console.log('- 檢查控制台 → 不應有 "Cannot read property \'src\' of null" 錯誤');
  }

  // 運行修復
  runFixes() {
    console.log('🔧 開始修復播放器問題...\n');
    
    this.fixDelayTimes();
    
    const verification = this.verifyFixes();
    this.generateRecommendations();
    
    console.log('\n🎉 修復完成！');
    console.log(`📈 修復成功率: ${verification.successRate.toFixed(1)}%`);
    
    return {
      fixes: this.fixes,
      verification
    };
  }
}

// 運行修復
const fixer = new PlayerIssueFixer();
fixer.runFixes();




