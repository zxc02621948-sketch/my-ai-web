'use client';

import { useState, useEffect } from "react";
import Image from "next/image";
import axios from "axios";
import { getLevelInfo } from "@/utils/pointsLevels";

// 免費頭像框（包含等級獎勵和成就獎勵）
const FREE_FRAMES = [
  {
    id: "default",
    name: "預設",
    preview: "/frames/default.svg",
    description: "無頭像框",
    unlockType: "default" // 無條件
  },
  {
    id: "leaves",
    name: "葉子",
    preview: "/frames/leaves-6649803_1280.png",
    description: "自然葉子頭像框",
    unlockType: "level", // 等級解鎖
    levelRequired: 1, // LV2（索引從 0 開始，所以 LV2 = 索引 1）
    unlockDescription: "達到 LV2 探索者",
    minPoints: 150 // LV2 的積分門檻
  }
  // 未來可添加更多免費頭像框
  // 例如：成就解鎖（上傳 100 張圖、獲得 1000 讚等）
];

export default function FreeFrameSelector({ 
  isOpen, 
  onClose, 
  currentFrame, 
  onFrameSelect,
  userAvatar = null
}) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedFrame, setSelectedFrame] = useState(currentFrame || "default");

  // 獲取當前用戶信息
  useEffect(() => {
    if (isOpen) {
      fetchCurrentUser();
    }
  }, [isOpen]);

  const fetchCurrentUser = async () => {
    try {
      setLoading(true);
      const response = await axios.get("/api/current-user");
      const user = response.data.user;
      setCurrentUser(user);
    } catch (error) {
      console.error("獲取用戶信息失敗:", error);
    } finally {
      setLoading(false);
    }
  };

  // 檢查頭像框是否已解鎖
  const isFrameUnlocked = (frame) => {
    if (frame.unlockType === "default") {
      return true; // 預設頭像框，所有人都有
    }
    
    // 檢查用戶是否已擁有（最優先）
    const ownedFrames = currentUser?.ownedFrames || [];
    if (ownedFrames.includes(frame.id)) {
      return true; // 已經擁有了
    }
    
    if (frame.unlockType === "level") {
      // 檢查等級
      const userPoints = currentUser?.pointsBalance || 0;
      const userLevelIndex = getLevelInfo(userPoints).index;
      return userLevelIndex >= frame.levelRequired;
    }
    
    // 未來可添加其他解鎖類型（成就等）
    return false;
  };

  const handleFrameSelect = (frame) => {
    if (!isFrameUnlocked(frame)) {
      return; // 未解鎖，不能選擇
    }
    setSelectedFrame(frame.id);
  };

  const handleConfirm = () => {
    const frame = FREE_FRAMES.find(f => f.id === selectedFrame);
    if (frame && isFrameUnlocked(frame)) {
      onFrameSelect(selectedFrame);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 bg-black/50 flex items-center justify-center z-[99999]" style={{ padding: '60px 16px 80px 16px' }}>
      <div className="bg-zinc-800 rounded-xl max-w-2xl w-full max-h-full overflow-y-auto">
        {/* 標題 */}
        <div className="flex justify-between items-center p-6 border-b border-zinc-700">
          <h2 className="text-xl font-bold text-white">免費頭像框</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* 頭像框列表 */}
        <div className="p-6">
          {loading ? (
            <div className="text-center text-gray-400 py-8">載入中...</div>
          ) : (
            <>
              <div className="mb-4 p-4 bg-green-900/20 border border-green-700/50 rounded-lg">
                <p className="text-green-300 text-sm">
                  💡 這些頭像框完全免費！只需達到等級或完成成就即可解鎖
                </p>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {FREE_FRAMES.map((frame) => {
                  const unlocked = isFrameUnlocked(frame);
                  const isSelected = selectedFrame === frame.id;
                  const userPoints = currentUser?.pointsBalance || 0;
                  const userLevel = getLevelInfo(userPoints);
                  
                  return (
                    <div
                      key={frame.id}
                      className={`relative bg-zinc-700 rounded-lg p-4 transition-all ${
                        unlocked 
                          ? `cursor-pointer ${isSelected ? "ring-2 ring-green-500" : "hover:bg-zinc-600"}` 
                          : "opacity-60 cursor-not-allowed"
                      }`}
                      onClick={() => unlocked && handleFrameSelect(frame)}
                    >
                      {/* 頭像框預覽 */}
                      <div className="aspect-square mb-3 relative">
                        <Image
                          src={frame.preview}
                          alt={frame.name}
                          fill
                          sizes="(max-width: 768px) 50vw, 33vw"
                          className={`object-contain rounded-lg ${!unlocked ? "grayscale" : ""}`}
                        />
                        
                        {/* 狀態標識 */}
                        <div className="absolute top-1 right-1">
                          {unlocked ? (
                            <div className="px-2 py-1 rounded text-xs font-medium bg-green-600 text-white">
                              ✅ 已解鎖
                            </div>
                          ) : (
                            <div className="px-2 py-1 rounded text-xs font-medium bg-red-600 text-white">
                              🔒 未解鎖
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 頭像框信息 */}
                      <h3 className="text-white font-medium mb-1">{frame.name}</h3>
                      <p className="text-gray-400 text-xs mb-2">{frame.description}</p>

                      {/* 解鎖條件 */}
                      {!unlocked && frame.unlockType === "level" && (
                        <div className="mt-2 p-2 bg-zinc-800 rounded text-xs">
                          <div className="text-yellow-400 font-medium mb-1">
                            🎁 {frame.unlockDescription}
                          </div>
                          <div className="text-gray-400">
                            當前：{userLevel.rank} {userLevel.title}
                          </div>
                          <div className="text-gray-400">
                            進度：{userPoints}/{frame.minPoints} 
                            (還需 {Math.max(0, frame.minPoints - userPoints)})
                          </div>
                        </div>
                      )}
                      
                      {/* 已解鎖可使用 */}
                      {unlocked && isSelected && (
                        <div className="mt-2 text-xs text-green-400">
                          ✓ 已選擇
                        </div>
                      )}

                      {/* 已選中標識 */}
                      {unlocked && isSelected && (
                        <div className="absolute top-2 left-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm">✓</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* 底部按鈕 */}
        <div className="p-6 border-t border-zinc-700">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              disabled={!FREE_FRAMES.find(f => f.id === selectedFrame) || !isFrameUnlocked(FREE_FRAMES.find(f => f.id === selectedFrame))}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              確認選擇
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}