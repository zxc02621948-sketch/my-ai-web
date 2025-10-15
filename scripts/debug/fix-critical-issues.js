/**
 * 修復關鍵問題腳本
 * 修復所有發現的 null 引用和 API 調用問題
 */

const fs = require('fs');
const path = require('path');

class CriticalIssueFixer {
  constructor() {
    this.fixes = [];
  }

  // 修復 GlobalYouTubeBridge 中的關鍵問題
  fixGlobalYouTubeBridge() {
    console.log('🔧 修復 GlobalYouTubeBridge 關鍵問題...');
    
    const filePath = path.join(__dirname, 'components/player/GlobalYouTubeBridge.jsx');
    let content = fs.readFileSync(filePath, 'utf8');
    
    // 1. 修復所有直接的 pauseVideo 調用
    content = content.replace(
      /ytRef\.current\.pauseVideo\(\)/g,
      'ytRef.current && typeof ytRef.current.pauseVideo === \'function\' ? ytRef.current.pauseVideo() : null'
    );
    
    // 2. 修復所有直接的 stopVideo 調用
    content = content.replace(
      /ytRef\.current\.stopVideo\(\)/g,
      'ytRef.current && typeof ytRef.current.stopVideo === \'function\' ? ytRef.current.stopVideo() : null'
    );
    
    // 3. 修復所有直接的 destroy 調用
    content = content.replace(
      /ytRef\.current\.destroy\(\)/g,
      'ytRef.current && typeof ytRef.current.destroy === \'function\' ? ytRef.current.destroy() : null'
    );
    
    // 4. 修復所有直接的 getPlayerState 調用
    content = content.replace(
      /ytRef\.current\.getPlayerState\(\)/g,
      'ytRef.current && typeof ytRef.current.getPlayerState === \'function\' ? ytRef.current.getPlayerState() : null'
    );
    
    // 5. 修復所有直接的 setVolume 調用
    content = content.replace(
      /ytRef\.current\.setVolume\(/g,
      'ytRef.current && typeof ytRef.current.setVolume === \'function\' ? ytRef.current.setVolume('
    );
    
    // 6. 修復所有直接的 playVideo 調用
    content = content.replace(
      /ytRef\.current\.playVideo\(\)/g,
      'ytRef.current && typeof ytRef.current.playVideo === \'function\' ? ytRef.current.playVideo() : null'
    );
    
    // 7. 修復所有直接的 getVideoData 調用
    content = content.replace(
      /ytRef\.current\.getVideoData\(\)/g,
      'ytRef.current && typeof ytRef.current.getVideoData === \'function\' ? ytRef.current.getVideoData() : null'
    );
    
    fs.writeFileSync(filePath, content);
    
    this.fixes.push({
      type: 'GlobalYouTubeBridge 安全調用修復',
      status: 'COMPLETED'
    });
    
    console.log('  ✅ GlobalYouTubeBridge 修復完成');
  }

  // 修復 PlayerContext 中的關鍵問題
  fixPlayerContext() {
    console.log('🔧 修復 PlayerContext 關鍵問題...');
    
    const filePath = path.join(__dirname, 'components/context/PlayerContext.js');
    let content = fs.readFileSync(filePath, 'utf8');
    
    // 1. 修復所有直接的 audioRef.current 調用
    content = content.replace(
      /audioRef\.current\./g,
      'audioRef.current && audioRef.current.'
    );
    
    // 2. 修復所有直接的 externalControlsRef.current 調用
    content = content.replace(
      /externalControlsRef\.current\./g,
      'externalControlsRef.current && externalControlsRef.current.'
    );
    
    fs.writeFileSync(filePath, content);
    
    this.fixes.push({
      type: 'PlayerContext 安全調用修復',
      status: 'COMPLETED'
    });
    
    console.log('  ✅ PlayerContext 修復完成');
  }

  // 創建更安全的清理函數
  createSafeCleanupFunction() {
    console.log('🔧 創建安全清理函數...');
    
    const safeCleanupCode = `
// 安全的播放器清理函數
const safeCleanupPlayer = (playerRef) => {
  if (!playerRef || !playerRef.current) {
    console.log('🔧 播放器引用為空，跳過清理');
    return;
  }
  
  try {
    // 1. 檢查播放器是否仍然有效
    if (typeof playerRef.current.getPlayerState === 'function') {
      const state = playerRef.current.getPlayerState();
      if (state === undefined || state === null) {
        console.log('🔧 播放器狀態無效，跳過 API 調用');
        playerRef.current = null;
        return;
      }
    }
    
    // 2. 安全調用 stopVideo
    if (typeof playerRef.current.stopVideo === 'function') {
      playerRef.current.stopVideo();
      console.log('🔧 安全調用 stopVideo');
    }
    
    // 3. 安全調用 destroy
    if (typeof playerRef.current.destroy === 'function') {
      playerRef.current.destroy();
      console.log('🔧 安全調用 destroy');
    }
    
    // 4. 清理引用
    playerRef.current = null;
    console.log('🔧 播放器清理完成');
    
  } catch (error) {
    console.warn('🔧 播放器清理失敗:', error);
    playerRef.current = null;
  }
};
    `;
    
    return safeCleanupCode;
  }

  // 應用安全清理函數到 GlobalYouTubeBridge
  applySafeCleanup() {
    console.log('🔧 應用安全清理函數...');
    
    const filePath = path.join(__dirname, 'components/player/GlobalYouTubeBridge.jsx');
    let content = fs.readFileSync(filePath, 'utf8');
    
    // 在文件開頭加入安全清理函數
    const safeCleanupCode = this.createSafeCleanupFunction();
    content = safeCleanupCode + '\n' + content;
    
    // 替換所有清理邏輯為安全版本
    content = content.replace(
      /if \(ytRef\?\.current\) \{[\s\S]*?ytRef\.current = null;[\s\S]*?\}/g,
      'safeCleanupPlayer(ytRef);'
    );
    
    fs.writeFileSync(filePath, content);
    
    this.fixes.push({
      type: '安全清理函數應用',
      status: 'COMPLETED'
    });
    
    console.log('  ✅ 安全清理函數應用完成');
  }

  // 驗證修復結果
  verifyFixes() {
    console.log('\n🔍 驗證修復結果...');
    
    const files = [
      'components/context/PlayerContext.js',
      'components/player/GlobalYouTubeBridge.jsx'
    ];
    
    let totalIssues = 0;
    let fixedIssues = 0;
    
    files.forEach(file => {
      const filePath = path.join(__dirname, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 檢查直接調用
      const directCalls = content.match(/\.current\.[^?]/g);
      const safeCalls = content.match(/\.current && \.current\./g);
      
      if (directCalls) {
        totalIssues += directCalls.length;
        console.log(`  📁 ${file}: 發現 ${directCalls.length} 個直接調用`);
      }
      
      if (safeCalls) {
        fixedIssues += safeCalls.length;
        console.log(`  📁 ${file}: 修復 ${safeCalls.length} 個安全調用`);
      }
    });
    
    const successRate = totalIssues > 0 ? (fixedIssues / totalIssues) * 100 : 100;
    console.log(`\n📊 修復成功率: ${successRate.toFixed(1)}%`);
    
    return { totalIssues, fixedIssues, successRate };
  }

  // 運行所有修復
  runAllFixes() {
    console.log('🔧 開始修復關鍵問題...\n');
    
    this.fixGlobalYouTubeBridge();
    this.fixPlayerContext();
    this.applySafeCleanup();
    
    const verification = this.verifyFixes();
    
    console.log('\n🎉 修復完成！');
    console.log(`📈 修復成功率: ${verification.successRate.toFixed(1)}%`);
    
    return {
      fixes: this.fixes,
      verification
    };
  }
}

// 運行修復
const fixer = new CriticalIssueFixer();
fixer.runAllFixes();




