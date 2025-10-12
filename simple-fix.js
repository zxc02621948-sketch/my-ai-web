/**
 * 簡單有效的修復腳本
 * 專注於修復最關鍵的問題
 */

const fs = require('fs');
const path = require('path');

class SimpleFixer {
  constructor() {
    this.fixes = [];
  }

  // 修復最關鍵的問題：完全移除 pauseVideo 調用
  removePauseVideoCalls() {
    console.log('🔧 移除所有 pauseVideo 調用...');
    
    const filePath = path.join(__dirname, 'components/player/GlobalYouTubeBridge.jsx');
    let content = fs.readFileSync(filePath, 'utf8');
    
    // 移除所有 pauseVideo 調用，只保留 stopVideo 和 destroy
    content = content.replace(
      /if \(typeof ytRef\.current\.pauseVideo === 'function'\) \{[\s\S]*?ytRef\.current\.pauseVideo\(\);[\s\S]*?\}/g,
      '// pauseVideo 調用已移除，避免 null 引用錯誤'
    );
    
    // 移除所有直接的 pauseVideo 調用
    content = content.replace(
      /ytRef\.current\.pauseVideo\(\);?/g,
      '// pauseVideo 調用已移除'
    );
    
    // 移除所有 p.pauseVideo 調用
    content = content.replace(
      /p\.pauseVideo\(\);?/g,
      '// pauseVideo 調用已移除'
    );
    
    fs.writeFileSync(filePath, content);
    
    this.fixes.push({
      type: '移除 pauseVideo 調用',
      status: 'COMPLETED'
    });
    
    console.log('  ✅ pauseVideo 調用已移除');
  }

  // 簡化清理邏輯
  simplifyCleanup() {
    console.log('🔧 簡化清理邏輯...');
    
    const filePath = path.join(__dirname, 'components/player/GlobalYouTubeBridge.jsx');
    let content = fs.readFileSync(filePath, 'utf8');
    
    // 替換複雜的清理邏輯為簡單版本
    const simpleCleanup = `
      // 簡化的播放器清理
      if (ytRef?.current) {
        try {
          // 只調用 stopVideo 和 destroy，不調用 pauseVideo
          if (typeof ytRef.current.stopVideo === 'function') {
            ytRef.current.stopVideo();
          }
          if (typeof ytRef.current.destroy === 'function') {
            ytRef.current.destroy();
          }
        } catch (err) {
          console.warn("🔧 播放器清理失敗:", err);
        }
        ytRef.current = null;
      }
    `;
    
    // 替換所有複雜的清理邏輯
    content = content.replace(
      /if \(ytRef\?\.current\) \{[\s\S]*?ytRef\.current = null;[\s\S]*?\}/g,
      simpleCleanup
    );
    
    fs.writeFileSync(filePath, content);
    
    this.fixes.push({
      type: '簡化清理邏輯',
      status: 'COMPLETED'
    });
    
    console.log('  ✅ 清理邏輯已簡化');
  }

  // 加強錯誤處理
  strengthenErrorHandling() {
    console.log('🔧 加強錯誤處理...');
    
    const filePath = path.join(__dirname, 'components/player/GlobalYouTubeBridge.jsx');
    let content = fs.readFileSync(filePath, 'utf8');
    
    // 在所有 API 調用前加入更嚴格的檢查
    content = content.replace(
      /if \(ytRef\.current && typeof ytRef\.current\.(\w+) === 'function'\)/g,
      'if (ytRef?.current && typeof ytRef.current.$1 === \'function\' && ytRef.current.$1)'
    );
    
    fs.writeFileSync(filePath, content);
    
    this.fixes.push({
      type: '加強錯誤處理',
      status: 'COMPLETED'
    });
    
    console.log('  ✅ 錯誤處理已加強');
  }

  // 驗證修復
  verifyFixes() {
    console.log('\n🔍 驗證修復結果...');
    
    const filePath = path.join(__dirname, 'components/player/GlobalYouTubeBridge.jsx');
    const content = fs.readFileSync(filePath, 'utf8');
    
    // 檢查 pauseVideo 調用
    const pauseVideoCalls = content.match(/pauseVideo\(\)/g);
    const pauseVideoComments = content.match(/pauseVideo 調用已移除/g);
    
    console.log(`  📝 pauseVideo 調用: ${pauseVideoCalls ? pauseVideoCalls.length : 0}`);
    console.log(`  📝 pauseVideo 移除註釋: ${pauseVideoComments ? pauseVideoComments.length : 0}`);
    
    // 檢查 stopVideo 和 destroy 調用
    const stopVideoCalls = content.match(/stopVideo\(\)/g);
    const destroyCalls = content.match(/destroy\(\)/g);
    
    console.log(`  📝 stopVideo 調用: ${stopVideoCalls ? stopVideoCalls.length : 0}`);
    console.log(`  📝 destroy 調用: ${destroyCalls ? destroyCalls.length : 0}`);
    
    return {
      pauseVideoCalls: pauseVideoCalls ? pauseVideoCalls.length : 0,
      pauseVideoComments: pauseVideoComments ? pauseVideoComments.length : 0,
      stopVideoCalls: stopVideoCalls ? stopVideoCalls.length : 0,
      destroyCalls: destroyCalls ? destroyCalls.length : 0
    };
  }

  // 運行所有修復
  runAllFixes() {
    console.log('🔧 開始簡單修復...\n');
    
    this.removePauseVideoCalls();
    this.simplifyCleanup();
    this.strengthenErrorHandling();
    
    const verification = this.verifyFixes();
    
    console.log('\n🎉 修復完成！');
    console.log(`📊 pauseVideo 調用: ${verification.pauseVideoCalls}`);
    console.log(`📊 pauseVideo 移除: ${verification.pauseVideoComments}`);
    console.log(`📊 stopVideo 調用: ${verification.stopVideoCalls}`);
    console.log(`📊 destroy 調用: ${verification.destroyCalls}`);
    
    return {
      fixes: this.fixes,
      verification
    };
  }
}

// 運行修復
const fixer = new SimpleFixer();
fixer.runAllFixes();



