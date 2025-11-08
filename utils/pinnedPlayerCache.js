"use client";

const PINNED_CACHE_KEY = "app_pinned_player_cache";

export const readPinnedPlayerCache = () => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(PINNED_CACHE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const writePinnedPlayerCache = (data) => {
  if (typeof window === "undefined") {
    return;
  }
  if (!data) {
    clearPinnedPlayerCache();
    return;
  }
  try {
    sessionStorage.setItem(PINNED_CACHE_KEY, JSON.stringify(data));
  } catch {}
};

export const clearPinnedPlayerCache = () => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    sessionStorage.removeItem(PINNED_CACHE_KEY);
  } catch {}
};

export const withPinnedSignature = (pinned, signature) => {
  if (!pinned) {
    return pinned;
  }
  return { ...pinned, signature };
};


