"use client";

import { createContext, useContext, useState } from "react";

const FilterContext = createContext();

// ✅ 中文標籤對應英文分級代碼
export const labelToRating = {
  "一般圖片": "all",
  "15+ 圖片": "15",
  "18+ 圖片": "18",
};

export const FilterProvider = ({ children }) => {
  const [levelFilters, setLevelFilters] = useState(["一般圖片", "15+ 圖片"]);
  const [categoryFilters, setCategoryFilters] = useState([]);
  const [viewMode, setViewMode] = useState("default");

  const toggleLevelFilter = (key) => {
    setLevelFilters((prev) =>
      prev.includes(key)
        ? prev.filter((item) => item !== key)
        : [...prev, key]
    );
  };

  const toggleCategoryFilter = (key) => {
    setCategoryFilters((prev) =>
      prev.includes(key)
        ? prev.filter((item) => item !== key)
        : [...prev, key]
    );
  };

  return (
    <FilterContext.Provider
      value={{
        levelFilters,
        toggleLevelFilter,
        categoryFilters,
        toggleCategoryFilter,
        viewMode,
        setViewMode,
      }}
    >
      {children}
    </FilterContext.Provider>
  );
};

export const useFilterContext = () => useContext(FilterContext);
