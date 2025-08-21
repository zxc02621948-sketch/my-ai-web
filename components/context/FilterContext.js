"use client";

import { createContext, useContext, useState, useMemo, useCallback, useEffect } from "react";

/** 前端按鈕顯示用 → 後端查詢值 */
export const labelToRating = {
  "一般圖片": "sfw",
  "15+ 圖片": "15",
  "18+ 圖片": "18",
};

/** 後端值 → 前端顯示用（有需要時可用） */
export const ratingToLabel = {
  sfw: "一般圖片",
  "15": "15+ 圖片",
  "18": "18+ 圖片",
};

const VALID_LEVEL_LABELS = Object.keys(labelToRating);

const FilterContext = createContext(null);

/** 預設：一開始就勾選「一般圖片、15+ 圖片」 */
const DEFAULT_LEVEL_FILTERS = ["一般圖片", "15+ 圖片"];
const DEFAULT_CATEGORY_FILTERS = [];
const DEFAULT_VIEW_MODE = "default"; // or "compact"

/** 安全讀取 localStorage */
function safeParse(json, fallback) {
  try {
    const v = JSON.parse(json);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}
function uniqKeepOrder(arr) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    if (!seen.has(x)) {
      seen.add(x);
      out.push(x);
    }
  }
  return out;
}

export function FilterProvider({ children }) {
  // 先給預設，mount 後再從 localStorage 覆蓋
  const [levelFilters, setLevelFilters] = useState(DEFAULT_LEVEL_FILTERS);
  const [categoryFilters, setCategoryFilters] = useState(DEFAULT_CATEGORY_FILTERS);
  const [viewMode, setViewMode] = useState(DEFAULT_VIEW_MODE);

  // Mount 後復原上次狀態
  useEffect(() => {
    const lv = safeParse(localStorage.getItem("levelFilters"), DEFAULT_LEVEL_FILTERS)
      .filter((l) => VALID_LEVEL_LABELS.includes(l));
    const ct = safeParse(localStorage.getItem("categoryFilters"), DEFAULT_CATEGORY_FILTERS)
      .filter((c) => typeof c === "string" && c.trim().length > 0);
    const vm = localStorage.getItem("viewMode") || DEFAULT_VIEW_MODE;

    setLevelFilters(lv.length ? lv : DEFAULT_LEVEL_FILTERS);
    setCategoryFilters(ct);
    setViewMode(vm === "default" || vm === "compact" ? vm : DEFAULT_VIEW_MODE);
  }, []);

  // 變更時持久化
  useEffect(() => {
    localStorage.setItem("levelFilters", JSON.stringify(levelFilters));
  }, [levelFilters]);
  useEffect(() => {
    localStorage.setItem("categoryFilters", JSON.stringify(categoryFilters));
  }, [categoryFilters]);
  useEffect(() => {
    localStorage.setItem("viewMode", viewMode);
  }, [viewMode]);

  /** 分級：至少保留一個等級 */
  const toggleLevelFilter = useCallback((label) => {
    if (!VALID_LEVEL_LABELS.includes(label)) return;

    setLevelFilters((prev) => {
      const exists = prev.includes(label);
      if (exists) {
        // 移除時若會變成 0 個，則不變動（保護）
        const next = prev.filter((l) => l !== label);
        return next.length ? next : prev;
      }
      // 加入時去重並維持順序（用 VALID_LEVEL_LABELS 排序）
      const combined = uniqKeepOrder([...prev, label]);
      const ordered = VALID_LEVEL_LABELS.filter((l) => combined.includes(l));
      return ordered.length ? ordered : DEFAULT_LEVEL_FILTERS;
    });
  }, []);

  /** 分類：一般切換 */
  const toggleCategoryFilter = useCallback((key) => {
    setCategoryFilters((prev) => {
      const exists = prev.includes(key);
      const next = exists ? prev.filter((item) => item !== key) : [...prev, key];
      return next;
    });
  }, []);

  /** 重設為預設狀態 */
  const resetFilters = useCallback(() => {
    setLevelFilters(DEFAULT_LEVEL_FILTERS);
    setCategoryFilters(DEFAULT_CATEGORY_FILTERS);
    setViewMode(DEFAULT_VIEW_MODE);
  }, []);

  const value = useMemo(
    () => ({
      levelFilters,
      categoryFilters,
      viewMode,
      setViewMode,
      toggleLevelFilter,
      toggleCategoryFilter,
      resetFilters,
    }),
    [levelFilters, categoryFilters, viewMode, toggleLevelFilter, toggleCategoryFilter, resetFilters]
  );

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export function useFilterContext() {
  const ctx = useContext(FilterContext);
  if (!ctx) {
    throw new Error("useFilterContext must be used inside <FilterProvider>");
  }
  return ctx;
}
