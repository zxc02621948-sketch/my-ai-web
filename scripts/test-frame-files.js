const fs = require('fs');
const path = require('path');

const frameFiles = [
  '/frames/default.svg',
  '/frames/cat-ears.svg',
  '/frames/flame-ring.svg',
  '/frames/flower-wreath.svg',
  '/frames/ai-generated-7899315_1280.png',
  '/frames/animals-5985896_1280.png',
  '/frames/flowers-1973874_1280.png',
  '/frames/leaves-6649803_1280.png'
];

console.log('🔧 檢查頭像框文件...');

frameFiles.forEach(filePath => {
  const fullPath = path.join(process.cwd(), 'public', filePath);
  const exists = fs.existsSync(fullPath);
  console.log(`${exists ? '✅' : '❌'} ${filePath} - ${exists ? '存在' : '不存在'}`);
  if (exists) {
    const stats = fs.statSync(fullPath);
    console.log(`   大小: ${stats.size} bytes`);
  }
});

console.log('🎉 檢查完成！');
