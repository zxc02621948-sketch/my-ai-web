// scripts/migrate-video-ratings.js
// 修復影片評級：將 'all' 改為 'sfw'

import { dbConnect } from '../lib/db.js';
import Video from '../models/Video.js';

async function migrateVideoRatings() {
  try {
    console.log('🔄 開始修復影片評級...');
    
    await dbConnect();
    
    // 1. 檢查有多少影片使用 'all' 評級
    const allVideos = await Video.countDocuments({ rating: 'all' });
    console.log(`📊 找到 ${allVideos} 個使用 'all' 評級的影片`);
    
    if (allVideos === 0) {
      console.log('✅ 沒有需要修復的影片');
      return;
    }
    
    // 2. 更新所有 'all' 評級為 'sfw'
    const result = await Video.updateMany(
      { rating: 'all' },
      { $set: { rating: 'sfw' } }
    );
    
    console.log(`✅ 成功更新 ${result.modifiedCount} 個影片的評級`);
    
    // 3. 驗證修復結果
    const remainingAll = await Video.countDocuments({ rating: 'all' });
    const sfwCount = await Video.countDocuments({ rating: 'sfw' });
    
    console.log(`📊 修復後統計：`);
    console.log(`   - 剩餘 'all' 評級：${remainingAll}`);
    console.log(`   - 'sfw' 評級：${sfwCount}`);
    
    if (remainingAll === 0) {
      console.log('🎉 所有影片評級修復完成！');
    } else {
      console.log('⚠️ 還有影片未修復，請檢查');
    }
    
  } catch (error) {
    console.error('❌ 修復影片評級失敗：', error);
  } finally {
    process.exit(0);
  }
}

migrateVideoRatings();
