const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const VideoSchema = new mongoose.Schema({
  title: String,
  videoUrl: String,
  // ... 其他欄位
}, { timestamps: true });

const Video = mongoose.models.Video || mongoose.model('Video', VideoSchema);

async function fixVideoUrls() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ 已連接到 MongoDB');

    const videos = await Video.find({
      videoUrl: { $regex: /media\.aicreateaworld\.com/ }
    });

    console.log(`📹 找到 ${videos.length} 個需要修復的影片`);

    if (videos.length === 0) {
      console.log('✅ 沒有需要修復的影片');
      return;
    }

    const accountId = process.env.R2_ACCOUNT_ID;
    if (!accountId) {
      console.error('❌ 找不到 R2_ACCOUNT_ID 環境變數');
      return;
    }

    const newBaseUrl = `https://pub-${accountId}.r2.dev`;

    for (const video of videos) {
      const oldUrl = video.videoUrl;
      
      // 提取檔案路徑
      const urlParts = oldUrl.split('/videos/');
      if (urlParts.length === 2) {
        const filePath = urlParts[1];
        const newUrl = `${newBaseUrl}/videos/${filePath}`;
        
        video.videoUrl = newUrl;
        await video.save();
        
        console.log(`✅ 修復影片: ${video.title}`);
        console.log(`   舊 URL: ${oldUrl}`);
        console.log(`   新 URL: ${newUrl}`);
      }
    }

    console.log(`🎉 成功修復 ${videos.length} 個影片的 URL！`);

  } catch (error) {
    console.error('❌ 修復失敗:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ 已斷開 MongoDB 連接');
  }
}

fixVideoUrls();


