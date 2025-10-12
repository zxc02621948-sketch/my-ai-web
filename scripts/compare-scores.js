// scripts/compare-scores.js
// 比較數據庫 popScore 和實時計算的差異

const mongoose = require('mongoose');

const POP_W_CLICK = 1.0;
const POP_W_LIKE = 8.0;
const POP_W_COMPLETE = 0.05;
const POP_NEW_WINDOW_HOURS = 10;

async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/my-ai-web';
  await mongoose.connect(uri);
}

const Image = mongoose.model('Image', new mongoose.Schema({}, { strict: false }));

function calculateBaseScore(image) {
  return (image.clicks || 0) * POP_W_CLICK + 
         (image.likesCount || 0) * POP_W_LIKE + 
         (image.completenessScore || 0) * POP_W_COMPLETE;
}

function calculateNaturalBoost(image) {
  const now = Date.now();
  const createdAt = new Date(image.createdAt).getTime();
  const hoursElapsed = (now - createdAt) / (1000 * 60 * 60);
  
  if (hoursElapsed >= POP_NEW_WINDOW_HOURS) return 0;
  
  const boostFactor = Math.max(0, 1 - (hoursElapsed / POP_NEW_WINDOW_HOURS));
  return Math.round((image.initialBoost || 0) * boostFactor);
}

function calculatePowerBoost(image) {
  if (!image.powerUsed || !image.powerUsedAt) return 0;
  
  const now = Date.now();
  const powerUsedAt = new Date(image.powerUsedAt).getTime();
  const powerHoursElapsed = (now - powerUsedAt) / (1000 * 60 * 60);
  
  if (powerHoursElapsed >= POP_NEW_WINDOW_HOURS) return 0;
  
  const powerBoostFactor = Math.max(0, 1 - (powerHoursElapsed / POP_NEW_WINDOW_HOURS));
  return Math.round((image.initialBoost || 0) * powerBoostFactor);
}

function calculateLiveScore(image) {
  const baseScore = calculateBaseScore(image);
  const naturalBoost = calculateNaturalBoost(image);
  const powerBoost = calculatePowerBoost(image);
  const finalBoost = Math.max(powerBoost, naturalBoost);
  return baseScore + finalBoost;
}

async function compareScores() {
  try {
    await connectDB();
    console.log('✅ 已連接到數據庫\n');
    
    const images = await Image.find({})
      .sort({ popScore: -1 })
      .limit(20)
      .lean();
    
    console.log('📊 前 20 名圖片的分數比較:\n');
    console.log('排名 | 標題 | DB分數 | 實時分數 | 差異\n' + '='.repeat(80));
    
    images.forEach((img, idx) => {
      const dbScore = img.popScore || 0;
      const liveScore = calculateLiveScore(img);
      const diff = liveScore - dbScore;
      
      const title = (img.title || '(無標題)').substring(0, 20).padEnd(20);
      const rank = String(idx + 1).padStart(2);
      const dbStr = dbScore.toFixed(1).padStart(7);
      const liveStr = liveScore.toFixed(1).padStart(7);
      const diffStr = (diff >= 0 ? '+' : '') + diff.toFixed(1);
      
      console.log(`${rank}   | ${title} | ${dbStr} | ${liveStr}   | ${diffStr}`);
    });
    
    console.log('\n💡 說明:');
    console.log('   • DB分數: 數據庫存儲的 popScore');
    console.log('   • 實時分數: 根據當前時間計算的 livePopScore');
    console.log('   • 差異: 實時分數 - DB分數\n');
    
  } catch (error) {
    console.error('❌ 錯誤:', error);
  } finally {
    await mongoose.disconnect();
  }
}

compareScores();


