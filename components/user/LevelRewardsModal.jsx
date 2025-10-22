"use client";

import React, { useState, useEffect } from "react";
import { LEVELS } from "@/utils/pointsLevels";
import { LEVEL_REWARDS } from "@/utils/levelRewards";

export default function LevelRewardsModal({ isOpen, onClose, userPoints = 0, ownedFrames = [] }) {
  const [currentUserLevel, setCurrentUserLevel] = useState(0);

  useEffect(() => {
    if (userPoints !== undefined) {
      // 計算用戶當前等級索引
      let levelIndex = 0;
      for (let i = 0; i < LEVELS.length; i++) {
        if (userPoints >= LEVELS[i].min) {
          levelIndex = i;
        }
      }
      setCurrentUserLevel(levelIndex);
    }
  }, [userPoints]);

  if (!isOpen) return null;

  // 點擊空白處關閉
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[99999]" 
      style={{ padding: '60px 16px 80px 16px' }}
      onClick={handleBackdropClick}
    >
      <div className="bg-zinc-800 rounded-xl max-w-4xl w-full max-h-full overflow-y-auto">
        {/* 標題 */}
        <div className="flex justify-between items-center p-6 border-b border-zinc-700">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <span className="text-3xl">🏆</span>
            等級獎勵系統
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-2xl"
          >
            ✕
          </button>
        </div>

        {/* 內容 */}
        <div className="p-6">
          {/* 當前等級顯示 */}
          <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-xl p-4 mb-6 border border-blue-500/20">
            <div className="text-center">
              <div className="text-lg text-blue-300 mb-2">你的當前等級</div>
              <div className={`inline-block px-4 py-2 rounded-full text-xl font-bold text-white ${LEVELS[currentUserLevel]?.color || 'bg-gray-500'}`}>
                {LEVELS[currentUserLevel]?.rank || 'LV1'}
              </div>
              <div className="text-xl font-semibold text-white mt-2">
                {LEVELS[currentUserLevel]?.title || '啟程者'}
              </div>
              <div className="text-sm text-gray-400 mt-1">
                當前積分: {userPoints}
              </div>
            </div>
          </div>

          {/* 等級獎勵列表 */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-white mb-4">所有等級獎勵</h3>
            
            {/* LV1-LV3 詳細顯示 */}
            {LEVELS.slice(0, 3).map((level, index) => {
              const levelKey = level.key; // 例如 "lv1", "lv2", "lv3"
              const rewards = LEVEL_REWARDS[levelKey];
              const isUnlocked = index <= currentUserLevel;
              const isCurrent = index === currentUserLevel;

              return (
                <div
                  key={level.key}
                  className={`rounded-xl p-4 border transition-all duration-200 ${
                    isUnlocked
                      ? isCurrent
                        ? 'bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border-yellow-500/50 shadow-lg shadow-yellow-500/20'
                        : 'bg-zinc-700/50 border-zinc-600'
                      : 'bg-zinc-800/50 border-zinc-700 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* 等級標識 */}
                      <div className={`px-3 py-2 rounded-full text-white font-bold ${level.color} ${
                        isUnlocked ? '' : 'opacity-50'
                      }`}>
                        {level.rank}
                      </div>
                      
                      {/* 等級信息 */}
                      <div>
                        <div className={`text-lg font-semibold ${isUnlocked ? 'text-white' : 'text-gray-400'}`}>
                          {level.title}
                        </div>
                        <div className="text-sm text-gray-400">
                          需要 {level.min} 積分
                          {isCurrent && <span className="ml-2 text-yellow-400">(當前等級)</span>}
                        </div>
                      </div>
                    </div>

                    {/* 獎勵狀態 */}
                    <div className="text-right">
                      {rewards ? (
                        <div className="space-y-2">
                          {/* 頭像框獎勵 */}
                          {rewards.frames && rewards.frames.length > 0 && (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-300">頭像框:</span>
                              <div className="flex gap-1">
                                {rewards.frames.map(frameId => (
                                  <div
                                    key={frameId}
                                    className={`px-2 py-1 rounded text-xs ${
                                      ownedFrames.includes(frameId)
                                        ? 'bg-green-600 text-white'
                                        : isUnlocked
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-600 text-gray-300'
                                    }`}
                                  >
                                    {frameId === 'leaves' ? '🍃 葉子' : 
                                     frameId === 'military' ? '⚔️ 戰損軍事' :
                                     frameId === 'nature' ? '🌿 花園自然' :
                                     frameId === 'premium-gold' ? '👑 金色' :
                                     frameId === 'beta-tester' ? '🧪 Beta' :
                                     frameId === 'founder-crown' ? '👑 皇冠' :
                                     frameId}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* 功能獎勵 */}
                          {rewards.features && rewards.features.length > 0 && (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-300">功能:</span>
                              <div className="flex gap-1 flex-wrap">
                                {rewards.features.map(feature => (
                                  <div
                                    key={feature}
                                    className="px-2 py-1 rounded text-xs bg-purple-600 text-white"
                                  >
                                    {feature === 'music-player' ? '🎵 播放器' : 
                                     feature === 'frame-color-editor' ? '🎨 頭像框調色盤' :
                                     feature === 'pinned-player-trial' ? '📌 釘選播放器 30天' :
                                     feature === 'pinned-player-permanent' ? '📌 永久釘選' :
                                     feature === 'advanced-frames' ? '🎨 高級編輯' :
                                     feature === 'priority-support' ? '⚡ 優先客服' :
                                     feature === 'exclusive-frames' ? '💎 獨家框' :
                                     feature === 'advanced-analytics' ? '📊 數據分析' :
                                     feature === 'early-access' ? '🚀 優先體驗' :
                                     feature === 'beta-tester' ? '🧪 Beta測試' :
                                     feature === 'founder-status' ? '👑 創始人' :
                                     feature}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* 積分獎勵 */}
                          {rewards.points && (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-300">積分:</span>
                              <span className="px-2 py-1 rounded text-xs bg-yellow-600 text-white">
                                +{rewards.points}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">
                          {isUnlocked ? '已解鎖 - 無特殊獎勵' : '未解鎖'}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 基本權益（從 LEVELS.rewards 顯示） */}
                  {level.rewards && level.rewards.length > 0 && (
                    <div className="mt-3 p-3 bg-blue-900/20 rounded-lg border border-blue-500/20">
                      <div className="text-xs text-blue-300 mb-2 font-semibold">📋 基本權益</div>
                      <ul className="space-y-1">
                        {level.rewards.map((reward, idx) => (
                          <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                            <span className="text-blue-400">•</span>
                            <span>{reward}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 獎勵描述 */}
                  {rewards?.description && (
                    <div className="mt-3 p-3 bg-zinc-700/30 rounded-lg">
                      <div className="text-sm text-gray-300">{rewards.description}</div>
                    </div>
                  )}
                </div>
              );
            })}
            
            {/* LV4-LV10 詳細顯示（與 LV1-LV3 保持一致） */}
            {LEVELS.slice(3).map((level, index) => {
              const actualIndex = index + 3;
              const levelKey = level.key;
              const rewards = LEVEL_REWARDS[levelKey];
              const isUnlocked = actualIndex <= currentUserLevel;
              const isCurrent = actualIndex === currentUserLevel;

              return (
                <div
                  key={level.key}
                  className={`rounded-xl p-4 border transition-all duration-200 ${
                    isUnlocked
                      ? isCurrent
                        ? 'bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border-yellow-500/50 shadow-lg shadow-yellow-500/20'
                        : 'bg-zinc-700/50 border-zinc-600'
                      : 'bg-zinc-800/50 border-zinc-700 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* 等級標識 */}
                      <div className={`px-3 py-2 rounded-full text-white font-bold ${level.color} ${
                        isUnlocked ? '' : 'opacity-50'
                      }`}>
                        {level.rank}
                      </div>
                      
                      {/* 等級信息 */}
                      <div>
                        <div className={`text-lg font-semibold ${isUnlocked ? 'text-white' : 'text-gray-400'}`}>
                          {level.title}
                        </div>
                        <div className="text-sm text-gray-400">
                          需要 {level.min} 積分
                          {isCurrent && <span className="ml-2 text-yellow-400">(當前等級)</span>}
                        </div>
                      </div>
                    </div>

                    {/* 獎勵狀態 */}
                    <div className="text-right">
                      {rewards ? (
                        <div className="space-y-2">
                          {/* 頭像框獎勵 */}
                          {rewards.frames && rewards.frames.length > 0 && (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-300">頭像框:</span>
                              <div className="flex gap-1">
                                {rewards.frames.map(frameId => (
                                  <div
                                    key={frameId}
                                    className={`px-2 py-1 rounded text-xs ${
                                      ownedFrames.includes(frameId)
                                        ? 'bg-green-600 text-white'
                                        : isUnlocked
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-600 text-gray-300'
                                    }`}
                                  >
                                    {frameId === 'leaves' ? '🍃 葉子' : 
                                     frameId === 'military' ? '⚔️ 戰損軍事' :
                                     frameId === 'nature' ? '🌿 花園自然' :
                                     frameId === 'premium-gold' ? '👑 金色' :
                                     frameId === 'beta-tester' ? '🧪 Beta' :
                                     frameId === 'founder-crown' ? '👑 皇冠' :
                                     frameId}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* 功能獎勵 */}
                          {rewards.features && rewards.features.length > 0 && (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-300">功能:</span>
                              <div className="flex gap-1 flex-wrap">
                                {rewards.features.map(feature => (
                                  <div
                                    key={feature}
                                    className="px-2 py-1 rounded text-xs bg-purple-600 text-white"
                                  >
                                    {feature === 'music-player' ? '🎵 播放器' : 
                                     feature === 'frame-color-editor' ? '🎨 頭像框調色盤' :
                                     feature === 'pinned-player-trial' ? '📌 釘選播放器 30天' :
                                     feature === 'pinned-player-permanent' ? '📌 永久釘選' :
                                     feature === 'advanced-frames' ? '🎨 高級編輯' :
                                     feature === 'priority-support' ? '⚡ 優先客服' :
                                     feature === 'exclusive-frames' ? '💎 獨家框' :
                                     feature === 'advanced-analytics' ? '📊 數據分析' :
                                     feature === 'early-access' ? '🚀 優先體驗' :
                                     feature === 'beta-tester' ? '🧪 Beta測試' :
                                     feature === 'founder-status' ? '👑 創始人' :
                                     feature}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* 積分獎勵 */}
                          {rewards.points && (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-300">積分:</span>
                              <span className="px-2 py-1 rounded text-xs bg-yellow-600 text-white">
                                +{rewards.points}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">
                          {isUnlocked ? '已解鎖 - 無特殊獎勵' : '未解鎖'}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 基本權益（從 LEVELS.rewards 顯示） */}
                  {level.rewards && level.rewards.length > 0 && (
                    <div className="mt-3 p-3 bg-blue-900/20 rounded-lg border border-blue-500/20">
                      <div className="text-xs text-blue-300 mb-2 font-semibold">📋 基本權益</div>
                      <ul className="space-y-1">
                        {level.rewards.map((reward, idx) => (
                          <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                            <span className="text-blue-400">•</span>
                            <span>{reward}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 獎勵描述 */}
                  {rewards?.description && (
                    <div className="mt-3 p-3 bg-zinc-700/30 rounded-lg">
                      <div className="text-sm text-gray-300">{rewards.description}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 提示信息 */}
          <div className="mt-6 p-4 bg-blue-900/20 rounded-xl border border-blue-500/30">
            <div className="flex items-start gap-3">
              <span className="text-2xl">💡</span>
              <div className="text-sm text-blue-200">
                <div className="font-semibold mb-2">如何獲得積分？</div>
                <ul className="space-y-1 text-blue-300">
                  <li>• 上傳 AI 生成圖片（包含完整元數據）</li>
                  <li>• 獲得其他用戶的讚和留言</li>
                  <li>• 每日登入</li>
                  <li>• 完成特定任務和成就</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* 底部按鈕 */}
        <div className="flex justify-end p-6 border-t border-zinc-700">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
}
