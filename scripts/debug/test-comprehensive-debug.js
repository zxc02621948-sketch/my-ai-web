/**
 * 綜合播放器問題診斷腳本
 * 深入檢查所有可能的問題
 */

const fs = require('fs');
const path = require('path');

class ComprehensiveDebugger {
  constructor() {
    this.issues = [];
    this.warnings = [];
    this.suggestions = [];
  }

  // 檢查所有播放器相關文件
  checkAllPlayerFiles() {
    console.log('🔍 檢查所有播放器相關文件...\n');
    
    const playerFiles = [
      'components/context/PlayerContext.js',
      'components/player/GlobalYouTubeBridge.jsx',
      'components/player/YoutubeFallback.jsx'
    ];

    for (const file of playerFiles) {
      this.checkPlayerFile(file);
    }
  }

  // 檢查單個播放器文件
  checkPlayerFile(filePath) {
    console.log(`📁 檢查文件: ${filePath}`);
    
    const fullPath = path.join(__dirname, filePath);
    if (!fs.existsSync(fullPath)) {
      this.issues.push({
        type: '文件不存在',
        file: filePath,
        severity: 'HIGH',
        message: `文件不存在: ${filePath}`
      });
      return;
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');
    
    // 檢查各種問題模式
    this.checkNullReferences(content, filePath);
    this.checkDirectAPICalls(content, filePath);
    this.checkErrorHandling(content, filePath);
    this.checkStateManagement(content, filePath);
    this.checkTimingIssues(content, filePath);
    
    console.log(`  ✅ 檢查完成\n`);
  }

  // 檢查 null 引用問題
  checkNullReferences(content, filePath) {
    const nullPatterns = [
      {
        pattern: /\.current\.[^?]/g,
        name: '直接訪問 current 屬性',
        severity: 'HIGH'
      },
      {
        pattern: /ytRef\.current\.pauseVideo\(\)/g,
        name: '直接 pauseVideo 調用',
        severity: 'HIGH'
      },
      {
        pattern: /ytRef\.current\.src\s*=/g,
        name: '直接 src 賦值',
        severity: 'HIGH'
      }
    ];

    nullPatterns.forEach(pattern => {
      const matches = content.match(pattern.pattern);
      if (matches) {
        this.issues.push({
          type: pattern.name,
          file: filePath,
          severity: pattern.severity,
          message: `發現 ${matches.length} 個 ${pattern.name}，可能導致 null 引用錯誤`,
          matches: matches
        });
      }
    });
  }

  // 檢查直接 API 調用
  checkDirectAPICalls(content, filePath) {
    const apiPatterns = [
      {
        pattern: /pauseVideo\(\)/g,
        name: 'pauseVideo 調用',
        safePattern: /typeof.*pauseVideo.*===.*function/
      },
      {
        pattern: /stopVideo\(\)/g,
        name: 'stopVideo 調用',
        safePattern: /typeof.*stopVideo.*===.*function/
      },
      {
        pattern: /destroy\(\)/g,
        name: 'destroy 調用',
        safePattern: /typeof.*destroy.*===.*function/
      }
    ];

    apiPatterns.forEach(api => {
      const directCalls = content.match(api.pattern);
      const safeChecks = content.match(api.safePattern);
      
      if (directCalls && safeChecks) {
        if (directCalls.length > safeChecks.length) {
          this.issues.push({
            type: `不安全的 ${api.name}`,
            file: filePath,
            severity: 'HIGH',
            message: `發現 ${directCalls.length} 個 ${api.name}，但只有 ${safeChecks.length} 個安全檢查`
          });
        }
      }
    });
  }

  // 檢查錯誤處理
  checkErrorHandling(content, filePath) {
    const tryCatchBlocks = content.match(/try\s*\{/g);
    const catchBlocks = content.match(/catch\s*\(/g);
    
    if (tryCatchBlocks && catchBlocks) {
      if (tryCatchBlocks.length !== catchBlocks.length) {
        this.issues.push({
          type: '錯誤處理不完整',
          file: filePath,
          severity: 'MEDIUM',
          message: `發現 ${tryCatchBlocks.length} 個 try 塊，但只有 ${catchBlocks.length} 個 catch 塊`
        });
      }
    }
  }

  // 檢查狀態管理
  checkStateManagement(content, filePath) {
    const statePatterns = [
      {
        pattern: /window\.__YT_READY__/g,
        name: 'YT_READY 旗標使用',
        expected: 2 // 設置和清理
      },
      {
        pattern: /setTimeout.*setSrcWithAudio/g,
        name: '延遲重試機制',
        expected: 1
      }
    ];

    statePatterns.forEach(pattern => {
      const matches = content.match(pattern.pattern);
      if (matches && matches.length !== pattern.expected) {
        this.warnings.push({
          type: pattern.name,
          file: filePath,
          message: `期望 ${pattern.expected} 個 ${pattern.name}，但發現 ${matches.length} 個`
        });
      }
    });
  }

  // 檢查時序問題
  checkTimingIssues(content, filePath) {
    const timingPatterns = [
      {
        pattern: /setTimeout\(\(\) => \{[\s\S]*\}, \d+\)/g,
        name: 'setTimeout 延遲'
      },
      {
        pattern: /debounceTimeoutRef/g,
        name: 'debounce 機制'
      }
    ];

    timingPatterns.forEach(pattern => {
      const matches = content.match(pattern.pattern);
      if (matches) {
        console.log(`  📝 發現 ${matches.length} 個 ${pattern.name}`);
      }
    });
  }

  // 檢查可能的解決方案
  checkPotentialSolutions() {
    console.log('\n💡 檢查可能的解決方案...');
    
    const solutions = [
      {
        name: '完全禁用 pauseVideo',
        description: '在清理階段完全跳過 pauseVideo 調用',
        code: `
// 在清理時只調用 stopVideo 和 destroy，不調用 pauseVideo
if (ytRef.current && typeof ytRef.current.stopVideo === 'function') {
  ytRef.current.stopVideo();
}
if (ytRef.current && typeof ytRef.current.destroy === 'function') {
  ytRef.current.destroy();
}
        `
      },
      {
        name: '加入播放器狀態檢查',
        description: '在調用任何 API 前檢查播放器是否仍然有效',
        code: `
// 檢查播放器是否仍然有效
if (ytRef.current && ytRef.current.getPlayerState) {
  try {
    const state = ytRef.current.getPlayerState();
    if (state !== undefined && state !== null) {
      // 只有在狀態有效時才調用 API
    }
  } catch (error) {
    console.warn('播放器狀態檢查失敗:', error);
  }
}
        `
      },
      {
        name: '使用更安全的清理順序',
        description: '先檢查狀態，再決定是否調用 API',
        code: `
// 安全的清理順序
if (ytRef.current) {
  try {
    // 1. 先檢查播放器是否仍然有效
    if (typeof ytRef.current.getPlayerState === 'function') {
      const state = ytRef.current.getPlayerState();
      if (state === undefined || state === null) {
        console.log('播放器已無效，跳過 API 調用');
        return;
      }
    }
    
    // 2. 只有在播放器有效時才調用 API
    if (typeof ytRef.current.stopVideo === 'function') {
      ytRef.current.stopVideo();
    }
    if (typeof ytRef.current.destroy === 'function') {
      ytRef.current.destroy();
    }
  } catch (error) {
    console.warn('播放器清理失敗:', error);
  }
}
        `
      }
    ];

    solutions.forEach((solution, index) => {
      console.log(`\n🔧 解決方案 ${index + 1}: ${solution.name}`);
      console.log(`📝 描述: ${solution.description}`);
      console.log(`💻 代碼示例:`);
      console.log(solution.code);
    });
  }

  // 生成修復建議
  generateFixRecommendations() {
    console.log('\n🔧 生成修復建議...');
    
    const highSeverityIssues = this.issues.filter(i => i.severity === 'HIGH');
    const mediumSeverityIssues = this.issues.filter(i => i.severity === 'MEDIUM');
    
    if (highSeverityIssues.length > 0) {
      console.log('\n🔴 高優先級問題需要立即修復:');
      highSeverityIssues.forEach(issue => {
        console.log(`  - ${issue.type} (${issue.file}): ${issue.message}`);
      });
    }
    
    if (mediumSeverityIssues.length > 0) {
      console.log('\n🟡 中優先級問題建議修復:');
      mediumSeverityIssues.forEach(issue => {
        console.log(`  - ${issue.type} (${issue.file}): ${issue.message}`);
      });
    }
    
    if (this.warnings.length > 0) {
      console.log('\n⚠️ 警告:');
      this.warnings.forEach(warning => {
        console.log(`  - ${warning.type} (${warning.file}): ${warning.message}`);
      });
    }
  }

  // 生成完整報告
  generateReport() {
    console.log('\n📊 綜合診斷報告');
    console.log('='.repeat(60));
    
    console.log(`\n❌ 發現的問題 (${this.issues.length}):`);
    this.issues.forEach((issue, index) => {
      const severityIcon = issue.severity === 'HIGH' ? '🔴' : '🟡';
      console.log(`  ${severityIcon} ${index + 1}. ${issue.type} (${issue.file})`);
      console.log(`     ${issue.message}`);
    });
    
    console.log(`\n⚠️ 警告 (${this.warnings.length}):`);
    this.warnings.forEach((warning, index) => {
      console.log(`  ⚠️ ${index + 1}. ${warning.type} (${warning.file})`);
      console.log(`     ${warning.message}`);
    });
    
    this.generateFixRecommendations();
    this.checkPotentialSolutions();
    
    // 保存報告
    const reportData = {
      timestamp: new Date().toISOString(),
      issues: this.issues,
      warnings: this.warnings,
      summary: {
        totalIssues: this.issues.length,
        highSeverityIssues: this.issues.filter(i => i.severity === 'HIGH').length,
        mediumSeverityIssues: this.issues.filter(i => i.severity === 'MEDIUM').length,
        totalWarnings: this.warnings.length
      }
    };
    
    fs.writeFileSync(
      path.join(__dirname, 'comprehensive-debug-report.json'),
      JSON.stringify(reportData, null, 2)
    );
    
    console.log('\n💾 綜合診斷報告已保存到 comprehensive-debug-report.json');
  }

  // 運行綜合診斷
  runComprehensiveDebug() {
    console.log('🔍 開始綜合播放器問題診斷...\n');
    
    this.checkAllPlayerFiles();
    this.generateReport();
    
    return {
      issues: this.issues,
      warnings: this.warnings
    };
  }
}

// 運行綜合診斷
const comprehensiveDebugger = new ComprehensiveDebugger();
comprehensiveDebugger.runComprehensiveDebug();
