// scripts/fix-expired-power-boost.js
// 修復已過期權力券的錯誤加成

const mongoose = require('mongoose');

// 連接數據庫
async function connectDB() {
  try {
    // 從環境變量或直接使用連接字串
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/my-ai-web';
    await mongoose.connect(uri);
    console.log('✅ 已連接到數據庫');
  } catch (error) {
    console.error('❌ 數據庫連接失敗:', error);
    process.exit(1);
  }
}

// 定義 Image Schema
const imageSchema = new mongoose.Schema({
  clicks: { type: Number, default: 0 },
  likesCount: { type: Number, default: 0 },
  completenessScore: { type: Number, default: 0 },
  initialBoost: { type: Number, default: 0 },
  popScore: { type: Number, default: 0 },
  powerUsed: { type: Boolean, default: false },
  powerUsedAt: { type: Date },
  powerExpiry: { type: Date },
  powerType: { type: String },
  createdAt: { type: Date },
}, { strict: false });

const Image = mongoose.models.Image || mongoose.model('Image', imageSchema);

// 計算正確的 popScore（不含權力券加成）
function calculateBasePopScore(image) {
  const POP_W_CLICK = 1.0;
  const POP_W_LIKE = 8.0;
  const POP_W_COMPLETE = 0.05;
  
  const clicks = image.clicks || 0;
  const likesCount = image.likesCount || 0;
  const completenessScore = image.completenessScore || 0;
  
  return clicks * POP_W_CLICK + likesCount * POP_W_LIKE + completenessScore * POP_W_COMPLETE;
}

// 計算新圖自然衰減加成
function calculateNaturalBoost(image) {
  const POP_NEW_WINDOW_HOURS = 10;
  const now = Date.now();
  const createdAt = new Date(image.createdAt).getTime();
  const hoursElapsed = (now - createdAt) / (1000 * 60 * 60);
  
  if (hoursElapsed >= POP_NEW_WINDOW_HOURS) {
    return 0; // 超過 10 小時，自然加成為 0
  }
  
  const boostFactor = Math.max(0, 1 - (hoursElapsed / POP_NEW_WINDOW_HOURS));
  const initialBoost = image.initialBoost || 0;
  
  return Math.round(initialBoost * boostFactor);
}

async function fixExpiredPowerBoost() {
  try {
    await connectDB();
    
    console.log('\n🔍 開始掃描已過期的權力券圖片...\n');
    
    const now = new Date();
    
    // 找出所有使用過權力券且已過期的圖片
    const expiredPowerImages = await Image.find({
      powerUsed: true,
      powerExpiry: { $lt: now }
    }).lean();
    
    console.log(`📊 找到 ${expiredPowerImages.length} 張已過期權力券的圖片\n`);
    
    if (expiredPowerImages.length === 0) {
      console.log('✅ 沒有需要修復的圖片');
      process.exit(0);
    }
    
    let fixedCount = 0;
    
    for (const image of expiredPowerImages) {
      const baseScore = calculateBasePopScore(image);
      const naturalBoost = calculateNaturalBoost(image);
      const correctPopScore = baseScore + naturalBoost;
      const currentPopScore = image.popScore || 0;
      const difference = currentPopScore - correctPopScore;
      
      if (Math.abs(difference) > 0.1) { // 允許小誤差
        console.log(`🔧 修復圖片: ${image._id}`);
        console.log(`   標題: ${image.title || '(無標題)'}`);
        console.log(`   當前 popScore: ${currentPopScore.toFixed(1)}`);
        console.log(`   正確 popScore: ${correctPopScore.toFixed(1)}`);
        console.log(`   差異: ${difference.toFixed(1)} (錯誤的權力券加成)`);
        console.log(`   權力券過期時間: ${image.powerExpiry}`);
        console.log('');
        
        // 更新圖片的 popScore
        await Image.updateOne(
          { _id: image._id },
          { $set: { popScore: correctPopScore } }
        );
        
        fixedCount++;
      }
    }
    
    console.log(`\n✅ 修復完成！共修復 ${fixedCount} 張圖片`);
    console.log(`📊 掃描: ${expiredPowerImages.length} 張，修復: ${fixedCount} 張\n`);
    
  } catch (error) {
    console.error('❌ 修復過程中發生錯誤:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 已斷開數據庫連接');
  }
}

// 執行修復
fixExpiredPowerBoost();

