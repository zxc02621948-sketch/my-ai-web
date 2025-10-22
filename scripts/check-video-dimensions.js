import mongoose from 'mongoose';

// Video Schema
const VideoSchema = new mongoose.Schema({}, { strict: false });
const Video = mongoose.model('Video', VideoSchema);

async function checkVideoDimensions() {
  try {
    // 從 .env.local 讀取
    const fs = await import('fs');
    const path = await import('path');
    const envPath = path.join(process.cwd(), '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const mongoUri = envContent.split('\n').find(line => line.startsWith('MONGODB_URI='))?.split('=')[1]?.trim();
    
    if (!mongoUri) {
      throw new Error('找不到 MONGODB_URI');
    }
    
    await mongoose.connect(mongoUri);
    console.log('✅ 連接到 MongoDB');

    const videos = await Video.find().sort({ uploadDate: -1 }).limit(5);
    
    console.log('\n📊 最近 5 個影片的尺寸資訊:\n');
    
    videos.forEach((video, index) => {
      console.log(`${index + 1}. ${video.title || '未命名'}`);
      console.log(`   Width: ${video.width || '未設定'}`);
      console.log(`   Height: ${video.height || '未設定'}`);
      console.log(`   Resolution: ${video.resolution || '未設定'}`);
      console.log(`   上傳日期: ${video.uploadDate}`);
      console.log('');
    });

    mongoose.connection.close();
  } catch (error) {
    console.error('❌ 錯誤:', error);
    process.exit(1);
  }
}

checkVideoDimensions();

