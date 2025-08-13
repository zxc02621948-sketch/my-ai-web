// /lib/likeSync.js
function getWin() { return typeof window !== "undefined" ? window : null; }

export function updateLikeCacheAndBroadcast(updatedImage) {
  const w = getWin();
  if (!w || !updatedImage || !updatedImage._id) return;
  if (!w.__likeCache) w.__likeCache = new Map();
  const likesArr = Array.isArray(updatedImage.likes) ? updatedImage.likes : [];
  w.__likeCache.set(String(updatedImage._id), [...likesArr]);
  w.dispatchEvent(new CustomEvent("image-liked", { detail: { ...updatedImage } }));
}

export function getLikesFromCache(imageId) {
  const w = getWin();
  if (!w || !w.__likeCache) return null;
  const arr = w.__likeCache.get(String(imageId));
  return Array.isArray(arr) ? arr : null;
}
