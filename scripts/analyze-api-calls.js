/**
 * 📊 API 調用分析工具
 * 用途：分析代碼中的 API 調用模式，找出可優化的地方
 */

const fs = require('fs');
const path = require('path');

// 要分析的目錄
const dirsToAnalyze = [
  'components',
  'app',
  'contexts'
];

// API 調用模式
const patterns = {
  fetch: /fetch\s*\(\s*['"`]([^'"`]+)['"`]/g,
  axios: /axios\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g,
  useEffect: /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{/g,
  asyncFunction: /async\s+function\s+(\w+)/g,
};

const apiCalls = new Map();
const fileApiCalls = new Map();

function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const relativePath = path.relative(process.cwd(), filePath);
  
  const calls = [];
  
  // 查找 fetch 調用
  let match;
  const fetchPattern = /fetch\s*\(\s*['"`]([^'"`]+)['"`]/g;
  while ((match = fetchPattern.exec(content)) !== null) {
    calls.push({
      type: 'fetch',
      endpoint: match[1],
      line: content.substring(0, match.index).split('\n').length
    });
  }
  
  // 查找 axios 調用
  const axiosPattern = /axios\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g;
  while ((match = axiosPattern.exec(content)) !== null) {
    calls.push({
      type: `axios.${match[1]}`,
      endpoint: match[2],
      line: content.substring(0, match.index).split('\n').length
    });
  }
  
  if (calls.length > 0) {
    fileApiCalls.set(relativePath, calls);
    
    calls.forEach(call => {
      const key = `${call.type}:${call.endpoint}`;
      if (!apiCalls.has(key)) {
        apiCalls.set(key, []);
      }
      apiCalls.get(key).push({
        file: relativePath,
        line: call.line
      });
    });
  }
}

function analyzeDirectory(dir) {
  const items = fs.readdirSync(dir);
  
  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      analyzeDirectory(fullPath);
    } else if (stat.isFile() && (item.endsWith('.js') || item.endsWith('.jsx') || item.endsWith('.ts') || item.endsWith('.tsx'))) {
      analyzeFile(fullPath);
    }
  });
}

