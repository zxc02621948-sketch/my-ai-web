// utils/scoreVideo.js

/** 計算影片資料完整度（0~100） */
export function computeVideoCompleteness(video = {}) {
  let score = 0;

  // 模型與連結
  if (hasText(video.modelName)) score += 10;
  if (hasText(video.modelLink)) score += 10;

  // 平台
  if (hasText(video.platform)) score += 10;

  // 提示詞
  if (hasText(video.prompt)) score += 10;
  if (hasText(video.negativePrompt)) score += 5;

  // 生成參數
  if (isNum(video.fps)) score += 5;
  if (hasText(video.resolution)) score += 5;
  if (isNum(video.steps)) score += 5;
  if (isNum(video.cfgScale)) score += 5;
  if (hasText(video.seed)) score += 5;

  // 分級與分類
  if (hasText(video.rating)) score += 5;
  if (hasText(video.category)) score += 5;

  // 標籤與描述
  if (Array.isArray(video.tags) && video.tags.length >= 3) score += 10;
  if (hasText(video.description)) score += 10;

  return Math.max(0, Math.min(100, score));
}

/** 計算影片熱門度分數 */
export function computeVideoPopScore(video = {}) {
  const W_CLICK = 1.0;
  const W_LIKE = 8.0;
  const W_VIEW = 0.5;
  const W_COMPLETE = 0.05;

  const clicks = toNum(video.clicks, 0);
  const likesCount = ensureVideoLikesCount(video);
  const views = toNum(video.views, 0);
  const comp = toNum(video.completenessScore, 0);
  const decayedBoost = computeVideoInitialBoostDecay(video);

  return clicks * W_CLICK + likesCount * W_LIKE + views * W_VIEW + comp * W_COMPLETE + decayedBoost;
}

/** 確保 likesCount */
export function ensureVideoLikesCount(video = {}) {
  if (Array.isArray(video.likes)) return video.likes.length;
  if (typeof video.likesCount === 'number') return video.likesCount;
  const n = Number(video.likes || 0);
  return Number.isFinite(n) ? n : 0;
}

/** 計算新影片加成衰減 */
export function computeVideoInitialBoostDecay(video = {}) {
  const base = toNum(video.initialBoost, 0);
  if (base <= 0) return 0;

  const createdMs = getCreatedMs(video);
  const hours = Math.max(0, (Date.now() - createdMs) / 36e5);
  const WINDOW_HOURS = 10; // 10小時窗口

  if (hours >= WINDOW_HOURS) return 0;

  const factor = Math.max(0, 1 - hours / WINDOW_HOURS);
  const boost = base * factor;

  return Math.round(boost * 10) / 10;
}

/** 從建立時間計算初始加成 */
export function computeVideoInitialBoostFromTop(topScore = 0) {
  const t = toNum(topScore, 0);
  return Math.max(0, Math.floor(t * 0.8)); // 80% of top score
}

// ===== 工具函數 =====

function hasText(s) {
  return typeof s === 'string' && s.trim().length > 0;
}

function isNum(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

function toNum(v, d) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function getCreatedMs(obj = {}) {
  // 1) uploadDate or createdAt
  if (obj?.uploadDate instanceof Date) return obj.uploadDate.getTime();
  if (obj?.createdAt instanceof Date) return obj.createdAt.getTime();
  if (typeof obj?.createdAt === 'number' && Number.isFinite(obj.createdAt)) return obj.createdAt;
  if (typeof obj?.createdAt === 'string') {
    const t = Date.parse(obj.createdAt);
    if (Number.isFinite(t)) return t;
  }
  // 2) ObjectId
  try {
    const id = obj?._id;
    if (id?.getTimestamp) return id.getTimestamp().getTime();
    if (typeof id === 'string' && id.length === 24) {
      const { Types } = require('mongoose');
      return new Types.ObjectId(id).getTimestamp().getTime();
    }
  } catch {}
  // 3) fallback
  return Date.now();
}



