"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

const FRAME_OPTIONS = [
  {
    id: "default",
    name: "預設",
    preview: "/frames/default.svg", // 預設無框
    cost: 0,
    description: "無頭像框"
  },
  {
    id: "cat-ears",
    name: "貓耳",
    preview: "/frames/cat-ears.svg",
    cost: 0,
    description: "可愛的貓耳頭像框"
  },
  {
    id: "flame-ring",
    name: "火焰環",
    preview: "/frames/flame-ring.svg",
    cost: 0,
    description: "燃燒的火焰環頭像框"
  },
  {
    id: "flower-wreath",
    name: "花環",
    preview: "/frames/flower-wreath.svg",
    cost: 0,
    description: "美麗的花環頭像框"
  },
  {
    id: "ai-generated",
    name: "AI 生成",
    preview: "/frames/ai-generated-7899315_1280.png",
    cost: 0,
    description: "AI 生成的藝術頭像框"
  },
  {
    id: "animals",
    name: "動物",
    preview: "/frames/animals-5985896_1280.png",
    cost: 0,
    description: "動物主題頭像框"
  },
  {
    id: "flowers",
    name: "花朵",
    preview: "/frames/flowers-1973874_1280.png",
    cost: 0,
    description: "花朵圖案頭像框"
  },
  {
    id: "leaves",
    name: "葉子",
    preview: "/frames/leaves-6649803_1280.png",
    cost: 0,
    description: "自然葉子頭像框"
  },
  {
    id: "magic-circle",
    name: "魔法陣",
    preview: "/frames/魔法陣1.png",
    cost: 0,
    description: "神秘的魔法陣頭像框"
  },
  {
    id: "military",
    name: "戰損軍事",
    preview: "/frames/avatar-frame-military-01.png",
    cost: 0,
    description: "硬核軍事風格頭像框"
  },
  {
    id: "nature",
    name: "花園自然",
    preview: "/frames/avatar-frame-nature-01.png",
    cost: 0,
    description: "清新自然風格頭像框"
  }
];

export default function AvatarFrameSelector({ 
  isOpen, 
  onClose, 
  currentFrame, 
  onFrameSelect
}) {
  const [selectedFrame, setSelectedFrame] = useState(currentFrame || "default");

  const handleFrameSelect = async (frameId) => {
    onFrameSelect(frameId);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* 標題欄 */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-700">
          <h2 className="text-2xl font-bold text-white">選擇頭像框</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        {/* 內容區域 */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {FRAME_OPTIONS.map((frame) => {
              const isSelected = selectedFrame === frame.id;

              return (
                <div
                  key={frame.id}
                  className={`relative bg-zinc-800 rounded-lg p-4 cursor-pointer transition-all duration-200 ${
                    isSelected 
                      ? "ring-2 ring-blue-500 bg-blue-500/20" 
                      : "hover:bg-zinc-700"
                  }`}
                  onClick={() => setSelectedFrame(frame.id)}
                >
                  {/* 頭像框預覽 */}
                  <div className="relative w-20 h-20 mx-auto mb-3">
                    <div className="w-full h-full rounded-full bg-zinc-600 flex items-center justify-center text-gray-400 text-xs">
                      頭像
                    </div>
                    {frame.id !== "default" && (
                      <div className="absolute inset-0">
                        <Image
                          src={frame.preview}
                          alt={frame.name}
                          width={80}
                          height={80}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    )}
                  </div>

                  {/* 框架信息 */}
                  <div className="text-center">
                    <h3 className="text-sm font-semibold text-white mb-1">{frame.name}</h3>
                    <p className="text-xs text-gray-400 mb-2">{frame.description}</p>
                    <div className="text-xs text-green-400">免費</div>
                  </div>

                  {/* 選中標記 */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 底部按鈕 */}
        <div className="flex items-center justify-between p-6 border-t border-zinc-700">
          <div className="text-sm text-gray-400">
            選擇頭像框來個性化你的頭像
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              取消
            </button>
            <button
              onClick={() => handleFrameSelect(selectedFrame)}
              className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              確認選擇
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