function findDuplicateCalls() {
  console.log('🔍 分析 API 調用模式...\n');
  
  // 分析所有目錄
  dirsToAnalyze.forEach(dir => {
    if (fs.existsSync(dir)) {
      analyzeDirectory(dir);
    }
  });
  
  console.log('📊 API 調用統計報告');
  console.log('='.repeat(80));
  
  // 1. 統計最常調用的 API
  console.log('\n📈 最常調用的 API (前 10 名):');
  const sortedCalls = Array.from(apiCalls.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10);
  
  sortedCalls.forEach(([key, locations], index) => {
    const [type, endpoint] = key.split(':');
    console.log(`\n${index + 1}. ${endpoint}`);
    console.log(`   調用次數: ${locations.length} 次`);
    console.log(`   方法: ${type}`);
    if (locations.length <= 3) {
      locations.forEach(loc => {
        console.log(`   - ${loc.file}:${loc.line}`);
      });
    } else {
      console.log(`   調用文件:`);
      locations.slice(0, 3).forEach(loc => {
        console.log(`   - ${loc.file}:${loc.line}`);
      });
      console.log(`   ... 還有 ${locations.length - 3} 個`);
    }
  });
  
  // 2. 找出可能重複的調用
  console.log('\n\n⚠️  可能存在重複調用的 API:');
  const duplicates = Array.from(apiCalls.entries())
    .filter(([_, locations]) => locations.length > 2);
  
  if (duplicates.length === 0) {
    console.log('✅ 沒有發現明顯的重複調用');
  } else {
    duplicates.forEach(([key, locations]) => {
      const [type, endpoint] = key.split(':');
      console.log(`\n📍 ${endpoint}`);
      console.log(`   在 ${locations.length} 個不同地方被調用`);
      
      // 按文件分組
      const fileGroups = new Map();
      locations.forEach(loc => {
        const dir = path.dirname(loc.file);
        if (!fileGroups.has(dir)) {
          fileGroups.set(dir, []);
        }
        fileGroups.get(dir).push(loc);
      });
      
      fileGroups.forEach((locs, dir) => {
        console.log(`   ${dir}/:`);
        locs.forEach(loc => {
          console.log(`     - ${path.basename(loc.file)}:${loc.line}`);
        });
      });
    });
  }
  
  // 3. 分析各文件的 API 調用密度
  console.log('\n\n📁 API 調用密度高的文件 (前 10 名):');
  const sortedFiles = Array.from(fileApiCalls.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10);
  
  sortedFiles.forEach(([file, calls], index) => {
    console.log(`\n${index + 1}. ${file}`);
    console.log(`   API 調用數: ${calls.length}`);
    
    // 統計該文件調用的 API
    const endpoints = new Set(calls.map(c => c.endpoint));
    console.log(`   調用的不同 API: ${endpoints.size} 個`);
    
    if (calls.length > 5) {
      console.log(`   可能需要優化：考慮合併請求或使用批量 API`);
    }
  });
  
  // 4. 優化建議
  console.log('\n\n💡 優化建議:');
  console.log('='.repeat(80));
  
  const recommendations = [];
  
  // 檢查 current-user 調用
  const currentUserCalls = apiCalls.get('axios.get:/api/current-user') || 
                          apiCalls.get('fetch:/api/current-user') || [];
  if (currentUserCalls.length > 1) {
    recommendations.push({
      priority: 'HIGH',
      issue: '/api/current-user 在多處被調用',
      impact: `在 ${currentUserCalls.length} 個地方調用`,
      suggestion: '✅ 已使用 CurrentUserContext，確認所有組件都通過 Context 獲取用戶數據',
      status: currentUserCalls.length <= 2 ? '✅ 已優化' : '⚠️ 需檢查'
    });
  }
  
  // 檢查 player settings 調用
  const playerSettingsCalls = apiCalls.get('axios.get:/api/player/skin-settings') ||
                             apiCalls.get('fetch:/api/player/skin-settings') || [];
  if (playerSettingsCalls.length > 1) {
    recommendations.push({
      priority: 'MEDIUM',
      issue: '/api/player/skin-settings 多次調用',
      impact: `在 ${playerSettingsCalls.length} 個地方調用`,
      suggestion: '考慮在 current-user API 中包含 playerSkinSettings',
      status: '💡 可優化'
    });
  }
  
  // 檢查未讀計數調用
  const unreadCalls = [
    ...(apiCalls.get('axios.get:/api/messages/unread-count') || []),
    ...(apiCalls.get('axios.get:/api/notifications/unread-count') || [])
  ];
  if (unreadCalls.length > 2) {
    recommendations.push({
      priority: 'LOW',
      issue: '未讀計數 API 多次調用',
      impact: `總共 ${unreadCalls.length} 次調用`,
      suggestion: '✅ 已在 CurrentUserContext 中實現緩存（30秒）',
      status: '✅ 已優化'
    });
  }
  
  // 顯示建議
  if (recommendations.length === 0) {
    console.log('🎉 沒有發現需要優化的 API 調用模式！');
  } else {
    recommendations.sort((a, b) => {
      const priority = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      return priority[b.priority] - priority[a.priority];
    });
    
    recommendations.forEach((rec, index) => {
      console.log(`\n${index + 1}. [${rec.priority}] ${rec.issue}`);
      console.log(`   影響: ${rec.impact}`);
      console.log(`   建議: ${rec.suggestion}`);
      console.log(`   狀態: ${rec.status}`);
    });
  }
  
  // 總結
  console.log('\n\n📋 總結:');
  console.log('='.repeat(80));
  console.log(`✅ 掃描了 ${fileApiCalls.size} 個文件`);
  console.log(`📊 發現 ${apiCalls.size} 個不同的 API 端點`);
  console.log(`🔍 提供 ${recommendations.length} 條優化建議`);
  
  const optimized = recommendations.filter(r => r.status.includes('✅')).length;
  const needsWork = recommendations.filter(r => r.status.includes('⚠️') || r.status.includes('💡')).length;
  
  if (needsWork === 0) {
    console.log('\n🎉 API 調用模式已充分優化！');
  } else {
    console.log(`\n📈 優化進度: ${optimized}/${recommendations.length} 已完成`);
    console.log(`⚠️  還有 ${needsWork} 項可以優化`);
  }
}

// 執行分析
try {
  findDuplicateCalls();
} catch (error) {
  console.error('❌ 分析失敗:', error.message);
  process.exit(1);
}

