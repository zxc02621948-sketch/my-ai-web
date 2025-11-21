// scripts/fix-power-coupon-scores.js
// 修復已使用權力券但分數計算不正確的內容（圖片、影片、音樂）
// 這個腳本會重新計算使用了權力券的內容的 popScore，使用修復後的邏輯（基於 powerUsedAt）

import mongoose from 'mongoose';

// 動態導入模型和工具函數
const Image = (await import('../models/Image.js')).default;
const Video = (await import('../models/Video.js')).default;
const Music = (await import('../models/Music.js')).default;
const { 
  computePopScore,
  computeInitialBoostDecay,
  ensureLikesCount
} = await import('../utils/score.js');
const {
  computeVideoPopScore,
  computeVideoInitialBoostDecay,
  ensureVideoLikesCount
} = await import('../utils/scoreVideo.js');
const {
  computeMusicPopScore,
  computeMusicInitialBoostDecay,
  ensureMusicLikesCount
} = await import('../utils/scoreMusic.js');

async function fixPowerCouponScores() {
  try {
    console.log('🔌 連接資料庫...');
    // 從環境變量或直接使用連接字串
    const uri = process.env.MONGODB_URI || process.env.NEXT_PUBLIC_MONGODB_URI || 'mongodb://localhost:27017/my-ai-web';
    await mongoose.connect(uri);
    console.log('✅ 已連接到數據庫\n');

    const now = new Date();
    
    // ===== 修復圖片 =====
    console.log('🖼️  開始修復使用權力券的圖片...\n');
    const powerImages = await Image.find({
      powerUsed: true,
      powerUsedAt: { $exists: true, $ne: null }
    }).lean();

    console.log(`📊 找到 ${powerImages.length} 張使用過權力券的圖片\n`);

    let fixedImages = 0;
    for (const image of powerImages) {
      // 檢查是否過期
      const isExpired = image.powerExpiry && new Date(image.powerExpiry) < now;
      
      // 使用修復後的函數重新計算分數
      const newPopScore = computePopScore(image);
      const oldPopScore = image.popScore || 0;
      
      const difference = Math.abs(newPopScore - oldPopScore);
      
      // 如果分數差異超過 0.1，則更新
      if (difference > 0.1 || isExpired) {
        console.log(`🔧 修復圖片: ${image.title || image._id}`);
        console.log(`   狀態: ${isExpired ? '已過期' : '使用中'}`);
        console.log(`   舊分數: ${oldPopScore.toFixed(2)}`);
        console.log(`   新分數: ${newPopScore.toFixed(2)}`);
        if (difference > 0.1) {
          console.log(`   差異: ${difference.toFixed(2)}`);
        }
        console.log(`   權力券使用時間: ${image.powerUsedAt}`);
        if (image.powerExpiry) {
          console.log(`   權力券過期時間: ${image.powerExpiry}`);
        }
        console.log('');

        await Image.updateOne(
          { _id: image._id },
          { $set: { popScore: newPopScore } }
        );
        
        fixedImages++;
      }
    }

    console.log(`✅ 圖片修復完成！共修復 ${fixedImages} 張圖片\n`);

    // ===== 修復影片 =====
    console.log('🎬 開始修復使用權力券的影片...\n');
    const powerVideos = await Video.find({
      powerUsed: true,
      powerUsedAt: { $exists: true, $ne: null }
    }).lean();

    console.log(`📊 找到 ${powerVideos.length} 個使用過權力券的影片\n`);

    let fixedVideos = 0;
    for (const video of powerVideos) {
      // 檢查是否過期
      const isExpired = video.powerExpiry && new Date(video.powerExpiry) < now;
      
      // 使用修復後的函數重新計算分數
      const newPopScore = computeVideoPopScore(video);
      const oldPopScore = video.popScore || 0;
      
      const difference = Math.abs(newPopScore - oldPopScore);
      
      // 如果分數差異超過 0.1，則更新
      if (difference > 0.1 || isExpired) {
        console.log(`🔧 修復影片: ${video.title || video._id}`);
        console.log(`   狀態: ${isExpired ? '已過期' : '使用中'}`);
        console.log(`   舊分數: ${oldPopScore.toFixed(2)}`);
        console.log(`   新分數: ${newPopScore.toFixed(2)}`);
        if (difference > 0.1) {
          console.log(`   差異: ${difference.toFixed(2)}`);
        }
        console.log(`   權力券使用時間: ${video.powerUsedAt}`);
        if (video.powerExpiry) {
          console.log(`   權力券過期時間: ${video.powerExpiry}`);
        }
        console.log('');

        await Video.updateOne(
          { _id: video._id },
          { $set: { popScore: newPopScore } }
        );
        
        fixedVideos++;
      }
    }

    console.log(`✅ 影片修復完成！共修復 ${fixedVideos} 個影片\n`);

    // ===== 修復音樂 =====
    console.log('🎵 開始修復使用權力券的音樂...\n');
    const powerMusic = await Music.find({
      powerUsed: true,
      powerUsedAt: { $exists: true, $ne: null }
    }).lean();

    console.log(`📊 找到 ${powerMusic.length} 首使用過權力券的音樂\n`);

    let fixedMusic = 0;
    for (const music of powerMusic) {
      // 檢查是否過期
      const isExpired = music.powerExpiry && new Date(music.powerExpiry) < now;
      
      // 使用修復後的函數重新計算分數
      const newPopScore = computeMusicPopScore(music);
      const oldPopScore = music.popScore || 0;
      
      const difference = Math.abs(newPopScore - oldPopScore);
      
      // 如果分數差異超過 0.1，則更新
      if (difference > 0.1 || isExpired) {
        console.log(`🔧 修復音樂: ${music.title || music._id}`);
        console.log(`   狀態: ${isExpired ? '已過期' : '使用中'}`);
        console.log(`   舊分數: ${oldPopScore.toFixed(2)}`);
        console.log(`   新分數: ${newPopScore.toFixed(2)}`);
        if (difference > 0.1) {
          console.log(`   差異: ${difference.toFixed(2)}`);
        }
        console.log(`   權力券使用時間: ${music.powerUsedAt}`);
        if (music.powerExpiry) {
          console.log(`   權力券過期時間: ${music.powerExpiry}`);
        }
        console.log('');

        await Music.updateOne(
          { _id: music._id },
          { $set: { popScore: newPopScore } }
        );
        
        fixedMusic++;
      }
    }

    console.log(`✅ 音樂修復完成！共修復 ${fixedMusic} 首音樂\n`);

    // 總計
    console.log('\n✨ 修復完成！');
    console.log(`📊 總計：`);
    console.log(`   - 圖片：修復 ${fixedImages}/${powerImages.length} 張`);
    console.log(`   - 影片：修復 ${fixedVideos}/${powerVideos.length} 個`);
    console.log(`   - 音樂：修復 ${fixedMusic}/${powerMusic.length} 首`);
    console.log(`   - 總共：修復 ${fixedImages + fixedVideos + fixedMusic} 個內容\n`);

  } catch (error) {
    console.error('❌ 修復過程中發生錯誤:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 已斷開數據庫連接');
    process.exit(0);
  }
}

// 執行修復
fixPowerCouponScores();

