// utils/scoreMusic.js

/** 計算音樂資料完整度（0~100） */
export function computeMusicCompleteness(music = {}) {
  let score = 0;

  // 模型與連結
  if (hasText(music.modelName)) score += 10;
  if (hasText(music.modelLink)) score += 10;

  // 平台
  if (hasText(music.platform)) score += 10;

  // 提示詞
  if (hasText(music.prompt)) score += 15;

  // 音樂屬性
  if (Array.isArray(music.genre) && music.genre.length > 0) score += 10;
  if (hasText(music.mood)) score += 5;
  if (isNum(music.tempo)) score += 5;
  if (hasText(music.key)) score += 5;

  // 生成參數
  if (hasText(music.seed)) score += 5;
  if (isNum(music.temperature)) score += 3;
  if (isNum(music.topK)) score += 2;
  if (isNum(music.topP)) score += 2;

  // 音頻參數
  if (isNum(music.sampleRate)) score += 3;
  if (isNum(music.bitrate)) score += 2;
  if (hasText(music.format)) score += 3;

  // 分級與分類
  if (hasText(music.rating)) score += 5;
  if (hasText(music.category)) score += 5;

  // 標籤與描述
  if (Array.isArray(music.tags) && music.tags.length >= 3) score += 10;
  if (hasText(music.description)) score += 10;

  return Math.max(0, Math.min(100, score));
}

/** 計算音樂熱門度分數 */
export function computeMusicPopScore(music = {}) {
  const W_LIKE = 8.0;
  const W_PLAY = 1.0; // 播放分與點擊分合併：播放計數 = 1次 = 1分
  const W_COMPLETE = 0.25;

  // clicks 不再計分（因為必須點開才能播放，已包含在 plays 中）
  const likesCount = ensureMusicLikesCount(music);
  const plays = toNum(music.plays, 0);
  const comp = toNum(music.completenessScore, 0);
  const decayedBoost = computeMusicInitialBoostDecay(music);

  return (
    likesCount * W_LIKE +
    plays * W_PLAY +
    comp * W_COMPLETE +
    decayedBoost
  );
}

/** 確保 likesCount */
export function ensureMusicLikesCount(music = {}) {
  if (Array.isArray(music.likes)) return music.likes.length;
  if (typeof music.likesCount === "number") return music.likesCount;
  const n = Number(music.likes || 0);
  return Number.isFinite(n) ? n : 0;
}

/** 計算新音樂加成衰減 */
export function computeMusicInitialBoostDecay(music = {}) {
  const base = toNum(music.initialBoost, 0);
  if (base <= 0) return 0;

  const createdMs = getCreatedMs(music);
  const hours = Math.max(0, (Date.now() - createdMs) / 36e5);
  const WINDOW_HOURS = 10; // 10小時窗口

  if (hours >= WINDOW_HOURS) return 0;

  const factor = Math.max(0, 1 - hours / WINDOW_HOURS);
  const boost = base * factor;

  return Math.round(boost * 10) / 10;
}

/** 從建立時間計算初始加成 */
export function computeMusicInitialBoostFromTop(topScore = 0) {
  const t = toNum(topScore, 0);
  return Math.max(0, Math.floor(t * 0.8)); // 80% of top score
}

// ===== 工具函數 =====

function hasText(s) {
  return typeof s === "string" && s.trim().length > 0;
}

function isNum(n) {
  return typeof n === "number" && Number.isFinite(n);
}

function toNum(v, d) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function getCreatedMs(obj = {}) {
  // 1) uploadDate or createdAt
  if (obj?.uploadDate instanceof Date) return obj.uploadDate.getTime();
  if (obj?.createdAt instanceof Date) return obj.createdAt.getTime();
  if (typeof obj?.createdAt === "number" && Number.isFinite(obj.createdAt))
    return obj.createdAt;
  if (typeof obj?.createdAt === "string") {
    const t = Date.parse(obj.createdAt);
    if (Number.isFinite(t)) return t;
  }
  // 2) ObjectId
  try {
    const id = obj?._id;
    if (id?.getTimestamp) return id.getTimestamp().getTime();
    if (typeof id === "string" && id.length === 24) {
      const { Types } = require("mongoose");
      return new Types.ObjectId(id).getTimestamp().getTime();
    }
  } catch {}
  // 3) fallback
  return Date.now();
}
