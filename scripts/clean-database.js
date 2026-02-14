const mongoose = require('mongoose');

const args = process.argv.slice(2);
const isConfirmed = args.includes('--confirm');
const allowProduction = args.includes('--allow-production');

if (!isConfirmed) {
  console.error('❌ 安全中止：此腳本會刪除資料。');
  console.error('   請加上 --confirm 才能執行。');
  process.exit(1);
}

if (process.env.NODE_ENV === 'production' && !allowProduction) {
  console.error('❌ 安全中止：目前是 production，預設禁止執行。');
  console.error('   若你非常確定，請額外加上 --allow-production。');
  process.exit(1);
}

async function cleanDatabase() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/myaiweb');
    console.log('✅ 已連接到 MongoDB');

    const Image = mongoose.model('Image', new mongoose.Schema({}, { strict: false }));
    
    // 刪除所有圖片
    const result = await Image.deleteMany({});
    console.log(`🗑️ 已刪除 ${result.deletedCount} 張圖片`);

    console.log('🎉 資料庫清理完成！');
    
  } catch (error) {
    console.error('❌ 錯誤:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 已斷開 MongoDB 連線');
  }
}

cleanDatabase();
