"use client";

import { getLevelInfo, LEVELS } from "@/utils/pointsLevels";
import LevelLeaderboard from "@/components/user/LevelLeaderboard";
import { useCurrentUser } from "@/contexts/CurrentUserContext";

export default function LevelsPage() {
  const { currentUser } = useCurrentUser(); // 使用 Context

  const currentPoints = currentUser?.pointsBalance || 0;
  const currentLevel = getLevelInfo(currentPoints);

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* 頁面標題 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">等級系統</h1>
          <p className="text-gray-400 text-lg">通過創作和互動獲得積分，提升你的等級！</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 當前等級 */}
          <div className="lg:col-span-2">
            <div className="bg-zinc-800/50 rounded-xl p-6 mb-6">
              <h2 className="text-2xl font-bold mb-4">我的等級</h2>
              
              {loading ? (
                <div className="animate-pulse">
                  <div className="h-32 bg-zinc-700 rounded-lg"></div>
                </div>
              ) : (
                <div className="text-center">
                  <div className={`inline-block px-6 py-3 rounded-full text-2xl font-bold text-white mb-4 ${currentLevel.color}`}>
                    {currentLevel.rank}
                  </div>
                  <h3 className="text-3xl font-bold mb-2">{currentLevel.title}</h3>
                  <p className="text-gray-400 mb-4">當前積分: {currentPoints}</p>
                  
                  {!currentLevel.isMax && (
                    <div className="space-y-2">
                      <div className="text-sm text-gray-400">
                        距離下一等級還需要 {currentLevel.toNext} 積分
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-yellow-400 to-yellow-500 h-full transition-all duration-500"
                          style={{ width: `${currentLevel.progressPct}%` }}
                        />
                      </div>
                      <div className="text-sm text-gray-400">
                        {currentLevel.progressPct}% 完成
                      </div>
                    </div>
                  )}
                  
                  {currentLevel.isMax && (
                    <div className="text-yellow-400 text-lg">
                      🎉 恭喜！你已達到最高等級！🎉
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 所有等級列表 */}
            <div className="bg-zinc-800/50 rounded-xl p-6">
              <h2 className="text-2xl font-bold mb-6">所有等級</h2>
              <div className="space-y-4">
                {LEVELS.map((level, index) => {
                  const isCurrentLevel = level.key === currentLevel.key;
                  const isUnlocked = currentPoints >= level.min;
                  
                  return (
                    <div 
                      key={level.key}
                      className={`p-4 rounded-lg border transition-all duration-200 ${
                        isCurrentLevel 
                          ? "bg-gradient-to-r from-yellow-500/20 to-yellow-400/20 border-yellow-500/50" 
                          : isUnlocked
                          ? "bg-zinc-700/50 border-zinc-600/50"
                          : "bg-zinc-800/30 border-zinc-700/30 opacity-60"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${level.color}`}>
                            {level.rank}
                          </div>
                          <div>
                            <h3 className="text-xl font-semibold">{level.title}</h3>
                            <p className="text-gray-400">需要 {level.min} 積分</p>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          {isCurrentLevel && (
                            <span className="text-yellow-400 font-semibold">當前等級</span>
                          )}
                          {!isCurrentLevel && isUnlocked && (
                            <span className="text-green-400 font-semibold">已解鎖</span>
                          )}
                          {!isCurrentLevel && !isUnlocked && (
                            <span className="text-gray-500">未解鎖</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 排行榜 */}
          <div className="lg:col-span-1">
            <LevelLeaderboard limit={10} />
          </div>
        </div>

        {/* 積分獲得方式 */}
        <div className="mt-8 bg-zinc-800/50 rounded-xl p-6">
          <h2 className="text-2xl font-bold mb-6">如何獲得積分</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-zinc-700/50 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-2 text-yellow-400">上傳作品</h3>
              <p className="text-gray-400 text-sm mb-2">每次上傳作品可獲得積分</p>
              <p className="text-yellow-300 font-semibold">+5 積分</p>
              <p className="text-xs text-gray-500 mt-1">每日上限 20 積分</p>
            </div>
            
            <div className="bg-zinc-700/50 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-2 text-pink-400">獲得愛心</h3>
              <p className="text-gray-400 text-sm mb-2">你的作品被其他人按讚</p>
              <p className="text-pink-300 font-semibold">+1 積分</p>
              <p className="text-xs text-gray-500 mt-1">每日上限 10 積分</p>
            </div>
            
            <div className="bg-zinc-700/50 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-2 text-red-400">給予愛心</h3>
              <p className="text-gray-400 text-sm mb-2">為其他作品按讚</p>
              <p className="text-red-300 font-semibold">+1 積分</p>
              <p className="text-xs text-gray-500 mt-1">每日上限 5 積分</p>
            </div>
            
            <div className="bg-zinc-700/50 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-2 text-green-400">獲得留言</h3>
              <p className="text-gray-400 text-sm mb-2">你的作品收到留言</p>
              <p className="text-green-300 font-semibold">+1 積分</p>
              <p className="text-xs text-gray-500 mt-1">每日上限 5 積分</p>
            </div>
            
            <div className="bg-zinc-700/50 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-2 text-blue-400">每日登入</h3>
              <p className="text-gray-400 text-sm mb-2">每天登入網站</p>
              <p className="text-blue-300 font-semibold">+5 積分</p>
              <p className="text-xs text-gray-500 mt-1">每日一次</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
