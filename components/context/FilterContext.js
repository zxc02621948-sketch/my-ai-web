"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

const FilterContext = createContext();

// ✅ 中文標籤對應英文分級代碼
export const labelToRating = {
  "一般圖片": "all",
  "15+ 圖片": "15",
  "18+ 圖片": "18",
};

export const FilterProvider = ({ children }) => {
  // 初始值，若 localStorage 有就用它
  const getInitial = (key, fallback) => {
    if (typeof window === "undefined") return fallback;
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };

  const [levelFilters, setLevelFilters] = useState(() => getInitial("levelFilters", ["一般圖片", "15+ 圖片"]));
  const [categoryFilters, setCategoryFilters] = useState(() => getInitial("categoryFilters", []));
  const [viewMode, setViewMode] = useState(() => getInitial("viewMode", "default"));

  const toggleLevelFilter = (key) => {
    setLevelFilters((prev) => {
      const next = prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key];
      localStorage.setItem("levelFilters", JSON.stringify(next));
      return next;
    });
  };

  const toggleCategoryFilter = (key) => {
    setCategoryFilters((prev) => {
      const next = prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key];
      localStorage.setItem("categoryFilters", JSON.stringify(next));
      return next;
    });
  };

  const updateViewMode = (mode) => {
    setViewMode(mode);
    localStorage.setItem("viewMode", JSON.stringify(mode));
  };

  // ✅ 重設所有篩選條件的方法
  const resetFilters = useCallback(() => {
    setLevelFilters(["一般圖片", "15+ 圖片"]);
    setCategoryFilters([]);
    setViewMode("default");
    localStorage.removeItem("levelFilters");
    localStorage.removeItem("categoryFilters");
    localStorage.removeItem("viewMode");
  }, []);

  // ✅ 監聽登出後發送的 reset 事件
  useEffect(() => {
    const handleReset = () => {
      resetFilters();
    };

    window.addEventListener("reset-homepage", handleReset);
    return () => {
      window.removeEventListener("reset-homepage", handleReset);
    };
  }, [resetFilters]);

  return (
    <FilterContext.Provider
      value={{
        levelFilters,
        toggleLevelFilter,
        categoryFilters,
        toggleCategoryFilter,
        viewMode,
        setViewMode: updateViewMode,
        resetFilters,
      }}
    >
      {children}
    </FilterContext.Provider>
  );
};

export const useFilterContext = () => useContext(FilterContext);
