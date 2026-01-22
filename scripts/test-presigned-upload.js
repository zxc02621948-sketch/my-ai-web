/**
 * 診斷腳本：測試 Presigned URL 上傳
 * 
 * 使用方法：
 * 1. 從瀏覽器控制台複製 fullUploadUrl（從 API 響應中）
 * 2. 準備一個測試影片文件
 * 3. 運行：node scripts/test-presigned-upload.js <presignedUrl> <filePath>
 * 
 * 例如：
 * node scripts/test-presigned-upload.js "https://my-ai-web-media.5c6250a0576aa4ca0bb9cdf32be0bee1.r2.cloudflarestorage.com/videos/..." "test.mp4"
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const { URL } = require('url');

const presignedUrl = process.argv[2];
const filePath = process.argv[3];

if (!presignedUrl || !filePath) {
  console.error('❌ 使用方法: node scripts/test-presigned-upload.js <presignedUrl> <filePath>');
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  console.error(`❌ 文件不存在: ${filePath}`);
  process.exit(1);
}

const fileBuffer = fs.readFileSync(filePath);
const fileSize = fileBuffer.length;

console.log('🔍 診斷信息:');
console.log('  Presigned URL:', presignedUrl.substring(0, 100) + '...');
console.log('  文件路徑:', filePath);
console.log('  文件大小:', (fileSize / 1024 / 1024).toFixed(2), 'MB');
console.log('');

const url = new URL(presignedUrl);
const options = {
  hostname: url.hostname,
  port: url.port || (url.protocol === 'https:' ? 443 : 80),
  path: url.pathname + url.search,
  method: 'PUT',
  headers: {
    'Content-Length': fileSize,
    // ✅ 不設置 Content-Type，測試方案 A
  },
};

console.log('📤 開始上傳...');
console.log('  Host:', options.hostname);
console.log('  Path:', options.path.substring(0, 100) + '...');
console.log('  Method:', options.method);
console.log('  Content-Length:', fileSize);
console.log('');

const client = url.protocol === 'https:' ? https : http;

const req = client.request(options, (res) => {
  console.log('📥 響應狀態:', res.statusCode, res.statusMessage);
  console.log('📥 響應 Headers:');
  Object.keys(res.headers).forEach(key => {
    console.log(`    ${key}: ${res.headers[key]}`);
  });
  console.log('');

  let responseBody = '';
  res.on('data', (chunk) => {
    responseBody += chunk.toString();
  });

  res.on('end', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log('✅ 上傳成功！');
      console.log('響應內容:', responseBody || '(空)');
    } else {
      console.error('❌ 上傳失敗！');
      console.error('響應內容:', responseBody);
      
      // ✅ 嘗試解析 XML 錯誤
      if (responseBody.includes('<Error>')) {
        const codeMatch = responseBody.match(/<Code>(.*?)<\/Code>/);
        const messageMatch = responseBody.match(/<Message>(.*?)<\/Message>/);
        if (codeMatch) {
          console.error('');
          console.error('🔍 錯誤代碼:', codeMatch[1]);
          if (messageMatch) {
            console.error('🔍 錯誤訊息:', messageMatch[1]);
          }
          
          // ✅ 根據錯誤代碼提供建議
          const errorCode = codeMatch[1];
          if (errorCode === 'RequestTimeTooSkewed') {
            console.error('');
            console.error('💡 建議: 系統時間偏差過大，請同步系統時間');
          } else if (errorCode === 'SignatureDoesNotMatch') {
            console.error('');
            console.error('💡 建議: 簽名不匹配，請檢查：');
            console.error('   1. URL 是否被修改或重組');
            console.error('   2. endpoint style 是否一致');
            console.error('   3. 簽名算法是否正確');
          } else if (errorCode === 'AccessDenied') {
            console.error('');
            console.error('💡 建議: 權限不足，請檢查：');
            console.error('   1. R2 API Key 是否有寫入權限');
            console.error('   2. Bucket Policy 是否允許該操作');
          }
        }
      }
    }
  });
});

req.on('error', (error) => {
  console.error('❌ 請求錯誤:', error.message);
  console.error('   這可能是網絡連接問題');
});

req.write(fileBuffer);
req.end();



