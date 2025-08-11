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

// 時間加成：基礎加成 * (衰減率^小時)
// - 新圖的「基礎加成」寫在文件欄位 initialBoost（由上傳當下決定）
// - 舊圖沒有 initialBoost 就當 0（沒有時間加成）
// 可用環境變數調整：NEW 基礎比例 & 衰減率
export const POP_NEW_BASE_RATIO = toNum(process.env.POP_NEW_BASE_RATIO, 0.8); // 新圖起始 = 目前最高分 * 0.8
export const POP_DECAY_RATE = toNum(process.env.POP_DECAY_RATE, 0.9);         // 每小時保留 90% → 衰減 10%

/** 從 ObjectId 或 createdAt 取得建立時間 */
export function getCreatedMs(obj = {}) {
  if (obj?.createdAt) {
    const t = new Date(obj.createdAt).getTime();
    if (Number.isFinite(t)) return t;
  }
  try {
    const id = obj?._id;
    if (id?.getTimestamp) return id.getTimestamp().getTime();
    if (typeof id === "string" && id.length === 24) {
      const { Types } = require("mongoose");
      return new Types.ObjectId(id).getTimestamp().getTime();
    }
  } catch {}
  return Date.now();
}

/** likesCount 保障（有些文件尚未快取 likesCount） */
export function ensureLikesCount(x = {}) {
  if (typeof x.likesCount === "number") return x.likesCount;
  if (Array.isArray(x.likes)) return x.likes.length;
  const n = Number(x.likes || 0);
  return Number.isFinite(n) ? n : 0;
}

/** 時間加成 = (initialBoost || 0) * (POP_DECAY_RATE ^ hours) */
export function computeTimeBoost(x = {}) {
  const base = toNum(x.initialBoost, 0);
  if (base <= 0) return 0;
  const hours = Math.floor((Date.now() - getCreatedMs(x)) / 36e5);
  if (hours <= 0) return base;
  // 避免浮點毛邊，可四捨五入到小數一位
  return Math.round(base * Math.pow(POP_DECAY_RATE, hours) * 10) / 10;
}

/** ✅ Popular 總分公式（只改這裡就好） */
export function computePopScore(x = {}) {
  const clicks = toNum(x.clicks, 0);
  const likesCount = ensureLikesCount(x);
  const comp = toNum(x.completenessScore, 0);
  const timeBoost = computeTimeBoost(x);
  return clicks * POP_W_CLICK + likesCount * POP_W_LIKE + comp * POP_W_COMPLETE + timeBoost;
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
