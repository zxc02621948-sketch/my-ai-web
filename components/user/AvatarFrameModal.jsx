'use client';

import React, { useState } from "react";
import FrameTierSelector from "./FrameTierSelector";

export default function AvatarFrameModal({ 
  isOpen, 
  onClose, 
  currentFrame, 
  onFrameSelect,
  userPoints = 0 
}) {
  const [showFrameSelector, setShowFrameSelector] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
      <div className="bg-zinc-800 rounded-xl max-w-md w-full mx-4 max-h-[85vh] flex flex-col shadow-2xl">
        {/* 標題 */}
        <div className="flex justify-between items-center p-6 border-b border-zinc-700">
          <h2 className="text-xl font-bold text-white">選擇頭像框</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* 內容區域 */}
        <div className="p-6 overflow-y-auto flex-1 min-h-0">
          <div className="space-y-4">
            {/* 預覽 */}
            <div className="text-center">
              <h3 className="text-white mb-4">預覽效果</h3>
              <div className="flex justify-center">
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                  預覽
                </div>
              </div>
            </div>

            {/* 頭像框選擇 */}
            <div className="space-y-3">
              <h3 className="text-white font-medium">選擇頭像框</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => onFrameSelect("default")}
                  className={`p-3 rounded-lg border-2 transition-colors ${
                    currentFrame === "default"
                      ? "border-blue-500 bg-blue-500/20"
                      : "border-zinc-600 hover:border-zinc-500"
                  }`}
                >
                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-zinc-600"></div>
                    <span className="text-white text-sm">預設</span>
                  </div>
                </button>
                <button
                  onClick={() => setShowFrameSelector(true)}
                  className="p-3 rounded-lg border-2 border-zinc-600 hover:border-purple-500 transition-colors"
                >
                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-lg">
                      ✨
                    </div>
                    <span className="text-white text-sm">更多頭像框</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
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
              onClick={() => {
                onFrameSelect(currentFrame);
                onClose();
              }}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              確認
            </button>
          </div>
        </div>
      </div>

      {/* 顯示頭像框選擇器 */}
      {showFrameSelector && (
        <FrameTierSelector
          isOpen={showFrameSelector}
          onClose={() => setShowFrameSelector(false)}
          currentFrame={currentFrame}
          onFrameSelect={(frameId) => {
            onFrameSelect(frameId);
            setShowFrameSelector(false);
          }}
          userPoints={userPoints}
        />
      )}
    </div>
  );
}
