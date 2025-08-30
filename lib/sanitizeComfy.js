// /lib/sanitizeComfy.js

// 接受更廣的真值：true/1/"1"/"true"/"yes"/"on"/"public"
export function coerceTruth(val) {
  if (typeof val === "boolean") return val;
  if (typeof val === "number") return val !== 0;
  if (typeof val === "string") {
    const s = val.trim().toLowerCase();
    return s === "true" || s === "1" || s === "yes" || s === "on" || s === "public";
  }
  return false;
}

/**
 * 從圖片物件中找出「公開 workflow/prompt」的旗標
 * 盡量相容舊欄位與不同命名
 */
export function getAllowShareFlag(img) {
  const comfy = img?.comfy || {};
  const raw = img?.raw || {};

  // 主要來源與常見別名
  const candidates = [
    comfy.allowShare,
    img.allowComfyShare,
    comfy.isPublic,
    comfy.public,
    comfy.share,
    comfy.sharePublic,
    raw.comfyAllowShare,
  ];

  // 只要任何一個被判為真，就視為公開
  return candidates.some(coerceTruth);
}

/**
 * 只有 isOwnerOrAdmin 或 allowShare（公開）才保留 Comfy JSON；否則移除
 * 支援 Mongoose Document 或 Plain Object
 */
export function stripComfyIfNotAllowed(imgDoc, { isOwnerOrAdmin }) {
  const img =
    typeof imgDoc?.toObject === "function"
      ? imgDoc.toObject()
      : JSON.parse(JSON.stringify(imgDoc || {}));

  const allowShare = getAllowShareFlag(img);

  if (!(isOwnerOrAdmin || allowShare)) {
    if (img.comfy) {
      delete img.comfy.workflowJSON;
      delete img.comfy.promptJSON;
      delete img.comfy.promptRaw;
      delete img.comfy.workflowRaw;
    }
    if (img.raw) {
      delete img.raw.comfyWorkflowJson;
    }
  }
  return img;
}
