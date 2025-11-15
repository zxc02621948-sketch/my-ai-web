// components/common/FilterPanel.jsx
import CATEGORIES from "@/constants/categories";
import { notify } from "@/components/common/GlobalNotificationManager";

export default function FilterPanel({
  levelFilters,
  categoryFilters,
  viewMode,
  toggleLevelFilter,
  toggleCategoryFilter,
  setViewMode,
  currentUser,
}) {
  const levelOptions = ["一般圖片", "15+ 圖片", "18+ 圖片"];

  const handleLevelClick = (label) => {
    if (label === "18+ 圖片" && !currentUser) {
      notify.warning("提示", "請先登入才能查看 18+ 圖片");
      return;
    }
    toggleLevelFilter(label);
  };

  return (
    <div className="w-60 space-y-3">
      <div className="font-bold text-sm text-gray-300">內容等級</div>
      <div className="flex gap-2 flex-wrap">
        {levelOptions.map((label) => {
          const isDisabled = label === "18+ 圖片" && !currentUser;
          const isSelected = levelFilters.includes(label);

          return (
            <button
              key={label}
              onClick={() => handleLevelClick(label)}
              disabled={isDisabled}
              className={`px-3 py-1 rounded text-sm border transition-all
                ${
                  isSelected
                    ? "bg-blue-600 text-white border-blue-600"
                    : isDisabled
                    ? "bg-gray-500 text-gray-300 border-gray-600 cursor-not-allowed opacity-60"
                    : "bg-zinc-700 text-gray-300 border-zinc-600"
                }`}
              title={isDisabled ? "請先登入才能查看 18+ 圖片" : ""}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="font-bold text-sm text-gray-300 pt-2">分類</div>
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => toggleCategoryFilter(cat)}
            className={`px-3 py-1 rounded text-sm border ${
              categoryFilters.includes(cat)
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-zinc-700 text-gray-300 border-zinc-600"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="font-bold text-sm text-gray-300 pt-2">顯示模式</div>
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setViewMode("default")}
          className={`px-3 py-1 rounded text-sm border ${
            viewMode === "default"
              ? "bg-green-600 text-white border-green-600"
              : "bg-zinc-700 text-gray-300 border-zinc-600"
          }`}
        >
          常駐標題
        </button>
        <button
          onClick={() => setViewMode("compact")}
          className={`px-3 py-1 rounded text-sm border ${
            viewMode === "compact"
              ? "bg-green-600 text-white border-green-600"
              : "bg-zinc-700 text-gray-300 border-zinc-600"
          }`}
        >
          hover 顯示
        </button>
      </div>
    </div>
  );
}
