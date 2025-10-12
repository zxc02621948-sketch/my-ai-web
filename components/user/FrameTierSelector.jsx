"use client";

import { useState } from "react";
import Image from "next/image";
import FrameEditor from "./FrameEditor";

// 低階頭像框（PNG - 不可編輯）
const BASIC_FRAMES = [
  {
    id: "ai-generated",
    name: "AI 生成",
    preview: "/frames/ai-generated-7899315_1280.png",
    description: "AI 生成的藝術頭像框",
    tier: "basic",
    cost: 0
  },
  {
    id: "animals",
    name: "動物",
    preview: "/frames/animals-5985896_1280.png", 
    description: "動物主題頭像框",
    tier: "basic",
    cost: 0
  },
  {
    id: "leaves",
    name: "葉子",
    preview: "/frames/leaves-6649803_1280.png",
    description: "自然葉子頭像框",
    tier: "basic", 
    cost: 0
  },
  {
    id: "magic-circle",
    name: "魔法陣",
    preview: "/frames/魔法陣1.png",
    description: "神秘的魔法陣頭像框",
    tier: "basic",
    cost: 0
  },
  {
    id: "magic-circle-2",
    name: "魔法陣2",
    preview: "/frames/魔法陣2.png",
    description: "進階版魔法陣頭像框",
    tier: "basic",
    cost: 0
  }
];

// 高階頭像框（SVG - 可編輯）
const PREMIUM_FRAMES = [
  {
    id: "circleflowerframe",
    name: "圓形花卉",
    preview: "/frames/circleflowerframe.svg",
    description: "可自定義的圓形花卉頭像框",
    tier: "premium",
    cost: 0,
    editable: true,
    defaultColors: ["#3B82F6", "#8B5CF6", "#EC4899"],
    defaultStyle: "floral"
  },
  {
    id: "flame-ring",
    name: "火焰環",
    preview: "/frames/flame-ring.svg", 
    description: "可自定義的火焰環頭像框",
    tier: "premium",
    cost: 0,
    editable: true,
    defaultColors: ["#F97316", "#EF4444", "#F59E0B"],
    defaultStyle: "geometric"
  },
  {
    id: "flower-wreath",
    name: "花環",
    preview: "/frames/flower-wreath.svg",
    description: "可自定義的花環頭像框", 
    tier: "premium",
    cost: 0,
    editable: true,
    defaultColors: ["#10B981", "#F59E0B", "#EC4899"],
    defaultStyle: "floral"
  }
];

export default function FrameTierSelector({ 
  isOpen, 
  onClose, 
  currentFrame, 
  onFrameSelect, 
  userPoints = 0 
}) {
  const [selectedTier, setSelectedTier] = useState("basic");
  const [selectedFrame, setSelectedFrame] = useState(currentFrame || "default");
  const [editingFrame, setEditingFrame] = useState(null);

  const handleFrameSelect = (frame) => {
    if (frame.tier === "premium" && frame.editable) {
      // 高階可編輯頭像框，打開編輯器
      setEditingFrame(frame);
    } else {
      // 低階頭像框，直接選擇
      setSelectedFrame(frame.id);
      onFrameSelect(frame.id);
    }
  };

  const handleEditConfirm = (editedFrameData) => {
    // 這裡會處理編輯後的頭像框數據
    console.log("編輯後的頭像框數據:", editedFrameData);
    setEditingFrame(null);
    // 保存編輯結果並應用
  };

  if (!isOpen) return null;

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 bg-black/50 flex items-center justify-center z-[99999]" style={{ padding: '60px 16px 80px 16px' }}>
      <div className="bg-zinc-800 rounded-xl p-6 max-w-4xl w-full max-h-full overflow-y-auto">
        {/* 標題 */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">頭像框商店</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* 分層選擇器 */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setSelectedTier("basic")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedTier === "basic"
                ? "bg-blue-600 text-white"
                : "bg-zinc-700 text-gray-300 hover:bg-zinc-600"
            }`}
          >
            低階頭像框 (PNG)
          </button>
          <button
            onClick={() => setSelectedTier("premium")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedTier === "premium"
                ? "bg-purple-600 text-white"
                : "bg-zinc-700 text-gray-300 hover:bg-zinc-600"
            }`}
          >
            高階頭像框 (SVG) ✨
          </button>
        </div>

        {/* 用戶積分顯示 */}
        <div className="bg-zinc-700 rounded-lg p-3 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-gray-300">你的積分</span>
            <span className="text-yellow-400 font-bold text-lg">{userPoints}</span>
          </div>
        </div>

        {/* 頭像框列表 */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {(selectedTier === "basic" ? BASIC_FRAMES : PREMIUM_FRAMES).map((frame) => {
            const canAfford = userPoints >= frame.cost;
            const isSelected = selectedFrame === frame.id;
            
            return (
              <div
                key={frame.id}
                className={`relative bg-zinc-700 rounded-lg p-4 cursor-pointer transition-all ${
                  isSelected ? "ring-2 ring-blue-500" : "hover:bg-zinc-600"
                } ${!canAfford ? "opacity-50" : ""}`}
                onClick={() => canAfford && handleFrameSelect(frame)}
              >
                {/* 頭像框預覽 */}
                <div className="aspect-square mb-3 relative">
                  <Image
                    src={frame.preview}
                    alt={frame.name}
                    fill
                    className="object-contain rounded-lg"
                  />
                  {/* 階層標識 */}
                  <div className={`absolute top-1 right-1 px-2 py-1 rounded text-xs font-medium ${
                    frame.tier === "basic" 
                      ? "bg-blue-600 text-white" 
                      : "bg-purple-600 text-white"
                  }`}>
                    {frame.tier === "basic" ? "基礎" : "高階"}
                  </div>
                  {/* 可編輯標識 */}
                  {frame.editable && (
                    <div className="absolute top-1 left-1 px-2 py-1 rounded text-xs font-medium bg-green-600 text-white">
                      可編輯
                    </div>
                  )}
                </div>

                {/* 頭像框信息 */}
                <h3 className="text-white font-medium mb-1">{frame.name}</h3>
                <p className="text-gray-400 text-sm mb-2">{frame.description}</p>
                
                {/* 價格 */}
                <div className="flex justify-between items-center">
                  <span className="text-yellow-400 font-bold">
                    {frame.cost === 0 ? "免費" : `${frame.cost} 積分`}
                  </span>
                  {!canAfford && frame.cost > 0 && (
                    <span className="text-red-400 text-xs">積分不足</span>
                  )}
                </div>

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

        {/* 說明文字 */}
        <div className="mt-6 p-4 bg-zinc-700 rounded-lg">
          <h4 className="text-white font-medium mb-2">階層說明</h4>
          <div className="space-y-2 text-sm text-gray-300">
            <div>
              <span className="text-blue-400 font-medium">低階頭像框：</span>
              預設設計，直接使用，無法修改樣式
            </div>
            <div>
              <span className="text-purple-400 font-medium">高階頭像框：</span>
              可自由編輯顏色、樣式、大小，創造獨特設計
            </div>
          </div>
        </div>
      </div>

      {/* 編輯器模態框 */}
      {editingFrame && (
        <FrameEditor
          frame={editingFrame}
          onClose={() => setEditingFrame(null)}
          onConfirm={handleEditConfirm}
        />
      )}
    </div>
  );
}
