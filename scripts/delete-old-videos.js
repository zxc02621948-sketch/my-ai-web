const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const VideoSchema = new mongoose.Schema({
  title: String,
  videoUrl: String,
  // ... 其他欄位
}, { timestamps: true });

const Video = mongoose.models.Video || mongoose.model('Video', VideoSchema);

async function deleteOldVideos() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ 已連接到 MongoDB');

    // 找到所有使用舊 URL 格式的影片
    const oldVideos = await Video.find({
      videoUrl: { $regex: /media\.aicreateaworld\.com/ }
    });

    console.log(`📹 找到 ${oldVideos.length} 個舊格式的影片：`);
    
    oldVideos.forEach((video, index) => {
      console.log(`${index + 1}. ${video.title} - ${video.videoUrl}`);
    });

    if (oldVideos.length === 0) {
      console.log('✅ 沒有舊格式的影片需要刪除');
      return;
    }

    // 詢問確認（在實際環境中你可能想要添加確認步驟）
    console.log('\n🗑️  準備刪除這些影片...');
    
    // 刪除舊影片
    const deleteResult = await Video.deleteMany({
      videoUrl: { $regex: /media\.aicreateaworld\.com/ }
    });

    console.log(`🎉 成功刪除 ${deleteResult.deletedCount} 個舊影片！`);

  } catch (error) {
    console.error('❌ 刪除失敗:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ 已斷開 MongoDB 連接');
  }
}

deleteOldVideos();


