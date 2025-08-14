// utils/score.js

/** 計算圖片資料完整度（0~100） */
export function computeCompleteness(img = {}) {
  let score = 0;

  // 模型 & 連結
  if (hasText(img.modelName)) score += 20;
  if (isCivitaiUrl(img.modelLink)) score += 10;

  // LoRA
  if (hasText(img.loraName)) score += 5;
  if (isCivitaiUrl(img.loraLink)) score += 5;

  // 提示詞
  if (hasText(img.positivePrompt)) score += 5;
  if (hasText(img.negativePrompt)) score += 5;

  // 生成參數
  if (hasText(img.sampler)) score += 5;
  if (isNum(img.steps)) score += 5;
  if (isNum(img.cfgScale)) score += 5;
  if (isNum(img.clipSkip)) score += 5;
  if (hasText(img.seed)) score += 5;

  // 圖片尺寸
  if (isNum(img.width) && isNum(img.height)) score += 10;

  // 分級 / 分類
  if (hasText(img.rating)) score += 5;
  if (hasText(img.category)) score += 5;

  // 標籤與描述
  if (Array.isArray(img.tags) && img.tags.length >= 3) score += 5;
  if (hasText(img.description)) score += 5;

  return Math.max(0, Math.min(100, score));
}

// ===== Popular 分數（集中管理 & 可配置）=====

const toNum = (v, d) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

// 互動權重（可用環境變數覆寫）
export const POP_W_CLICK = toNum(process.env.POP_W_CLICK, 1.0);
export const POP_W_LIKE = toNum(process.env.POP_W_LIKE, 8.0);
export const POP_W_COMPLETE = toNum(process.env.POP_W_COMPLETE, 0.05);

// 🆕 新圖種子（建立新圖時計算並寫入 image.initialBoost）
export const POP_NEW_BASE_RATIO = toNum(process.env.POP_NEW_BASE_RATIO, 0.8); // 初始加乘 = 當前最高分 * 0.8
export const POP_NEW_WINDOW_HOURS = toNum(process.env.POP_NEW_WINDOW_HOURS, 10); // 僅在前 10 小時內有效（線性遞減到 0）

/** likesCount 保障 */
export function ensureLikesCount(x = {}) {
  if (typeof x.likesCount === "number") return x.likesCount;
  if (Array.isArray(x.likes)) return x.likes.length;
  const n = Number(x.likes || 0);
  return Number.isFinite(n) ? n : 0;
}

/** 從 ObjectId 或 createdAt 取得建立時間（毫秒） */
export function getCreatedMs(obj = {}) {
  // 1) createdAt
  if (obj?.createdAt instanceof Date) return obj.createdAt.getTime();
  if (typeof obj?.createdAt === "number" && Number.isFinite(obj.createdAt)) return obj.createdAt;
  if (typeof obj?.createdAt === "string") {
    const t = Date.parse(obj.createdAt);
    if (Number.isFinite(t)) return t;
  }
  // 2) ObjectId 推回時間
  try {
    const id = obj?._id;
    if (id?.getTimestamp) return id.getTimestamp().getTime();
    if (typeof id === "string" && id.length === 24) {
      const { Types } = require("mongoose");
      return new Types.ObjectId(id).getTimestamp().getTime();
    }
  } catch {}
  // 3) fallback：現在
  return Date.now();
}

/** 建立新圖時用：從當前最高分計算初始 seed（固定寫進 image.initialBoost） */
export function computeInitialBoostFromTop(topScore = 0) {
  const t = toNum(topScore, 0);
  return Math.max(0, Math.floor(t * POP_NEW_BASE_RATIO));
}

/**
 * 🆕 新圖加乘的「線性遞減」：
 * - 只有新圖（有 initialBoost > 0）會吃到
 * - 係數 = max(0, 1 - 經過小時 / POP_NEW_WINDOW_HOURS)
 * - 超過時間窗即為 0
 */
export function computeInitialBoostDecay(x = {}) {
  const base = toNum(x.initialBoost, 0);
  if (base <= 0) return 0; // 不是新圖（或沒種子）就沒有加乘

  const createdMs = getCreatedMs(x);
  const hours = Math.max(0, (Date.now() - createdMs) / 36e5);

  if (hours >= POP_NEW_WINDOW_HOURS) return 0;

  const factor = Math.max(0, 1 - hours / POP_NEW_WINDOW_HOURS);
  const boost = base * factor;

  // 保留 1 位小數，避免排序抖動（可依需求調整）
  return Math.round(boost * 10) / 10;
}

/** ✅ Popular 總分公式（只有新圖在 10 小時內有加乘且隨時間遞減） */
export function computePopScore(x = {}) {
  const clicks = toNum(x.clicks, 0);
  const likesCount = ensureLikesCount(x);
  const comp = toNum(x.completenessScore, 0);
  const decayedBoost = computeInitialBoostDecay(x);
  return clicks * POP_W_CLICK + likesCount * POP_W_LIKE + comp * POP_W_COMPLETE + decayedBoost;
}

// ===== 小工具 =====
function hasText(s) {
  return typeof s === "string" && s.trim().length > 0;
}
function isNum(n) {
  return typeof n === "number" && Number.isFinite(n);
}
function isCivitaiUrl(u) {
  if (!hasText(u)) return false;
  try {
    const url = new URL(u);
    return /(^|\.)civitai\.com$/i.test(url.hostname);
  } catch {
    return false;
  }
}
