// scripts/check-power-images.js
// 檢查所有使用過權力券的圖片狀態

const mongoose = require('mongoose');

async function checkPowerImages() {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/my-ai-web';
    await mongoose.connect(uri);
    console.log('✅ 已連接到數據庫\n');
    
    const Image = mongoose.model('Image', new mongoose.Schema({}, { strict: false }));
    
    // 找出所有使用過權力券的圖片
    const powerImages = await Image.find({
      powerUsed: true
    }).select('_id title powerUsed powerUsedAt powerExpiry popScore initialBoost clicks likesCount createdAt').lean();
    
    console.log(`📊 找到 ${powerImages.length} 張使用過權力券的圖片\n`);
    
    if (powerImages.length === 0) {
      console.log('❌ 沒有找到任何使用過權力券的圖片');
      process.exit(0);
    }
    
    const now = new Date();
    
    for (const image of powerImages) {
      console.log(`🖼️  圖片 ID: ${image._id}`);
      console.log(`   標題: ${image.title || '(無標題)'}`);
      console.log(`   powerUsed: ${image.powerUsed}`);
      console.log(`   powerUsedAt: ${image.powerUsedAt || '(未設置)'}`);
      console.log(`   powerExpiry: ${image.powerExpiry || '(未設置)'}`);
      
      if (image.powerExpiry) {
        const expiry = new Date(image.powerExpiry);
        const isExpired = expiry < now;
        const hoursUntilExpiry = (expiry - now) / (1000 * 60 * 60);
        
        console.log(`   是否過期: ${isExpired ? '✅ 是' : '❌ 否'}`);
        console.log(`   ${isExpired ? '已過期' : '還剩'}: ${Math.abs(hoursUntilExpiry).toFixed(2)} 小時`);
      }
      
      console.log(`   當前 popScore: ${(image.popScore || 0).toFixed(1)}`);
      console.log(`   initialBoost: ${(image.initialBoost || 0).toFixed(1)}`);
      console.log(`   基礎分數 (clicks + likes): ${((image.clicks || 0) * 1.0 + (image.likesCount || 0) * 8.0).toFixed(1)}`);
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ 檢查過程中發生錯誤:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 已斷開數據庫連接');
  }
}

checkPowerImages();



