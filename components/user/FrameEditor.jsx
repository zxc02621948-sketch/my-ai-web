"use client";

import { useState, useEffect } from "react";
import { sanitizeHexColor, sanitizeFrameSize } from "@/lib/sanitizeFrameSettings";

export default function FrameEditor({ frame, onClose, onConfirm }) {
  const [colors, setColors] = useState(
    (Array.isArray(frame.defaultColors) ? frame.defaultColors : ["#3B82F6", "#8B5CF6", "#EC4899"])
      .slice(0, 3)
      .map((c, idx) => sanitizeHexColor(c, ["#3B82F6", "#8B5CF6", "#EC4899"][idx]))
  );
  const [style, setStyle] = useState(frame.defaultStyle || "geometric");
  const [size, setSize] = useState(sanitizeFrameSize(100));
  const [previewSvg, setPreviewSvg] = useState("");

  // 生成 SVG 預覽
  const generatePreview = () => {
    const safeColors = colors.map((c, idx) =>
      sanitizeHexColor(c, ["#3B82F6", "#8B5CF6", "#EC4899"][idx] || "#3B82F6")
    );
    const safeSize = sanitizeFrameSize(size);
    let svgContent = "";
    
    switch (style) {
      case "geometric":
        svgContent = generateGeometricFrame(safeColors, safeSize);
        break;
      case "floral":
        svgContent = generateFloralFrame(safeColors, safeSize);
        break;
      case "abstract":
        svgContent = generateAbstractFrame(safeColors, safeSize);
        break;
      default:
        svgContent = generateGeometricFrame(safeColors, safeSize);
    }
    
    setPreviewSvg(svgContent);
  };

  // 幾何圖形頭像框生成器
  const generateGeometricFrame = (colors, size) => {
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- 外層圓環 -->
        <circle cx="50" cy="50" r="45" stroke="${colors[0]}" stroke-width="3" fill="none"/>
        
        <!-- 內層裝飾 -->
        <circle cx="50" cy="50" r="35" stroke="${colors[1]}" stroke-width="2" fill="none" opacity="0.7"/>
        
        <!-- 四個角落的幾何圖案 -->
        <g opacity="0.8">
          <polygon points="15,15 25,15 20,25" fill="${colors[2]}"/>
          <polygon points="85,15 75,15 80,25" fill="${colors[2]}"/>
          <polygon points="15,85 25,85 20,75" fill="${colors[2]}"/>
          <polygon points="85,85 75,85 80,75" fill="${colors[2]}"/>
        </g>
        
        <!-- 中心裝飾 -->
        <circle cx="50" cy="50" r="5" fill="${colors[1]}" opacity="0.6"/>
      </svg>
    `;
  };

  // 花卉圖案頭像框生成器
  const generateFloralFrame = (colors, size) => {
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- 花瓣 -->
        <g opacity="0.8">
          <ellipse cx="50" cy="25" rx="8" ry="15" fill="${colors[0]}" transform="rotate(0 50 25)"/>
          <ellipse cx="75" cy="50" rx="8" ry="15" fill="${colors[1]}" transform="rotate(90 75 50)"/>
          <ellipse cx="50" cy="75" rx="8" ry="15" fill="${colors[2]}" transform="rotate(180 50 75)"/>
          <ellipse cx="25" cy="50" rx="8" ry="15" fill="${colors[0]}" transform="rotate(270 25 50)"/>
        </g>
        
        <!-- 花心 -->
        <circle cx="50" cy="50" r="12" fill="${colors[1]}" opacity="0.9"/>
        
        <!-- 外環 -->
        <circle cx="50" cy="50" r="40" stroke="${colors[2]}" stroke-width="2" fill="none"/>
      </svg>
    `;
  };

  // 抽象藝術頭像框生成器
  const generateAbstractFrame = (colors, size) => {
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- 抽象線條 -->
        <path d="M10 50 Q30 20 50 50 Q70 80 90 50" stroke="${colors[0]}" stroke-width="3" fill="none"/>
        <path d="M50 10 Q80 30 50 50 Q20 70 50 90" stroke="${colors[1]}" stroke-width="3" fill="none"/>
        
        <!-- 裝飾圓圈 -->
        <circle cx="25" cy="25" r="8" fill="${colors[2]}" opacity="0.6"/>
        <circle cx="75" cy="25" r="6" fill="${colors[0]}" opacity="0.8"/>
        <circle cx="25" cy="75" r="6" fill="${colors[1]}" opacity="0.8"/>
        <circle cx="75" cy="75" r="8" fill="${colors[2]}" opacity="0.6"/>
        
        <!-- 中心點 -->
        <circle cx="50" cy="50" r="3" fill="${colors[1]}"/>
      </svg>
    `;
  };

  // 顏色預設選項
  const colorPresets = [
    ["#3B82F6", "#8B5CF6", "#EC4899"], // 藍紫粉
    ["#10B981", "#F59E0B", "#EF4444"], // 綠橙紅
    ["#6366F1", "#F97316", "#EC4899"], // 紫橙粉
    ["#06B6D4", "#8B5CF6", "#F59E0B"], // 青紫橙
    ["#EF4444", "#F97316", "#F59E0B"], // 紅橙黃
  ];

  useEffect(() => {
    generatePreview();
  }, [colors, style, size]);

  const handleColorChange = (index, newColor) => {
    const newColors = [...colors];
    newColors[index] = sanitizeHexColor(newColor, newColors[index] || "#3B82F6");
    setColors(newColors);
  };

  const handleConfirm = () => {
    const editedFrameData = {
      ...frame,
      customColors: colors.map((c, idx) =>
        sanitizeHexColor(c, ["#3B82F6", "#8B5CF6", "#EC4899"][idx] || "#3B82F6")
      ),
      customStyle: style,
      customSize: sanitizeFrameSize(size),
      svgContent: previewSvg
    };
    onConfirm(editedFrameData);
  };

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 bg-black/70 flex items-center justify-center z-[99999]" style={{ padding: '60px 16px 80px 16px' }}>
      <div className="bg-zinc-800 rounded-xl p-6 max-w-2xl w-full max-h-full overflow-y-auto">
        {/* 標題 */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white">編輯頭像框</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* 預覽區域 */}
        <div className="bg-zinc-700 rounded-lg p-6 mb-6 text-center">
          <h4 className="text-white mb-4">預覽</h4>
          <div className="flex justify-center">
            <div 
              className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg"
              dangerouslySetInnerHTML={{ __html: previewSvg }}
            />
          </div>
        </div>

        {/* 編輯選項 */}
        <div className="space-y-6">
          {/* 樣式選擇 */}
          <div>
            <label className="block text-white font-medium mb-3">樣式</label>
            <div className="flex gap-2">
              {[
                { id: "geometric", name: "幾何" },
                { id: "floral", name: "花卉" },
                { id: "abstract", name: "抽象" }
              ].map((styleOption) => (
                <button
                  key={styleOption.id}
                  onClick={() => setStyle(styleOption.id)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    style === styleOption.id
                      ? "bg-purple-600 text-white"
                      : "bg-zinc-700 text-gray-300 hover:bg-zinc-600"
                  }`}
                >
                  {styleOption.name}
                </button>
              ))}
            </div>
          </div>

          {/* 顏色編輯 */}
          <div>
            <label className="block text-white font-medium mb-3">顏色</label>
            <div className="grid grid-cols-3 gap-4">
              {colors.map((color, index) => (
                <div key={index}>
                  <label className="block text-gray-300 text-sm mb-1">
                    顏色 {index + 1}
                  </label>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => handleColorChange(index, e.target.value)}
                    className="w-full h-10 rounded-lg border-2 border-zinc-600 cursor-pointer"
                  />
                </div>
              ))}
            </div>
            
            {/* 顏色預設 */}
            <div className="mt-4">
              <label className="block text-gray-300 text-sm mb-2">顏色預設</label>
              <div className="flex gap-2 flex-wrap">
                {colorPresets.map((preset, index) => (
                  <button
                    key={index}
                    onClick={() => setColors([...preset])}
                    className="flex gap-1 p-2 rounded-lg border-2 border-zinc-600 hover:border-purple-500 transition-colors"
                  >
                    {preset.map((color, colorIndex) => (
                      <div
                        key={colorIndex}
                        className="w-6 h-6 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 大小調整 */}
          <div>
            <label className="block text-white font-medium mb-3">
              大小: {size}px
            </label>
            <input
              type="range"
              min="80"
              max="120"
              value={size}
              onChange={(e) => setSize(sanitizeFrameSize(e.target.value))}
              className="w-full h-2 bg-zinc-600 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>
        </div>

        {/* 操作按鈕 */}
        <div className="flex gap-3 mt-8">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            確認並應用
          </button>
        </div>
      </div>
    </div>
  );
}
