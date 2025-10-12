/**
 * 播放器自動化測試腳本
 * 用於自動測試播放器功能，避免手動測試
 */

class PlayerTester {
  constructor() {
    this.testResults = [];
    this.currentTest = null;
    this.testTimeout = 10000; // 10秒超時
  }

  // 等待元素出現
  async waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const checkElement = () => {
        const element = document.querySelector(selector);
        if (element) {
          resolve(element);
        } else if (Date.now() - startTime > timeout) {
          reject(new Error(`Element ${selector} not found within ${timeout}ms`));
        } else {
          setTimeout(checkElement, 100);
        }
      };
      checkElement();
    });
  }

  // 等待函數執行
  async waitForFunction(fn, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const checkFunction = () => {
        try {
          const result = fn();
          if (result) {
            resolve(result);
          } else if (Date.now() - startTime > timeout) {
            reject(new Error(`Function did not return true within ${timeout}ms`));
          } else {
            setTimeout(checkFunction, 100);
          }
        } catch (error) {
          if (Date.now() - startTime > timeout) {
            reject(error);
          } else {
            setTimeout(checkFunction, 100);
          }
        }
      };
      checkFunction();
    });
  }

  // 測試播放器初始化
  async testPlayerInitialization() {
    console.log('🧪 測試播放器初始化...');
    
    try {
      // 檢查 PlayerContext 是否存在
      const playerContext = await this.waitForFunction(() => {
        return window.playerContext || document.querySelector('[data-testid="player-context"]');
      });
      
      // 檢查 YouTube 播放器是否初始化
      const youtubePlayer = await this.waitForFunction(() => {
        return window.ytPlayer || document.querySelector('iframe[src*="youtube.com"]');
      });
      
      this.testResults.push({
        test: '播放器初始化',
        status: 'PASS',
        details: 'PlayerContext 和 YouTube 播放器都已初始化'
      });
      
      return true;
    } catch (error) {
      this.testResults.push({
        test: '播放器初始化',
        status: 'FAIL',
        details: error.message
      });
      return false;
    }
  }

  // 測試播放功能
  async testPlayback() {
    console.log('🧪 測試播放功能...');
    
    try {
      // 點擊播放按鈕
      const playButton = await this.waitForElement('[data-testid="play-button"], .play-button, button[aria-label*="play"]');
      playButton.click();
      
      // 等待播放狀態
      await this.waitForFunction(() => {
        const player = window.playerContext;
        return player && player.isPlaying === true;
      });
      
      this.testResults.push({
        test: '播放功能',
        status: 'PASS',
        details: '播放按鈕點擊成功，播放狀態正確'
      });
      
      return true;
    } catch (error) {
      this.testResults.push({
        test: '播放功能',
        status: 'FAIL',
        details: error.message
      });
      return false;
    }
  }

  // 測試下一首功能
  async testNextTrack() {
    console.log('🧪 測試下一首功能...');
    
    try {
      // 點擊下一首按鈕
      const nextButton = await this.waitForElement('[data-testid="next-button"], .next-button, button[aria-label*="next"]');
      nextButton.click();
      
      // 等待播放器狀態變化
      await this.waitForFunction(() => {
        const player = window.playerContext;
        return player && player.originUrl && player.originUrl !== '';
      });
      
      // 檢查是否自動播放
      await this.waitForFunction(() => {
        const player = window.playerContext;
        return player && player.isPlaying === true;
      });
      
      this.testResults.push({
        test: '下一首功能',
        status: 'PASS',
        details: '下一首按鈕點擊成功，自動播放正常'
      });
      
      return true;
    } catch (error) {
      this.testResults.push({
        test: '下一首功能',
        status: 'FAIL',
        details: error.message
      });
      return false;
    }
  }

  // 測試進度條更新
  async testProgressUpdate() {
    console.log('🧪 測試進度條更新...');
    
    try {
      // 等待進度條元素
      const progressBar = await this.waitForElement('[data-testid="progress-bar"], .progress-bar, input[type="range"]');
      
      // 等待進度條更新
      let initialProgress = 0;
      await this.waitForFunction(() => {
        const player = window.playerContext;
        if (player && player.currentTime > initialProgress) {
          initialProgress = player.currentTime;
          return true;
        }
        return false;
      });
      
      this.testResults.push({
        test: '進度條更新',
        status: 'PASS',
        details: '進度條正常更新'
      });
      
      return true;
    } catch (error) {
      this.testResults.push({
        test: '進度條更新',
        status: 'FAIL',
        details: error.message
      });
      return false;
    }
  }

  // 測試音量控制
  async testVolumeControl() {
    console.log('🧪 測試音量控制...');
    
    try {
      // 等待音量控制元素
      const volumeControl = await this.waitForElement('[data-testid="volume-control"], .volume-control, input[type="range"]');
      
      // 測試音量調整
      const initialVolume = volumeControl.value;
      volumeControl.value = '0.5';
      volumeControl.dispatchEvent(new Event('input'));
      
      // 等待音量更新
      await this.waitForFunction(() => {
        const player = window.playerContext;
        return player && Math.abs(player.volume - 0.5) < 0.1;
      });
      
      this.testResults.push({
        test: '音量控制',
        status: 'PASS',
        details: '音量控制正常'
      });
      
      return true;
    } catch (error) {
      this.testResults.push({
        test: '音量控制',
        status: 'FAIL',
        details: error.message
      });
      return false;
    }
  }

  // 運行所有測試
  async runAllTests() {
    console.log('🚀 開始自動化測試...');
    
    const tests = [
      this.testPlayerInitialization(),
      this.testPlayback(),
      this.testNextTrack(),
      this.testProgressUpdate(),
      this.testVolumeControl()
    ];
    
    const results = await Promise.allSettled(tests);
    
    // 生成測試報告
    this.generateReport();
    
    return this.testResults;
  }

  // 生成測試報告
  generateReport() {
    console.log('\n📊 測試報告');
    console.log('='.repeat(50));
    
    const passed = this.testResults.filter(r => r.status === 'PASS').length;
    const failed = this.testResults.filter(r => r.status === 'FAIL').length;
    
    console.log(`✅ 通過: ${passed}`);
    console.log(`❌ 失敗: ${failed}`);
    console.log(`📈 成功率: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
    
    console.log('\n📋 詳細結果:');
    this.testResults.forEach(result => {
      const icon = result.status === 'PASS' ? '✅' : '❌';
      console.log(`${icon} ${result.test}: ${result.details}`);
    });
    
    // 保存到 localStorage
    localStorage.setItem('playerTestResults', JSON.stringify({
      timestamp: new Date().toISOString(),
      results: this.testResults,
      summary: { passed, failed, successRate: (passed / (passed + failed)) * 100 }
    }));
  }

  // 獲取測試結果
  getResults() {
    return this.testResults;
  }
}

// 全局測試函數
window.runPlayerTests = async () => {
  const tester = new PlayerTester();
  await tester.runAllTests();
  return tester.getResults();
};

// 自動運行測試（可選）
if (typeof window !== 'undefined') {
  console.log('🤖 播放器自動化測試腳本已載入');
  console.log('💡 使用 window.runPlayerTests() 來運行測試');
}



