/**
 * 播放器問題檢測和修復腳本
 * 自動檢測問題並提供修復方案
 */

// 問題檢測器
class PlayerDebugger {
  constructor() {
    this.issues = [];
    this.fixes = [];
    this.startTime = Date.now();
  }

  // 檢測播放器重複初始化
  detectReinitialization() {
    const initLogs = [];
    const originalLog = console.log;
    
    console.log = (...args) => {
      if (args[0] && args[0].includes('GlobalYouTubeBridge 播放器就緒')) {
        initLogs.push(Date.now());
      }
      originalLog.apply(console, args);
    };
    
    // 監聽 5 秒
    setTimeout(() => {
      console.log = originalLog;
      
      if (initLogs.length > 2) {
        this.issues.push({
          type: '重複初始化',
          severity: 'HIGH',
          message: `播放器在 5 秒內初始化了 ${initLogs.length} 次`,
          fix: '修復 videoId 計算或 useEffect 依賴',
          code: 'GlobalYouTubeBridge.jsx'
        });
      }
    }, 5000);
  }

  // 檢測自動播放問題
  detectAutoplayIssues() {
    let autoplayAttempts = 0;
    let autoplaySuccess = 0;
    
    const originalLog = console.log;
    console.log = (...args) => {
      if (args[0] && args[0].includes('設置自動播放標記')) {
        autoplayAttempts++;
      }
      if (args[0] && args[0].includes('播放器就緒觸發播放成功')) {
        autoplaySuccess++;
      }
      originalLog.apply(console, args);
    };
    
    setTimeout(() => {
      console.log = originalLog;
      
      if (autoplayAttempts > 0 && autoplaySuccess === 0) {
        this.issues.push({
          type: '自動播放失敗',
          severity: 'HIGH',
          message: `嘗試自動播放 ${autoplayAttempts} 次，成功 0 次`,
          fix: '修復 onReady 中的自動播放邏輯',
          code: 'GlobalYouTubeBridge.jsx'
        });
      }
    }, 10000);
  }

  // 檢測狀態同步問題
  detectStateSyncIssues() {
    let stateChanges = 0;
    let uiUpdates = 0;
    
    const originalLog = console.log;
    console.log = (...args) => {
      if (args[0] && args[0].includes('YouTube 狀態變化')) {
        stateChanges++;
      }
      if (args[0] && args[0].includes('進度已同步到 PlayerContext')) {
        uiUpdates++;
      }
      originalLog.apply(console, args);
    };
    
    setTimeout(() => {
      console.log = originalLog;
      
      if (stateChanges > 3 && uiUpdates === 0) {
        this.issues.push({
          type: '狀態同步問題',
          severity: 'MEDIUM',
          message: `YouTube 狀態變化 ${stateChanges} 次，但 UI 未更新`,
          fix: '修復 onProgress 事件處理',
          code: 'GlobalYouTubeBridge.jsx'
        });
      }
    }, 10000);
  }

  // 檢測錯誤
  detectErrors() {
    const errors = [];
    const originalError = console.error;
    
    console.error = (...args) => {
      errors.push({
        message: args.join(' '),
        timestamp: Date.now()
      });
      originalError.apply(console, args);
    };
    
    setTimeout(() => {
      console.error = originalError;
      
      if (errors.length > 0) {
        this.issues.push({
          type: '控制台錯誤',
          severity: 'HIGH',
          message: `發現 ${errors.length} 個錯誤`,
          fix: '修復控制台錯誤',
          code: 'Multiple files'
        });
      }
    }, 10000);
  }

  // 開始檢測
  startDetection() {
    console.log('🔍 開始播放器問題檢測...');
    
    this.detectReinitialization();
    this.detectAutoplayIssues();
    this.detectStateSyncIssues();
    this.detectErrors();
    
    // 10 秒後生成報告
    setTimeout(() => {
      this.generateReport();
    }, 10000);
  }

  // 生成報告
  generateReport() {
    console.log('\n🔍 播放器問題檢測報告');
    console.log('='.repeat(50));
    
    if (this.issues.length === 0) {
      console.log('✅ 未發現明顯問題');
    } else {
      console.log(`❌ 發現 ${this.issues.length} 個問題:`);
      
      this.issues.forEach((issue, index) => {
        const severityIcon = issue.severity === 'HIGH' ? '🔴' : '🟡';
        console.log(`${severityIcon} ${index + 1}. ${issue.type}`);
        console.log(`   ${issue.message}`);
        console.log(`   修復方案: ${issue.fix}`);
        console.log(`   文件: ${issue.code}`);
        console.log('');
      });
    }
    
    return this.issues;
  }

  // 獲取問題列表
  getIssues() {
    return this.issues;
  }
}

// 全局檢測函數
window.debugPlayer = () => {
  const debugger = new PlayerDebugger();
  debugger.startDetection();
  return debugger;
};

// 自動開始檢測
if (typeof window !== 'undefined') {
  console.log('🔍 播放器問題檢測器已載入');
  console.log('💡 使用 window.debugPlayer() 來開始檢測');
  
  // 自動開始檢測
  setTimeout(() => {
    window.debugPlayer();
  }, 2000);
}



