// scripts/update-api-responses.js
/**
 * 此腳本用於批量更新API端點的錯誤響應格式
 * 將所有API端點的錯誤響應格式統一為使用errorHandler.js中的apiError和apiSuccess
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

// API目錄路徑
const API_DIR = path.join(__dirname, '..', 'app', 'api');

// 需要導入的模塊
const IMPORT_STATEMENT = "import { apiError, apiSuccess, withErrorHandling } from \"@/lib/errorHandler\";";

// 替換模式
const REPLACEMENTS = [
  // NextResponse.json 錯誤響應替換
  {
    pattern: /NextResponse\.json\(\s*{\s*(?:error|message):\s*["'](.+?)["']\s*}(?:,\s*{\s*status:\s*(\d+)\s*})?\s*\)/g,
    replacement: (match, message, status = 500) => `apiError("${message}", ${status})`
  },
  // NextResponse.json 帶有success: false的錯誤響應替換
  {
    pattern: /NextResponse\.json\(\s*{\s*success:\s*false,\s*(?:error|message):\s*["'](.+?)["']\s*}(?:,\s*{\s*status:\s*(\d+)\s*})?\s*\)/g,
    replacement: (match, message, status = 500) => `apiError("${message}", ${status})`
  },
  // new Response 錯誤響應替換
  {
    pattern: /new\s+Response\(JSON\.stringify\(\s*{\s*(?:ok:\s*false,\s*)?(?:error|message):\s*["'](.+?)["']\s*}\s*\)(?:,\s*{\s*status:\s*(\d+)\s*})?\s*\)/g,
    replacement: (match, message, status = 500) => `apiError("${message}", ${status})`
  },
  // NextResponse.json 成功響應替換
  {
    pattern: /NextResponse\.json\(\s*{\s*(?:success:\s*true|ok:\s*true)(?:,\s*(.+?))?\s*}(?:,\s*{\s*status:\s*(\d+)\s*})?\s*\)/g,
    replacement: (match, data, status = 200) => data ? `apiSuccess({ ${data} }, ${status})` : `apiSuccess({}, ${status})`
  },
  // 普通NextResponse.json響應替換
  {
    pattern: /NextResponse\.json\(\s*{\s*(.+?)\s*}(?:,\s*{\s*status:\s*(\d+)\s*})?\s*\)/g,
    replacement: (match, data, status = 200) => `apiSuccess({ ${data} }${status !== '200' ? `, ${status}` : ''})`
  }
];

// 檢查文件是否已經導入了errorHandler
function hasErrorHandlerImport(content) {
  return content.includes('apiError') || content.includes('apiSuccess') || content.includes('withErrorHandling');
}

// 添加導入語句
function addImportStatement(content) {
  if (hasErrorHandlerImport(content)) {
    return content;
  }
  
  // 查找最後一個import語句
  const lastImportIndex = content.lastIndexOf('import');
  if (lastImportIndex === -1) {
    return IMPORT_STATEMENT + '\n\n' + content;
  }
  
  const endOfImportIndex = content.indexOf('\n', lastImportIndex);
  if (endOfImportIndex === -1) {
    return content + '\n' + IMPORT_STATEMENT;
  }
  
  return content.slice(0, endOfImportIndex + 1) + IMPORT_STATEMENT + '\n' + content.slice(endOfImportIndex + 1);
}

// 替換錯誤響應格式
function replaceErrorResponses(content) {
  let newContent = content;
  
  for (const { pattern, replacement } of REPLACEMENTS) {
    newContent = newContent.replace(pattern, replacement);
  }
  
  return newContent;
}

// 處理單個文件
async function processFile(filePath) {
  try {
    const content = await readFile(filePath, 'utf8');
    
    // 檢查文件是否包含NextResponse或Response
    if (!content.includes('NextResponse') && !content.includes('new Response')) {
      return;
    }
    
    // 添加導入語句並替換錯誤響應格式
    let newContent = addImportStatement(content);
    newContent = replaceErrorResponses(newContent);
    
    // 如果內容有變化，寫入文件
    if (newContent !== content) {
      await writeFile(filePath, newContent, 'utf8');
      console.log(`Updated: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
  }
}

// 遞歸處理目錄
async function processDirectory(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    
    if (entry.isDirectory()) {
      await processDirectory(fullPath);
    } else if (entry.name.endsWith('.js') && entry.name.includes('route')) {
      await processFile(fullPath);
    }
  }
}

// 主函數
async function main() {
  console.log('開始更新API端點的錯誤響應格式...');
  await processDirectory(API_DIR);
  console.log('更新完成！');
}

main().catch(console.error);