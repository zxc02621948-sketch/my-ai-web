// lib/loraUtils.js
/** 將字串切成清單：支援換行、逗號、頓號 */
export const splitList = (s) =>
  String(s || "")
    .split(/\r?\n|,|、|，/g)
    .map(x => x.trim())
    .filter(Boolean);

/** 僅接受 civitai 網域 */
export const isCivitaiUrl = (u) => {
  try {
    const { hostname } = new URL(u);
    return /(^|\.)civitai\.com$/i.test(hostname);
  } catch {
    return false;
  }
};

/**
 * 由 loraRefs 或 (loraName, loraLink) 建立渲染用清單
 * 輸出格式：[{ name: string, url?: string }]
 * 規則：
 * 1) 優先使用 loraRefs（hash 查表結果最準）
 * 2) 否則用 loraName/loraLink（可多筆；以順序對應）
 * 3) 連結數量不足時，自動以純文字項補上
 */
export function buildLoraItems({ loraRefs = [], loraName = "", loraLink = "" }) {
  if (Array.isArray(loraRefs) && loraRefs.length) {
    return loraRefs.map(r => ({
      name: r?.name || r?.modelId || "LoRA",
      url:  r?.versionLink || r?.modelLink || null,
    }));
  }
  const names = splitList(loraName);
  const links = splitList(loraLink).map(u => (isCivitaiUrl(u) ? u : null));
  return names.map((name, i) => ({ name, url: links[i] || null }));
}
