const mongoose = require('mongoose');

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
