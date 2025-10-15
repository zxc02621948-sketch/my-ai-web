/**
 * 語法檢查腳本
 * 檢查所有修復後的文件是否有語法錯誤
 */

const fs = require('fs');
const path = require('path');

class SyntaxChecker {
  constructor() {
    this.errors = [];
    this.files = [
      'components/context/PlayerContext.js',
      'components/player/GlobalYouTubeBridge.jsx'
    ];
  }

  // 檢查語法錯誤模式
  checkSyntaxPatterns(content, filePath) {
    const patterns = [
      {
        pattern: /&& .* = /,
        name: '無效的賦值語法',
        description: '&& 操作符後不能直接賦值'
      },
      {
        pattern: /\.current && \.current\./,
        name: '重複的 current 訪問',
        description: '重複的 current 訪問語法'
      },
      {
        pattern: /if \(.* && .* = /,
        name: '條件賦值語法錯誤',
        description: 'if 條件中不能直接賦值'
      }
    ];

    patterns.forEach(pattern => {
      const matches = content.match(pattern.pattern);
      if (matches) {
        this.errors.push({
          file: filePath,
          type: pattern.name,
          description: pattern.description,
          matches: matches.length
        });
      }
    });
  }

  // 檢查文件
  checkFile(filePath) {
    console.log(`🔍 檢查文件: ${filePath}`);
    
    const fullPath = path.join(__dirname, filePath);
    if (!fs.existsSync(fullPath)) {
      this.errors.push({
        file: filePath,
        type: '文件不存在',
        description: '文件不存在'
      });
      return;
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    this.checkSyntaxPatterns(content, filePath);
    
    console.log(`  ✅ 檢查完成`);
  }

  // 檢查所有文件
  checkAllFiles() {
    console.log('🔍 開始語法檢查...\n');
    
    this.files.forEach(file => {
      this.checkFile(file);
    });
    
    this.generateReport();
  }

  // 生成報告
  generateReport() {
    console.log('\n📊 語法檢查報告');
    console.log('='.repeat(50));
    
    if (this.errors.length === 0) {
      console.log('✅ 沒有發現語法錯誤！');
    } else {
      console.log(`❌ 發現 ${this.errors.length} 個語法問題:`);
      
      this.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error.type} (${error.file})`);
        console.log(`     ${error.description}`);
        if (error.matches) {
          console.log(`     發現 ${error.matches} 個匹配`);
        }
      });
    }
    
    return this.errors;
  }
}

// 運行語法檢查
const checker = new SyntaxChecker();
checker.checkAllFiles();




