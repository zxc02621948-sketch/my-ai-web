"use client";

import dynamic from "next/dynamic";
import { useState, useEffect } from "react";

const OPTIONS = [
  { label: "默認：熱門度（加權）", value: "popular" },
  { label: "由新到舊", value: "newest" },
  { label: "由舊到新", value: "oldest" },
  { label: "最多愛心", value: "mostLikes" },
  { label: "隨機", value: "random" },
  { label: "混排（前幾張最新 + 隨機）", value: "hybrid" },
];

// ✅ 占位符組件
const SelectFieldPlaceholder = ({ value = "popular" }) => {
  const selectedOption = OPTIONS.find((opt) => opt.value === value) ?? null;
  return (
    <div className="relative min-w-[180px] sm:min-w-[220px]">
      <div className="flex w-full items-center justify-between gap-2 rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-left text-sm">
        <span className={`truncate ${selectedOption ? "text-white" : "text-zinc-400"}`}>
          {selectedOption ? selectedOption.label : "請選擇排序"}
        </span>
        <svg
          aria-hidden="true"
          className="h-4 w-4 text-zinc-400"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 10.204l3.71-2.973a.75.75 0 111.04 1.081l-4.25 3.404a.75.75 0 01-.96 0l-4.25-3.404a.75.75 0 01-1.05-1.104z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    </div>
  );
};

// ✅ 動態導入 SelectField，完全禁用 SSR 以避免 Hydration 錯誤
const SelectField = dynamic(() => import("@/components/common/SelectField"), {
  ssr: false,
});

export default function SortSelect({ value = "popular", onChange }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="inline-flex items-center gap-2 flex-shrink-0">
      <span className="text-sm text-zinc-400 whitespace-nowrap">排序：</span>
      {mounted ? (
        <SelectField
          value={value}
          onChange={onChange}
          options={OPTIONS}
          placeholder="請選擇排序"
          className="min-w-[180px] sm:min-w-[220px]"
          buttonClassName="bg-zinc-900 border border-white/10 text-sm"
        />
      ) : (
        <SelectFieldPlaceholder value={value} />
      )}
    </div>
  );
}
