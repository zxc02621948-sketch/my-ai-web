// ===== 內容生命週期管理工具 =====
// 此文件為預留功能，目前不使用
// 當內容數量達到一定規模時再啟用

/**
 * 計算用戶可用的內容釘選槽位數量
 * @param {Object} user - 用戶對象
 * @returns {Number} 總釘選槽位數
 */
export function getTotalPinnedSlots(user) {
  // 基礎槽位（按等級）
  let base = 1;
  if (user.level >= 10) base = 10;
  else if (user.level >= 7) base = 5;
  else if (user.level >= 4) base = 3;
  else if (user.level >= 1) base = 1;
  
  // 購買的額外槽位
  const purchased = user.purchasedPinnedSlots || 0;
  
  // VIP 訂閱加成
  const hasVIP = user.subscriptions?.some(
    sub => sub.isActive && sub.expiresAt > new Date()
  );
  const vipBonus = hasVIP ? 20 : 0;
  
  return base + purchased + vipBonus;
}

/**
 * 計算用戶的影片上傳限制
 * @param {Number} userLevel - 用戶等級
 * @param {Boolean} hasVIP - 是否為 VIP
 * @returns {Number} 上傳限制數量
 */
export function getVideoUploadLimit(userLevel, hasVIP) {
  if (hasVIP) return Infinity; // VIP 無限制
  return userLevel * 10; // 每級 10 部
}

/**
 * 判斷內容是否應該被冷藏（影片）
 * @param {Object} video - 影片對象
 * @returns {Boolean} 是否應該冷藏
 */
export function shouldColdVideo(video) {
  // 保護標記，永不冷藏
  if (video.isPinned) return false;
  if (video.isHighQuality) return false;
  if (video.forceActive) return false;
  
  const now = new Date();
  const uploadAge = now - new Date(video.createdAt);
  const daysSinceUpload = uploadAge / (1000 * 60 * 60 * 24);
  
  // 條件：
  // 1. 上傳超過 90 天
  // 2. 點讚數 < 5
  // 3. 觀看數 < 50
  // 4. 最後互動 > 60 天前
  
  if (daysSinceUpload < 90) return false;
  if ((video.likesCount || 0) >= 5) return false;
  if ((video.viewCount || 0) >= 50) return false;
  
  if (video.lastInteractionAt) {
    const daysSinceInteraction = (now - new Date(video.lastInteractionAt)) / (1000 * 60 * 60 * 24);
    if (daysSinceInteraction < 60) return false;
  }
  
  return true;
}

/**
 * 判斷內容是否應該被冷藏（圖片）
 * @param {Object} image - 圖片對象
 * @returns {Boolean} 是否應該冷藏
 */
export function shouldColdImage(image) {
  // 保護標記，永不冷藏
  if (image.isPinned) return false;
  if (image.isHighQuality) return false;
  if (image.forceActive) return false;
  
  const now = new Date();
  const uploadAge = now - new Date(image.createdAt);
  const daysSinceUpload = uploadAge / (1000 * 60 * 60 * 24);
  
  // 條件：（圖片標準更寬鬆，因為有技術參考價值）
  // 1. 上傳超過 180 天（6個月）
  // 2. 點讚數 < 3
  // 3. 觀看數 < 30
  // 4. 最後互動 > 120 天前
  // 5. 元數據完整度 < 30%
  
  if (daysSinceUpload < 180) return false;
  if ((image.likesCount || 0) >= 3) return false;
  if ((image.viewCount || 0) >= 30) return false;
  if ((image.completenessScore || 0) >= 30) return false; // 有參考價值就保留
  
  if (image.lastInteractionAt) {
    const daysSinceInteraction = (now - new Date(image.lastInteractionAt)) / (1000 * 60 * 60 * 24);
    if (daysSinceInteraction < 120) return false;
  }
  
  return true;
}

