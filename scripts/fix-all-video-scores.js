// scripts/fix-all-video-scores.js
// 修復所有影片的 popScore 和 initialBoost

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// 動態導入模型和工具函數
const Video = (await import('../models/Video.js')).default;
const { 
  computeVideoCompleteness, 
  computeVideoPopScore, 
  computeVideoInitialBoostFromTop 
} = await import('../utils/scoreVideo.js');

async function fixAllVideoScores() {
  try {
    console.log('🔌 連接資料庫...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ 資料庫連接成功\n');

    // 獲取所有影片
    const videos = await Video.find({}).lean();
    console.log(`📊 找到 ${videos.length} 個影片\n`);

    if (videos.length === 0) {
      console.log('⚠️ 沒有影片需要處理');
      process.exit(0);
    }

    // 獲取當前最高分數（用於計算 initialBoost）
    const topVideo = await Video.findOne({}).sort({ popScore: -1 }).select('popScore').lean();
    const topVideoScore = topVideo?.popScore || 0;
    console.log(`🔝 當前最高分數: ${topVideoScore}\n`);

    let updated = 0;
    const results = [];

    for (const video of videos) {
      const oldData = {
        popScore: video.popScore || 0,
        initialBoost: video.initialBoost || 0,
        completeness: video.completenessScore || 0
      };

      // 重新計算完整度
      const newCompleteness = computeVideoCompleteness(video);

      // 重新計算初始加成
      const newInitialBoost = computeVideoInitialBoostFromTop(topVideoScore);

      // 更新影片對象以計算 popScore
      const updatedVideo = {
        ...video,
        completenessScore: newCompleteness,
        initialBoost: newInitialBoost
      };

      // 重新計算 popScore
      const newPopScore = computeVideoPopScore(updatedVideo);

      // 更新資料庫
      await Video.updateOne(
        { _id: video._id },
        {
          $set: {
            completenessScore: newCompleteness,
            initialBoost: newInitialBoost,
            popScore: newPopScore,
            hasMetadata: newCompleteness > 50
          }
        }
      );

      updated++;
      
      const result = {
        title: video.title,
        old: oldData,
        new: {
          popScore: Math.round(newPopScore * 100) / 100,
          initialBoost: newInitialBoost,
          completeness: newCompleteness
        }
      };
      
      results.push(result);
      
      console.log(`✅ [${updated}/${videos.length}] ${video.title}`);
      console.log(`   舊分數: popScore=${oldData.popScore}, initialBoost=${oldData.initialBoost}, completeness=${oldData.completeness}`);
      console.log(`   新分數: popScore=${result.new.popScore}, initialBoost=${result.new.initialBoost}, completeness=${result.new.completeness}`);
      console.log('');
    }

    console.log('\n✨ 修復完成！');
    console.log(`📊 總共處理: ${videos.length} 個影片`);
    console.log(`✅ 成功更新: ${updated} 個影片\n`);

    // 顯示統計
    const avgPopScore = results.reduce((sum, r) => sum + r.new.popScore, 0) / results.length;
    const maxPopScore = Math.max(...results.map(r => r.new.popScore));
    const minPopScore = Math.min(...results.map(r => r.new.popScore));

    console.log('📈 統計資訊:');
    console.log(`   平均分數: ${Math.round(avgPopScore * 100) / 100}`);
    console.log(`   最高分數: ${Math.round(maxPopScore * 100) / 100}`);
    console.log(`   最低分數: ${Math.round(minPopScore * 100) / 100}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ 錯誤:', error);
    process.exit(1);
  }
}

fixAllVideoScores();


