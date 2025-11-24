'use client';

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import axios from "axios";

export default function OwnedFrameSelector({ 
  isOpen, 
  onClose, 
  currentFrame, 
  onFrameSelect 
}) {
  const [ownedFrames, setOwnedFrames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFrame, setSelectedFrame] = useState(currentFrame || "default");

  // 獲取用戶擁有的頭像框
  useEffect(() => {
    if (isOpen) {
      fetchOwnedFrames();
    }
  }, [isOpen]);

  const fetchOwnedFrames = async () => {
    try {
      setLoading(true);
      const response = await axios.get("/api/user/owned-frames");
      if (response.data.success) {
        const ownedFrames = response.data.data || [];
        // 過濾掉免費頭像框（如 leaves），它們應該只在免費頭像框選擇器中顯示
        const freeFrames = ["leaves", "military", "nature"]; // 免費頭像框列表
        const filteredFrames = ownedFrames.filter(frameId => !freeFrames.includes(frameId));
        // 確保 default 頭像框總是包含在內
        if (!filteredFrames.includes("default")) {
          filteredFrames.unshift("default");
        }
        setOwnedFrames(filteredFrames);
      }
    } catch (error) {
      console.error("獲取擁有的頭像框失敗:", error);
      // 靜默失敗，因為這不是關鍵操作，用戶可以稍後重試
    } finally {
      setLoading(false);
    }
  };

  const handleFrameSelect = (frameId) => {
    setSelectedFrame(frameId);
  };

  const handleConfirm = () => {
    onFrameSelect(selectedFrame);
    onClose();
  };

  // 頭像框信息映射（不包含免費頭像框，如 leaves）
  const frameInfoMap = {
    "default": {
      name: "預設",
      preview: "/frames/default.svg",
      description: "無頭像框"
    },
    "ai-generated": {
      name: "AI 生成",
      preview: "/frames/ai-generated-7899315_1280.png",
      description: "AI 生成風格頭像框"
    },
    "animals": {
      name: "動物",
      preview: "/frames/animals-5985896_1280.png",
      description: "可愛動物頭像框"
    },
  "magic-circle": {
    name: "魔法陣",
    preview: "/frames/魔法陣1.png",
    description: "神秘的魔法陣頭像框"
  }
  };

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed top-0 left-0 right-0 bottom-0 bg-black/50 flex items-center justify-center z-[99999]" style={{ padding: '60px 16px 80px 16px' }}>
      <div className="bg-zinc-800 rounded-xl max-w-2xl w-full max-h-full overflow-y-auto">
        {/* 標題 */}
        <div className="flex justify-between items-center p-6 border-b border-zinc-700">
          <h2 className="text-xl font-bold text-white">我的頭像框</h2>
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
            <div className="text-center py-8">
              <div className="text-gray-400">載入中...</div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {ownedFrames.map((frameId) => {
                const frameInfo = frameInfoMap[frameId];
                if (!frameInfo) return null;
                
                const isSelected = selectedFrame === frameId;
                
                return (
                  <div
                    key={frameId}
                    className={`relative bg-zinc-700 rounded-lg p-4 cursor-pointer transition-all ${
                      isSelected ? "ring-2 ring-blue-500" : "hover:bg-zinc-600"
                    }`}
                    onClick={() => handleFrameSelect(frameId)}
                  >
                    {/* 頭像框預覽 */}
                    <div className="aspect-square mb-3 relative">
                      <Image
                        src={frameInfo.preview}
                        alt={frameInfo.name}
                        fill
                        sizes="(max-width: 768px) 50vw, 25vw"
                        className="object-contain rounded-lg"
                      />
                      {/* 已擁有標識 */}
                      <div className="absolute top-1 right-1">
                        <div className="px-2 py-1 rounded text-xs font-medium bg-blue-600 text-white">
                          已擁有
                        </div>
                      </div>
                    </div>

                    {/* 頭像框信息 */}
                    <h3 className="text-white font-medium mb-1">{frameInfo.name}</h3>
                    <p className="text-gray-400 text-sm">{frameInfo.description}</p>

                    {/* 已選中標識 */}
                    {isSelected && (
                      <div className="absolute top-2 left-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm">✓</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
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
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              確認選擇
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}