/**
 * 判斷內容是否應該被歸檔
 * @param {Object} content - 內容對象
 * @returns {Boolean} 是否應該歸檔
 */
export function shouldArchive(content) {
  // 保護標記，永不歸檔
  if (content.isPinned) return false;
  if (content.isHighQuality) return false;
  if (content.forceActive) return false;
  
  // 必須先是冷藏狀態
  if (content.status !== 'cold') return false;
  
  const now = new Date();
  
  // 條件：
  // 1. 冷藏狀態超過 180 天
  // 2. 冷藏期間零互動
  
  if (!content.coldAt) return false;
  
  const daysSinceCold = (now - new Date(content.coldAt)) / (1000 * 60 * 60 * 24);
  if (daysSinceCold < 180) return false;
  
  // 檢查冷藏期間是否有互動
  if (content.lastInteractionAt) {
    if (new Date(content.lastInteractionAt) > new Date(content.coldAt)) {
      // 冷藏後有互動，不歸檔
      return false;
    }
  }
  
  return true;
}

/**
 * 計算內容的質量評分（用於自動判定 isHighQuality）
 * @param {Object} content - 內容對象
 * @returns {Number} 質量評分 (0-100)
 */
export function calculateQualityScore(content) {
  let score = 0;
  
  // 點讚數權重（最高 40 分）
  const likesScore = Math.min(40, (content.likesCount || 0) / 5);
  score += likesScore;
  
  // 觀看數權重（最高 30 分）
  const viewScore = Math.min(30, (content.viewCount || 0) / 100);
  score += viewScore;
  
  // 元數據完整度權重（最高 20 分，僅圖片）
  if (content.completenessScore !== undefined) {
    score += (content.completenessScore || 0) * 0.2;
  }
  
  // 時間權重（最高 10 分，越新越高）
  const daysSinceUpload = (new Date() - new Date(content.createdAt)) / (1000 * 60 * 60 * 24);
  const ageScore = Math.max(0, 10 - daysSinceUpload / 30); // 每 30 天減 1 分
  score += ageScore;
  
  return Math.round(score);
}

/**
 * 定時任務：掃描並冷藏低互動內容
 * 建議：每天凌晨 2 點執行
 */
export async function runColdStorageTask() {
  // 此函數預留，未來實施時使用
  // 
  // const Image = require('@/models/Image');
  // const Video = require('@/models/Video');
  //
  // // 找出應該冷藏的圖片
  // const imagesToCold = await Image.find({
  //   status: 'active',
  //   createdAt: { $lt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) },
  //   likesCount: { $lt: 3 },
  //   viewCount: { $lt: 30 },
  //   completenessScore: { $lt: 30 },
  //   lastInteractionAt: { $lt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000) },
  //   isPinned: false,
  //   isHighQuality: false,
  //   forceActive: false
  // });
  //
  // // 找出應該冷藏的影片
  // const videosToCold = await Video.find({
  //   status: 'active',
  //   createdAt: { $lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
  //   likesCount: { $lt: 5 },
  //   viewCount: { $lt: 50 },
  //   lastInteractionAt: { $lt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
  //   isPinned: false,
  //   isHighQuality: false,
  //   forceActive: false
  // });
  //
  // // 批次更新狀態
  // await Image.updateMany(
  //   { _id: { $in: imagesToCold.map(i => i._id) } },
  //   { status: 'cold', coldAt: new Date() }
  // );
  //
  // await Video.updateMany(
  //   { _id: { $in: videosToCold.map(v => v._id) } },
  //   { status: 'cold', coldAt: new Date() }
  // );
  
  console.log('冷藏任務執行完成（功能未啟用）');
}

/**
 * 定時任務：掃描並歸檔極低價值內容
 * 建議：每週執行一次
 */
export async function runArchiveTask() {
  // 此函數預留，未來實施時使用
  console.log('歸檔任務執行完成（功能未啟用）');
}

