const mongoose = require('mongoose');

const ImageSchema = new mongoose.Schema({}, { strict: false });
const Image = mongoose.models.Image || mongoose.model('Image', ImageSchema);

async function updateImageUrls() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/myaiweb');
    console.log('✅ 已連接到 MongoDB');
    
    const images = await Image.find({});
    console.log(`找到 ${images.length} 張圖片`);
    
    const realImageUrls = [
      'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=512&h=768&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=512&h=768&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=512&h=768&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=512&h=768&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=512&h=768&fit=crop&crop=center'
    ];
    
    for (let i = 0; i < images.length; i++) {
      await Image.updateOne(
        { _id: images[i]._id },
        { imageUrl: realImageUrls[i] }
      );
      console.log(`✅ 更新圖片 ${i + 1}: ${images[i].title}`);
    }
    
    console.log('🎉 所有圖片 URL 已更新！');
  } catch (error) {
    console.error('❌ 錯誤:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 已斷開 MongoDB 連線');
  }
}

updateImageUrls();
