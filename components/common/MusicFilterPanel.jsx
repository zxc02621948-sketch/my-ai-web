// components/common/MusicFilterPanel.jsx
import { GENRE_MAP, MUSIC_GENRES } from "@/constants/musicCategories";

export default function MusicFilterPanel({
  levelFilters,
  categoryFilters,
  toggleLevelFilter,
  toggleCategoryFilter,
  currentUser,
}) {
  const levelOptions = ["一般音樂", "爭議音樂", "18+ 音樂"];

  const handleLevelClick = (e, label) => {
    e.preventDefault();
    e.stopPropagation();
    if (label === "18+ 音樂" && !currentUser) {
      alert("請先登入才能查看 18+ 音樂");
      return;
    }
    toggleLevelFilter(label);
  };

  return (
    <div className="w-60 space-y-3">
      <div className="font-bold text-sm text-gray-300">內容等級</div>
      <div className="flex gap-2 flex-wrap">
        {levelOptions.map((label) => {
          const isDisabled = label === "18+ 音樂" && !currentUser;
          const isSelected = levelFilters.includes(label);

          return (
            <button
              key={label}
              onClick={(e) => handleLevelClick(e, label)}
              disabled={isDisabled}
              className={`px-3 py-1 rounded text-sm border transition-all
                ${
                  isSelected
                    ? "bg-blue-600 text-white border-blue-600"
                    : isDisabled
                      ? "bg-gray-500 text-gray-300 border-gray-600 cursor-not-allowed opacity-60"
                      : "bg-zinc-700 text-gray-300 border-zinc-600"
                }`}
              title={isDisabled ? "請先登入才能查看 18+ 音樂" : ""}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="font-bold text-sm text-gray-300 pt-2">曲風</div>
      <div className="flex gap-2 flex-wrap">
        {MUSIC_GENRES.map((genre) => (
          <button
            key={genre}
            onClick={() => toggleCategoryFilter(genre)}
            className={`px-3 py-1 rounded text-sm border ${
              categoryFilters.includes(genre)
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-zinc-700 text-gray-300 border-zinc-600"
            }`}
          >
            {GENRE_MAP[genre]}
          </button>
        ))}
      </div>
    </div>
  );
}
