"use client";

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
      <select
        className="bg-zinc-900 border border-white/10 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
      >
        {OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
