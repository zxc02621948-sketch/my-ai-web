'use client';

import React, { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import Cropper from "react-easy-crop";
import { Slider } from "@mui/material";
import { getCroppedImg } from "@/lib/cropImage";
import FreeFrameSelector from "./FreeFrameSelector";
import OwnedFrameSelector from "./OwnedFrameSelector";
import FrameColorEditor from "./FrameColorEditor";
import AvatarFrame from "@/components/common/AvatarFrame";
import axios from "axios";
import { getLevelIndex } from "@/utils/pointsLevels";
import { notify } from "@/components/common/GlobalNotificationManager";

export default function UnifiedAvatarModal({ 
  isOpen, 
  onClose, 
  currentFrame, 
  onFrameSelect,
  onImageUpload,
  userPoints = 0,
  userTotalEarnedPoints = 0, // 新增：總賺取積分（用於等級計算）
  userAvatar = null,
  frameSettings: initialFrameSettings = {},
  frameColorEditorUnlocked = false
}) {
  const [activeTab, setActiveTab] = useState("frame"); // "frame" 或 "upload"
  const [selectedImage, setSelectedImage] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [showFreeFrameSelector, setShowFreeFrameSelector] = useState(false);
  const [showOwnedFrameSelector, setShowOwnedFrameSelector] = useState(false);
  const [showColorEditor, setShowColorEditor] = useState(false);
  const [previewFrame, setPreviewFrame] = useState(currentFrame || "default");
  const [previewImage, setPreviewImage] = useState(null);
  const [frameSettings, setFrameSettings] = useState(initialFrameSettings);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmCallback, setConfirmCallback] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // 同步初始 frameSettings
  useEffect(() => {
    setFrameSettings(initialFrameSettings);
  }, [initialFrameSettings]);

  const onCropChange = (c) => setCrop(c);
  const onZoomChange = (z) => setZoom(z);
  const onCropAreaComplete = useCallback(async (_, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
    
    // 生成預覽圖片
    if (selectedImage && croppedAreaPixels) {
      try {
        console.log("🔧 開始生成預覽圖片");
        const croppedImage = await getCroppedImg(selectedImage, croppedAreaPixels);
        setPreviewImage(croppedImage);
        console.log("🔧 預覽圖片生成成功");
      } catch (error) {
        console.error("生成預覽圖片失敗:", error);
      }
    }
  }, [selectedImage]);

  const handleImageSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImage(e.target.result);
        setPreviewImage(null); // 重置預覽圖片
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageUpload = async () => {
    try {
      let imageFile = null;
      
      // 優先使用預覽圖片（已裁剪的）
      if (previewImage) {
        imageFile = previewImage;
      } else if (selectedImage && croppedAreaPixels) {
        // 如果沒有預覽圖片，重新裁剪
        const croppedImage = await getCroppedImg(selectedImage, croppedAreaPixels);
        imageFile = croppedImage;
      } else if (selectedImage) {
        // 如果沒有裁剪，使用原始圖片
        imageFile = selectedImage;
      }
      
      if (imageFile) {
        // 將 base64 轉換為 File 對象
        const file = await base64ToFile(imageFile, 'avatar.jpg');
        
        // 先上傳頭像
        await onImageUpload(file);
        
        // 設置頭像框
        await onFrameSelect(previewFrame);
        
        onClose();
      }
    } catch (error) {
      console.error("處理圖片時發生錯誤:", error);
      notify.error("處理失敗", "處理圖片時發生錯誤，請重試");
    }
  };

  // 將 base64 字符串轉換為 File 對象
  const base64ToFile = async (base64String, filename) => {
    const response = await fetch(base64String);
    const blob = await response.blob();
    return new File([blob], filename, { type: blob.type });
  };

  const handleClose = () => {
    setActiveTab("frame");
    setSelectedImage(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setPreviewFrame(currentFrame || "default");
    setPreviewImage(null);
    onClose();
  };

  // 獲取頭像框名稱的輔助函數
  const getFrameName = (frameId) => {
    const frameMap = {
      // 高階頭像框
      "default": "預設",
      "circleflowerframe": "圓形花卉",
      "frame122": "經典邊框",
      "frame265": "幾何邊框",
      "frame266": "現代邊框",
      "frame280": "簡約邊框",
      "ornate": "華麗邊框",
      "floral": "花卉邊框",
      "dotted": "點點邊框",
      "plait": "編織邊框",
      "geometric1": "幾何圖案1",
      "geometric2": "幾何圖案2",
      
      // 一般頭像框
      "ai-generated": "AI 生成",
      "animals": "動物",
      "leaves": "葉子",
      "magic-circle": "魔法陣",
      "magic-circle-2": "魔法陣2"
    };
    return frameMap[frameId] || frameId;
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div 
      className="fixed top-0 left-0 right-0 bottom-0 bg-black/50 flex items-center justify-center z-[99999]" 
      style={{ padding: '60px 16px 80px 16px' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div className="bg-zinc-800 rounded-xl max-w-lg w-full max-h-full flex flex-col shadow-2xl overflow-hidden">
        {/* 標題 */}
        <div className="flex justify-between items-center p-6 border-b border-zinc-700">
          <h2 className="text-xl font-bold text-white">更換頭像</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* 分頁標籤 */}
        <div className="flex border-b border-zinc-700">
          <button
            onClick={() => setActiveTab("frame")}
            className={`flex-1 px-4 py-3 font-medium transition-colors ${
              activeTab === "frame"
                ? "bg-purple-600 text-white border-b-2 border-purple-400"
                : "bg-zinc-700 text-gray-300 hover:bg-zinc-600"
            }`}
          >
            🎨 頭像框
          </button>
          <button
            onClick={() => setActiveTab("upload")}
            className={`flex-1 px-4 py-3 font-medium transition-colors ${
              activeTab === "upload"
                ? "bg-blue-600 text-white border-b-2 border-blue-400"
                : "bg-zinc-700 text-gray-300 hover:bg-zinc-600"
            }`}
          >
            📷 上傳頭像
          </button>
        </div>

        {/* 內容區域 */}
        <div className="p-6 overflow-y-auto flex-1 min-h-0">
          {activeTab === "frame" && (
            <div className="space-y-4">
              {/* 預覽 */}
              <div className="text-center">
                <h3 className="text-white mb-4">預覽效果</h3>
                <div className="flex justify-center">
                  <AvatarFrame
                    src={userAvatar || "https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/b479a9e9-6c1a-4c6a-94ff-283541062d00/avatar"}
                    size={128}
                    frameId={previewFrame}
                    showFrame={true}
                    alt="預覽頭像"
                    frameColor={frameSettings[previewFrame]?.color || "#ffffff"}
                    frameOpacity={frameSettings[previewFrame]?.opacity || 1}
                    layerOrder={frameSettings[previewFrame]?.layerOrder || "frame-on-top"}
                    frameTransparency={frameSettings[previewFrame]?.frameOpacity || 1}
                  />
                </div>
                <p className="text-gray-400 text-sm mt-2">
                  當前頭像框：{getFrameName(previewFrame)}
                </p>
                
                {/* 顏色編輯按鈕 */}
                {(() => {
                  // ✅ 檢查是否解鎖：字段已設置 OR 等級達到 LV2（索引 >= 1）
                  const userLevel = getLevelIndex(userTotalEarnedPoints || 0);
                  const isUnlocked = frameColorEditorUnlocked || userLevel >= 1; // LV2 的索引是 1
                  
                  if (previewFrame !== "default" && isUnlocked) {
                    return (
                      <button
                        onClick={() => setShowColorEditor(true)}
                        className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                      >
                        🎨 編輯顏色
                      </button>
                    );
                  }
                  if (previewFrame !== "default" && !isUnlocked) {
                    return (
                      <div className="mt-3 px-4 py-2 bg-gray-600 text-gray-300 rounded-lg text-sm text-center">
                        🔒 需要達到 LV2 才能使用調色盤功能
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* 頭像框選擇 */}
              <div className="space-y-3">
                <h3 className="text-white font-medium">選擇頭像框</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setShowFreeFrameSelector(true)}
                    className="p-3 rounded-lg border-2 border-zinc-600 hover:border-green-500 transition-colors"
                  >
                    <div className="text-center">
                      <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-lg">
                        🆓
                      </div>
                      <span className="text-white text-sm">免費頭像框</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setShowOwnedFrameSelector(true)}
                    className="p-3 rounded-lg border-2 border-zinc-600 hover:border-blue-500 transition-colors"
                  >
                    <div className="text-center">
                      <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-lg">
                        📦
                      </div>
                      <span className="text-white text-sm">我的頭像框</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "upload" && (
            <div className="space-y-4">
              {/* 預覽區域 - 使用統一的預覽區域 */}
              <div className="text-center">
                <h3 className="text-white mb-4">預覽效果</h3>
                <div className="flex justify-center">
                  <AvatarFrame
                    src={previewImage || userAvatar || "https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/b479a9e9-6c1a-4c6a-94ff-283541062d00/avatar"}
                    size={128}
                    frameId={previewFrame}
                    showFrame={true}
                    alt="預覽頭像"
                    frameColor={frameSettings[previewFrame]?.color || "#ffffff"}
                    frameOpacity={frameSettings[previewFrame]?.opacity || 1}
                    layerOrder={frameSettings[previewFrame]?.layerOrder || "frame-on-top"}
                    frameTransparency={frameSettings[previewFrame]?.frameOpacity || 1}
                  />
                </div>
                <p className="text-gray-400 text-sm mt-2">
                  {previewImage ? "預覽裁剪後的頭像效果" : "預覽當前頭像效果"}
                </p>
              </div>

              {/* 圖片選擇 */}
              <div>
                <h3 className="text-white font-medium mb-3">選擇圖片</h3>
                <div className="border-2 border-dashed border-zinc-600 rounded-lg p-6 text-center">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                    id="image-upload"
                  />
                  <label
                    htmlFor="image-upload"
                    className="cursor-pointer block"
                  >
                    <div className="text-gray-400 mb-2">
                      <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </div>
                    <p className="text-white">點擊選擇圖片</p>
                    <p className="text-gray-400 text-sm">支持 JPG, PNG, GIF 格式</p>
                  </label>
                </div>
              </div>

              {/* 圖片裁剪 */}
              {selectedImage && (
                <div className="space-y-4">
                  <h3 className="text-white font-medium">裁剪圖片</h3>
                  <div className="relative w-full h-64 bg-zinc-700 rounded-lg overflow-hidden">
                    <Cropper
                      image={selectedImage}
                      crop={crop}
                      zoom={zoom}
                      aspect={1}
                      onCropChange={onCropChange}
                      onCropAreaComplete={onCropAreaComplete}
                      onZoomChange={onZoomChange}
                      showGrid={false}
                      style={{
                        containerStyle: {
                          width: "100%",
                          height: "100%",
                          position: "relative"
                        }
                      }}
                    />
                  </div>
                  
                  {/* 縮放控制 */}
                  <div className="space-y-2">
                    <label className="text-white text-sm">縮放</label>
                    <Slider
                      value={zoom}
                      min={1}
                      max={3}
                      step={0.1}
                      onChange={(_, value) => onZoomChange(value)}
                      sx={{
                        color: '#3B82F6',
                        '& .MuiSlider-thumb': {
                          backgroundColor: '#3B82F6',
                        },
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部按鈕 */}
        <div className="p-6 border-t border-zinc-700">
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors"
            >
              取消
            </button>
            {activeTab === "frame" && (
              <button
                onClick={async () => {
                  const settings = frameSettings[previewFrame];
                  await onFrameSelect(previewFrame, settings);
                  onClose();
                }}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                確認頭像框
              </button>
            )}
            {activeTab === "upload" && selectedImage && (
              <button
                onClick={handleImageUpload}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                確認選擇
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 顯示免費頭像框選擇器 */}
      {showFreeFrameSelector && (
        <FreeFrameSelector
          isOpen={showFreeFrameSelector}
          onClose={() => setShowFreeFrameSelector(false)}
          currentFrame={previewFrame}
          onFrameSelect={(frameId, settings) => {
            setPreviewFrame(frameId);
            setShowFreeFrameSelector(false);
            // 保存頭像框的編輯設定
            if (settings) {
              setFrameSettings(prev => ({
                ...prev,
                [frameId]: settings
              }));
            }
          }}
          userAvatar={userAvatar}
        />
      )}

      {/* 顯示已購買頭像框選擇器 */}
      {showOwnedFrameSelector && (
        <OwnedFrameSelector
          isOpen={showOwnedFrameSelector}
          onClose={() => setShowOwnedFrameSelector(false)}
          currentFrame={previewFrame}
          onFrameSelect={(frameId, settings) => {
            setPreviewFrame(frameId);
            setShowOwnedFrameSelector(false);
            // 保存頭像框的編輯設定
            if (settings) {
              setFrameSettings(prev => ({
                ...prev,
                [frameId]: settings
              }));
            }
          }}
        />
      )}

      {/* 顏色編輯器 */}
      {showColorEditor && (
        <FrameColorEditor
          isOpen={showColorEditor}
          onClose={() => setShowColorEditor(false)}
          frameId={previewFrame}
          userAvatar={userAvatar}
          userPoints={userPoints}
          isLevelUnlocked={frameColorEditorUnlocked || getLevelIndex(userTotalEarnedPoints || 0) >= 1}
          onSave={async (settings) => {
            // 顯示確認彈窗
            setConfirmCallback(() => async () => {
              try {
                // 用戶確認後，扣分並保存設定
                const res = await axios.post("/api/frame/save-color-settings", {
                  frameId: previewFrame,
                  settings: settings
                });

                if (res.data.success) {
                  // 更新本地狀態
                  setFrameSettings(prev => ({
                    ...prev,
                    [previewFrame]: settings
                  }));
                  
                  // 廣播積分更新事件
                  if (typeof window !== "undefined") {
                    window.dispatchEvent(new Event("points-updated"));
                  }
                  
                  // 廣播頭像框設定更新事件
                  if (typeof window !== "undefined") {
                    window.dispatchEvent(new CustomEvent("frame-settings-updated", {
                      detail: { 
                        frameId: previewFrame, 
                        settings: settings 
                      }
                    }));
                  }
                  
                  // 成功後關閉彈窗和調色編輯器
                  setShowConfirmDialog(false);
                  setShowColorEditor(false);
                }
              } catch (error) {
                console.error("保存調色盤設定失敗:", error);
                setShowConfirmDialog(false);
              }
            });
            setShowConfirmDialog(true);
          }}
          initialColor={frameSettings[previewFrame]?.color || "#ffffff"}
          initialOpacity={frameSettings[previewFrame]?.opacity || 1}
          initialLayerOrder={frameSettings[previewFrame]?.layerOrder || "frame-on-top"}
          initialFrameOpacity={frameSettings[previewFrame]?.frameOpacity || 1}
        />
      )}

      {/* 自定義確認彈窗 */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100001]">
          <div className="bg-zinc-800 rounded-xl p-6 max-w-md mx-4 border-2 border-yellow-500/50 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4 text-center">💰 確認保存調色設定</h3>
            
            <div className="space-y-3 mb-6">
              <div className="bg-zinc-700/50 p-4 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-300">消費金額</span>
                  <span className="text-yellow-400 font-semibold text-lg">20 積分</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">當前餘額</span>
                  <span className="text-white font-semibold">{userPoints} 積分</span>
                </div>
                <div className="border-t border-zinc-600 my-2"></div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">扣除後餘額</span>
                  <span className="text-green-400 font-semibold">{userPoints - 20} 積分</span>
                </div>
              </div>

              <div className="text-sm text-gray-400 text-center">
                💡 此操作將保存您的頭像框調色設定
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="flex-1 px-4 py-3 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => confirmCallback && confirmCallback()}
                className="flex-1 px-4 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-semibold"
              >
                確認保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
