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
  if (hasText(img.seed)) score += 5; // seed 用字串也算

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
