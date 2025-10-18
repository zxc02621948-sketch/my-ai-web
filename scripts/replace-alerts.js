const fs = require('fs');
const path = require('path');

// 需要處理的文件列表（從 grep 結果中提取）
const files = [
  'components/user/UserEditModal.jsx',
  'app/settings/page.jsx',
  'components/user/UserHeader.jsx',
  'components/common/MiniPlayer.jsx',
  'components/user/UnifiedAvatarModal.jsx',
  'app/discussion/page.jsx',
  'app/page.js',
  'components/player/PinPlayerButton.jsx',
  'components/upload/UploadStep2.jsx'
];

// 導入語句映射
const importStatements = {
  '.jsx': `import { notify } from "@/components/common/GlobalNotificationManager";`,
  '.js': `import { notify } from "@/components/common/GlobalNotificationManager";`
};

function addImportIfNeeded(content, ext) {
  const importStatement = importStatements[ext] || importStatements['.js'];
  
  // 檢查是否已經有導入
  if (content.includes('GlobalNotificationManager')) {
    return content;
  }
  
  // 在第一個 import 之後添加
  const importRegex = /(import\s+.*?from\s+['"].*?['"];?\s*\n)/;
  const match = content.match(importRegex);
  
  if (match) {
    const lastImportIndex = content.lastIndexOf(match[0]) + match[0].length;
    return content.slice(0, lastImportIndex) + importStatement + '\n' + content.slice(lastImportIndex);
  }
  
  // 如果找不到 import，在 "use client" 之後添加
  if (content.includes('"use client"')) {
    return content.replace('"use client";', `"use client";\n\n${importStatement}`);
  }
  
  // 否則在文件開頭添加
  return importStatement + '\n\n' + content;
}

function replaceAlerts(content) {
  // 簡單的 alert() 替換規則
  const replacements = [
    // 成功消息
    { pattern: /alert\(['"`]✅\s*([^\\n]+?)\\n\\n([^'"`]+?)['"`]\)/g, replacement: 'notify.success("$1", "$2")' },
    { pattern: /alert\(['"`]🎉\s*([^\\n]+?)\\n\\n([^'"`]+?)['"`]\)/g, replacement: 'notify.success("$1", "$2")' },
    { pattern: /alert\(['"`]([^'"`]*成功[^'"`]*)['"`]\)/g, replacement: 'notify.success("成功", "$1")' },
    { pattern: /alert\(['"`]([^'"`]*已[^'"`]*)['"`]\)/g, replacement: 'notify.success("完成", "$1")' },
    
    // 錯誤消息
    { pattern: /alert\(['"`]([^'"`]*失敗[^'"`]*)['"`]\)/g, replacement: 'notify.error("失敗", "$1")' },
    { pattern: /alert\(['"`]([^'"`]*錯誤[^'"`]*)['"`]\)/g, replacement: 'notify.error("錯誤", "$1")' },
    { pattern: /alert\(.*?error.*?\)/gi, replacement: match => {
        const content = match.match(/['"`]([^'"`]+?)['"`]/);
        return content ? `notify.error("錯誤", ${JSON.stringify(content[1])})` : match;
      }
    },
    
    // 提示消息
    { pattern: /alert\(['"`]請[^'"`]*['"`]\)/g, replacement: match => {
        const content = match.match(/['"`]([^'"`]+?)['"`]/);
        return content ? `notify.warning("提示", ${JSON.stringify(content[1])})` : match;
      }
    },
    { pattern: /alert\(['"`]需要[^'"`]*['"`]\)/g, replacement: match => {
        const content = match.match(/['"`]([^'"`]+?)['"`]/);
        return content ? `notify.warning("提示", ${JSON.stringify(content[1])})` : match;
      }
    }
  ];
  
  let result = content;
  for (const { pattern, replacement } of replacements) {
    if (typeof replacement === 'function') {
      result = result.replace(pattern, replacement);
    } else {
      result = result.replace(pattern, replacement);
    }
  }
  
  return result;
}

// 處理文件
files.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  文件不存在: ${file}`);
    return;
  }
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const ext = path.extname(file);
    
    // 添加導入
    content = addImportIfNeeded(content, ext);
    
    // 替換 alert
    const before = content.match(/alert\(/g)?.length || 0;
    content = replaceAlerts(content);
    const after = content.match(/alert\(/g)?.length || 0;
    
    if (before !== after) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ ${file}: 替換了 ${before - after} 個 alert()`);
    } else {
      console.log(`ℹ️  ${file}: 沒有需要替換的 alert()`);
    }
  } catch (error) {
    console.error(`❌ 處理文件失敗 ${file}:`, error.message);
  }
});

console.log('\n✨ 批量替換完成！');

