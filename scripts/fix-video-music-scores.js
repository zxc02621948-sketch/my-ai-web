// 修復舊影片和音樂的 popScore 和 initialBoost
import { dbConnect } from '../lib/db.js';
import Video from '../models/Video.js';
import Music from '../models/Music.js';
import { computeVideoCompleteness, computeVideoPopScore, computeVideoInitialBoostFromTop } from '../utils/scoreVideo.js';
import { computeMusicCompleteness, computeMusicPopScore, computeMusicInitialBoostFromTop } from '../utils/scoreMusic.js';

async function fixVideoScores() {
  await dbConnect();
  
  console.log('🎬 檢查影片分數...\n');
  
  // 獲取所有影片
  const videos = await Video.find({}).lean();
  console.log(`找到 ${videos.length} 個影片\n`);
  
  // 獲取當前最高分數
  const topVideo = await Video.findOne({}).sort({ popScore: -1 }).select('popScore').lean();
  const topScore = topVideo?.popScore || 0;
  console.log(`當前最高分數: ${topScore}\n`);
  
  let updatedCount = 0;
  
  for (const video of videos) {
    console.log(`\n📹 影片: ${video.title}`);
    console.log(`  - 舊的 popScore: ${video.popScore || 0}`);
    console.log(`  - 舊的 initialBoost: ${video.initialBoost || 0}`);
    console.log(`  - 舊的 completeness: ${video.completenessScore || 0}`);
    
    // 重新計算完整度
    const newCompleteness = computeVideoCompleteness(video);
    
    // 重新計算初始加成
    const newInitialBoost = computeVideoInitialBoostFromTop(topScore);
    
    // 更新影片對象以計算 popScore
    const updatedVideo = {
      ...video,
      completenessScore: newCompleteness,
      initialBoost: newInitialBoost
    };
    
    // 重新計算 popScore
    const newPopScore = computeVideoPopScore(updatedVideo);
    
    console.log(`  - 新的 completeness: ${newCompleteness}`);
    console.log(`  - 新的 initialBoost: ${newInitialBoost}`);
    console.log(`  - 新的 popScore: ${newPopScore.toFixed(2)}`);
    
    // 更新資料庫
    await Video.updateOne(
      { _id: video._id },
      {
        $set: {
          completenessScore: newCompleteness,
          initialBoost: newInitialBoost,
          popScore: newPopScore,
          hasMetadata: newCompleteness > 50 // 完整度 > 50% 視為有元數據
        }
      }
    );
    
    updatedCount++;
  }
  
  console.log(`\n✅ 已更新 ${updatedCount} 個影片的分數！`);
}

async function fixMusicScores() {
  console.log('\n🎵 檢查音樂分數...\n');
  
  // 獲取所有音樂
  const music = await Music.find({}).lean();
  console.log(`找到 ${music.length} 個音樂\n`);
  
  if (music.length === 0) {
    console.log('沒有音樂需要更新');
    return;
  }
  
  // 獲取當前最高分數
  const topMusic = await Music.findOne({}).sort({ popScore: -1 }).select('popScore').lean();
  const topScore = topMusic?.popScore || 0;
  console.log(`當前最高分數: ${topScore}\n`);
  
  let updatedCount = 0;
  
  for (const track of music) {
    console.log(`\n🎼 音樂: ${track.title}`);
    console.log(`  - 舊的 popScore: ${track.popScore || 0}`);
    console.log(`  - 舊的 initialBoost: ${track.initialBoost || 0}`);
    console.log(`  - 舊的 completeness: ${track.completenessScore || 0}`);
    
    // 重新計算完整度
    const newCompleteness = computeMusicCompleteness(track);
    
    // 重新計算初始加成
    const newInitialBoost = computeMusicInitialBoostFromTop(topScore);
    
    // 更新音樂對象以計算 popScore
    const updatedMusic = {
      ...track,
      completenessScore: newCompleteness,
      initialBoost: newInitialBoost
    };
    
    // 重新計算 popScore
    const newPopScore = computeMusicPopScore(updatedMusic);
    
    console.log(`  - 新的 completeness: ${newCompleteness}`);
    console.log(`  - 新的 initialBoost: ${newInitialBoost}`);
    console.log(`  - 新的 popScore: ${newPopScore.toFixed(2)}`);
    
    // 更新資料庫
    await Music.updateOne(
      { _id: track._id },
      {
        $set: {
          completenessScore: newCompleteness,
          initialBoost: newInitialBoost,
          popScore: newPopScore,
          hasMetadata: newCompleteness > 50 // 完整度 > 50% 視為有元數據
        }
      }
    );
    
    updatedCount++;
  }
  
  console.log(`\n✅ 已更新 ${updatedCount} 個音樂的分數！`);
}

async function main() {
  try {
    await fixVideoScores();
    await fixMusicScores();
    
    console.log('\n\n🎉 所有分數更新完成！');
    process.exit(0);
  } catch (error) {
    console.error('❌ 錯誤:', error);
    process.exit(1);
  }
}

main();



