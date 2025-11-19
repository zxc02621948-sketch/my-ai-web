'use client';

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import AvatarFrame from "@/components/common/AvatarFrame";
import axios from "axios";

export default function FrameColorEditor({
  isOpen,
  onClose,
  frameId,
  userAvatar,
  onSave,
  initialColor = "#ffffff",
  initialOpacity = 1,
  initialLayerOrder = "frame-on-top", // 新增：層級順序
  initialFrameOpacity = 1, // 新增：頭像框透明度
  userPoints = 0, // 新增：用戶積分餘額
  isLevelUnlocked = false // 新增：是否達到 LV2
}) {
  const [frameColor, setFrameColor] = useState("#ffffff");
  const [frameOpacity, setFrameOpacity] = useState(1);
  const [layerOrder, setLayerOrder] = useState("frame-on-top"); // 新增：層級順序狀態
  const [frameTransparency, setFrameTransparency] = useState(1); // 新增：頭像框透明度狀態
  const [hasCustomColor, setHasCustomColor] = useState(false);

  useEffect(() => {
    // 如果有初始設定，表示已經有自訂顏色
    if (initialColor !== "#ffffff" || initialOpacity !== 1 || initialLayerOrder !== "frame-on-top" || initialFrameOpacity !== 1) {
      setFrameColor(initialColor);
      setFrameOpacity(initialOpacity);
      setLayerOrder(initialLayerOrder);
      setFrameTransparency(initialFrameOpacity);
      setHasCustomColor(true);
    } else {
      setFrameColor("#ffffff");
      setFrameOpacity(1);
      setLayerOrder("frame-on-top");
      setFrameTransparency(1);
      setHasCustomColor(false);
    }
    console.log("🔧 FrameColorEditor 接收到的 frameId:", frameId);
    console.log("🔧 FrameColorEditor 接收到的 userAvatar:", userAvatar);
  }, [initialColor, initialOpacity, initialLayerOrder, initialFrameOpacity, frameId, userAvatar]);

  const handleSaveClick = async () => {
    // 如果未解鎖功能，直接返回（不關閉編輯器）
    if (!isLevelUnlocked) {
      return;
    }
    
    // 調用父組件的 onSave，父組件會處理確認彈窗和關閉邏輯
    onSave({
      color: frameColor,
      opacity: frameOpacity,
      layerOrder: layerOrder,
      frameOpacity: frameTransparency
    });
  };


  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed top-0 left-0 right-0 bottom-0 bg-black/50 flex items-center justify-center z-[99999]" style={{ padding: '60px 16px 120px 16px' }}>
      <div className="bg-zinc-800 rounded-xl max-w-4xl w-full max-h-full overflow-y-auto flex flex-col">
        {/* 標題 */}
        <div className="flex justify-between items-center p-6 border-b border-zinc-700">
          <h2 className="text-xl font-bold text-white">編輯頭像框顏色</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* 主要內容區域 */}
        <div className="flex flex-1 overflow-hidden">
          {/* 預覽區域 - 固定在左側 */}
          <div className="w-1/2 p-6 flex flex-col items-center justify-center bg-zinc-800 border-r border-zinc-700">
            <div className="text-center">
              <AvatarFrame
                src={userAvatar || "https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/b479a9e9-6c1a-4c6a-94ff-283541062d00/avatar"}
                size={128}
                frameId={frameId}
                showFrame={true}
                alt="預覽頭像"
                frameColor={hasCustomColor ? frameColor : "#ffffff"}
                frameOpacity={hasCustomColor ? frameOpacity : 1}
                layerOrder={layerOrder}
                frameTransparency={frameTransparency}
              />
              <p className="text-gray-400 text-sm mt-4">預覽效果</p>
            </div>
          </div>

          {/* 顏色控制區域 - 右側 */}
          <div className="w-1/2 p-6 space-y-6 overflow-y-auto">
          {/* 預設色塊 */}
          <div>
            <label className="block text-white font-medium mb-2">預設顏色</label>
            <div className="grid grid-cols-6 gap-2">
              {[
                "#ffffff", "#ff6b6b", "#4ecdc4", "#45b7d1", 
                "#96ceb4", "#feca57", "#ff9ff3", "#54a0ff",
                "#5f27cd", "#00d2d3", "#ff9f43", "#10ac84"
              ].map((color) => (
                <button
                  key={color}
                  onClick={() => {
                    setFrameColor(color);
                    setHasCustomColor(true);
                  }}
                  className={`w-8 h-8 rounded border-2 ${
                    frameColor === color ? 'border-white' : 'border-zinc-600'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* 自訂顏色選擇器 */}
          <div>
            <label className="block text-white font-medium mb-2">自訂顏色</label>
            <div className="flex items-center gap-3">
              <div className="relative">
                <input
                  type="color"
                  value={frameColor}
                  onChange={(e) => {
                    setFrameColor(e.target.value);
                    setHasCustomColor(true);
                  }}
                  className="absolute opacity-0 w-12 h-12 cursor-pointer"
                />
                <div 
                  className="w-12 h-12 rounded border-2 border-zinc-600 cursor-pointer"
                  style={{ backgroundColor: frameColor }}
                />
              </div>
              <input
                type="text"
                value={frameColor}
                onChange={(e) => {
                  setFrameColor(e.target.value);
                  setHasCustomColor(true);
                }}
                className="flex-1 px-3 py-2 bg-zinc-700 text-white rounded border border-zinc-600"
                placeholder="#ffffff"
              />
            </div>
          </div>

          {/* 透明度控制 */}
          <div>
            <label className="block text-white font-medium mb-2">
              濾鏡強度: {Math.round(frameOpacity * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={frameOpacity}
              onChange={(e) => {
                setFrameOpacity(parseFloat(e.target.value));
                setHasCustomColor(true);
              }}
              className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* 層級順序控制 */}
          <div>
            <label className="block text-white font-medium mb-2">層級順序</label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="layerOrder"
                  value="frame-on-top"
                  checked={layerOrder === "frame-on-top"}
                  onChange={(e) => {
                    setLayerOrder(e.target.value);
                    setHasCustomColor(true);
                  }}
                  className="mr-2"
                />
                <span className="text-gray-300">頭像框在上（框蓋住頭像）</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="layerOrder"
                  value="avatar-on-top"
                  checked={layerOrder === "avatar-on-top"}
                  onChange={(e) => {
                    setLayerOrder(e.target.value);
                    setHasCustomColor(true);
                  }}
                  className="mr-2"
                />
                <span className="text-gray-300">頭像在上（頭像蓋住框）</span>
              </label>
            </div>
          </div>

          {/* 頭像框透明度控制 */}
          <div>
            <label className="block text-white font-medium mb-2">
              頭像框透明度: {Math.round(frameTransparency * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={frameTransparency}
              onChange={(e) => {
                setFrameTransparency(parseFloat(e.target.value));
                setHasCustomColor(true);
              }}
              className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* 重置按鈕 */}
          <div className="text-center">
            <button
              onClick={() => {
                setFrameColor("#ffffff");
                setFrameOpacity(1);
                setLayerOrder("frame-on-top");
                setFrameTransparency(1);
                setHasCustomColor(false);
              }}
              className="px-4 py-2 bg-zinc-600 text-white rounded-lg hover:bg-zinc-500 transition-colors text-sm"
            >
              🔄 重置為原始
            </button>
          </div>
          </div>
        </div>

        {/* 底部按鈕 */}
        <div className="p-6 border-t border-zinc-700 bg-zinc-800 sticky bottom-0">
          {/* 功能提示 */}
          <div className="mb-4 p-3 bg-zinc-700/50 rounded-lg border border-zinc-600">
            <div className="flex items-center gap-2 text-sm">
              {!isLevelUnlocked ? (
                <>
                  <span className="text-yellow-400">🔒</span>
                  <span className="text-yellow-400">此功能需要達到 LV2 才能使用</span>
                </>
              ) : (
                <>
                  <span className="text-blue-400">💡</span>
                  <span className="text-gray-300">可免費預覽效果，確認頭像框時將消費 </span>
                  <span className="text-yellow-400 font-semibold">20 積分</span>
                </>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSaveClick}
              disabled={!isLevelUnlocked}
              className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                !isLevelUnlocked
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {!isLevelUnlocked ? '🔒 未解鎖' : '保存預覽設定'}
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}
