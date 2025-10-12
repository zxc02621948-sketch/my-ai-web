// scripts/sync-all-popscores.js
// 同步所有圖片的 popScore，讓數據庫分數和實時計算一致

const mongoose = require('mongoose');

// 計算常數
const POP_W_CLICK = 1.0;
const POP_W_LIKE = 8.0;
const POP_W_COMPLETE = 0.05;
const POP_NEW_WINDOW_HOURS = 10;

async function connectDB() {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/my-ai-web';
    await mongoose.connect(uri);
    console.log('✅ 已連接到數據庫\n');
  } catch (error) {
    console.error('❌ 數據庫連接失敗:', error);
    process.exit(1);
  }
}

const Image = mongoose.model('Image', new mongoose.Schema({}, { strict: false }));

// 計算基礎分數
function calculateBaseScore(image) {
  const clicks = image.clicks || 0;
  const likesCount = image.likesCount || 0;
  const completenessScore = image.completenessScore || 0;
  
  return clicks * POP_W_CLICK + likesCount * POP_W_LIKE + completenessScore * POP_W_COMPLETE;
}

// 計算新圖自然衰減加成
function calculateNaturalBoost(image) {
  const now = Date.now();
  const createdAt = new Date(image.createdAt).getTime();
  const hoursElapsed = (now - createdAt) / (1000 * 60 * 60);
  
  if (hoursElapsed >= POP_NEW_WINDOW_HOURS) {
    return 0;
  }
  
  const boostFactor = Math.max(0, 1 - (hoursElapsed / POP_NEW_WINDOW_HOURS));
  const initialBoost = image.initialBoost || 0;
  
  return Math.round(initialBoost * boostFactor);
}

// 計算權力券加成
function calculatePowerBoost(image) {
  if (!image.powerUsed || !image.powerUsedAt) {
    return 0;
  }
  
  const now = Date.now();
  const powerUsedAt = new Date(image.powerUsedAt).getTime();
  const powerHoursElapsed = (now - powerUsedAt) / (1000 * 60 * 60);
  
  if (powerHoursElapsed >= POP_NEW_WINDOW_HOURS) {
    return 0; // 超過 10 小時，權力券失效
  }
  
  const powerBoostFactor = Math.max(0, 1 - (powerHoursElapsed / POP_NEW_WINDOW_HOURS));
  const initialBoost = image.initialBoost || 0;
  
  return Math.round(initialBoost * powerBoostFactor);
}

// 計算完整的 popScore
function calculatePopScore(image) {
  const baseScore = calculateBaseScore(image);
  const naturalBoost = calculateNaturalBoost(image);
  const powerBoost = calculatePowerBoost(image);
  
  // 取較大值（權力券和自然加成不疊加）
  const finalBoost = Math.max(powerBoost, naturalBoost);
  
  return baseScore + finalBoost;
}

async function syncAllPopScores() {
  try {
    await connectDB();
    
    console.log('🔄 開始同步所有圖片的 popScore...\n');
    
    const images = await Image.find({}).lean();
    
    console.log(`📊 找到 ${images.length} 張圖片\n`);
    
    let updatedCount = 0;
    let unchangedCount = 0;
    let significantChanges = [];
    
    for (const image of images) {
      const currentPopScore = image.popScore || 0;
      const correctPopScore = calculatePopScore(image);
      const difference = Math.abs(currentPopScore - correctPopScore);
      
      // 如果差異大於 0.5 分，就更新
      if (difference > 0.5) {
        await Image.updateOne(
          { _id: image._id },
          { $set: { popScore: correctPopScore } }
        );
        
        updatedCount++;
        
        // 記錄顯著變化（差異超過 10 分）
        if (difference > 10) {
          significantChanges.push({
            id: image._id,
            title: image.title || '(無標題)',
            old: currentPopScore.toFixed(1),
            new: correctPopScore.toFixed(1),
            diff: (correctPopScore - currentPopScore).toFixed(1)
          });
        }
      } else {
        unchangedCount++;
      }
    }
    
    console.log(`\n✅ 同步完成！`);
    console.log(`📊 總計: ${images.length} 張`);
    console.log(`🔄 已更新: ${updatedCount} 張`);
    console.log(`✔️  未變化: ${unchangedCount} 張\n`);
    
    if (significantChanges.length > 0) {
      console.log(`⚠️  以下圖片有顯著變化（差異 > 10 分）:\n`);
      
      // 按差異排序
      significantChanges.sort((a, b) => Math.abs(parseFloat(b.diff)) - Math.abs(parseFloat(a.diff)));
      
      significantChanges.slice(0, 10).forEach((change, idx) => {
        console.log(`${idx + 1}. ${change.title}`);
        console.log(`   ${change.old} → ${change.new} (${change.diff > 0 ? '+' : ''}${change.diff})`);
        console.log('');
      });
      
      if (significantChanges.length > 10) {
        console.log(`   ...還有 ${significantChanges.length - 10} 張圖片有顯著變化\n`);
      }
    }
    
    console.log('💡 提示: 現在首頁的排名應該和實時計算一致了\n');
    
  } catch (error) {
    console.error('❌ 同步過程中發生錯誤:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 已斷開數據庫連接');
  }
}

syncAllPopScores();



