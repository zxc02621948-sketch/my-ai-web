"use client";

import { getLevelInfo } from "@/utils/pointsLevels";

export default function LevelDisplay({ points = 0, showProgress = true, size = "normal" }) {
  const levelInfo = getLevelInfo(points);
  
  const sizeClasses = {
    small: "text-xs",
    normal: "text-sm",
    large: "text-base"
  };

  const progressBarClasses = {
    small: "h-1",
    normal: "h-2", 
    large: "h-3"
  };

  return (
    <div className="space-y-2">
      {/* 等級信息 */}
      <div className="flex items-center space-x-2">
        <div className={`px-2 py-1 rounded-full text-white font-semibold ${levelInfo.color} ${sizeClasses[size]}`}>
          {levelInfo.rank}
        </div>
        <div className={`text-gray-300 ${sizeClasses[size]}`}>
          {levelInfo.title}
        </div>
      </div>

      {/* 進度條 */}
      {showProgress && !levelInfo.isMax && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-400">
            <span>距離下一等級</span>
            <span>{levelInfo.toNext} 積分</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full overflow-hidden">
            <div 
              className={`bg-gradient-to-r from-yellow-400 to-yellow-500 transition-all duration-300 ${progressBarClasses[size]}`}
              style={{ width: `${levelInfo.progressPct}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 text-center">
            {levelInfo.progressPct}% 完成
          </div>
        </div>
      )}

      {/* 最高等級顯示 */}
      {showProgress && levelInfo.isMax && (
        <div className="text-center">
          <div className="text-xs text-gray-400">已達到最高等級</div>
          <div className="text-xs text-yellow-400">🎉 創界者 🎉</div>
        </div>
      )}
    </div>
  );
}
