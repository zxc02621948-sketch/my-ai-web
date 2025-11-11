"use client";

import SelectField from "@/components/common/SelectField";

const OPTIONS = [
  { label: "默認：熱門度（加權）", value: "popular" },
  { label: "由新到舊", value: "newest" },
  { label: "由舊到新", value: "oldest" },
  { label: "最多愛心", value: "mostLikes" },
  { label: "隨機", value: "random" },
  { label: "混排（前幾張最新 + 隨機）", value: "hybrid" },
];

export default function SortSelect({ value = "popular", onChange }) {
  return (
    <div className="inline-flex items-center gap-2">
      <span className="text-sm text-zinc-400">排序：</span>
      <SelectField
        value={value}
        onChange={onChange}
        options={OPTIONS}
        placeholder="請選擇排序"
        className="min-w-[220px]"
        buttonClassName="bg-zinc-900 border border-white/10 text-sm"
      />
    </div>
  );
}
