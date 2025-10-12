'use client';

import React, { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { getCroppedImg } from "@/lib/cropImage";
import { Slider } from "@mui/material";
import Image from "next/image";
import AvatarFrame from "@/components/common/AvatarFrame";
import FrameTierSelector from "./FrameTierSelector";

export default function AvatarSelectorModal({ 
  isOpen, 
  onClose, 
  currentFrame, 
  onAvatarUpdate,
  userPoints = 0 
}) {
  const [step, setStep] = useState(1); // 1: 選擇頭像框, 2: 選擇圖片, 3: 裁剪圖片
  const [selectedFrame, setSelectedFrame] = useState(currentFrame || "default");
  const [selectedImage, setSelectedImage] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [showFrameSelector, setShowFrameSelector] = useState(false);

  const onCropChange = (c) => setCrop(c);
  const onZoomChange = (z) => setZoom(z);
  const onCropAreaComplete = useCallback((_, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleFrameSelect = (frameId) => {
    setSelectedFrame(frameId);
    setShowFrameSelector(false);
  };

  const handleImageSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImage(e.target.result);
        setStep(3); // 直接跳到裁剪步驟
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConfirm = async () => {
    try {
      let imageFile = null;
      
      if (selectedImage && croppedAreaPixels) {
        // 裁剪圖片
        const croppedImage = await getCroppedImg(selectedImage, croppedAreaPixels);
        imageFile = croppedImage;
      }
      
      // 調用父組件的更新函數
      await onAvatarUpdate(imageFile, selectedFrame);
      onClose();
    } catch (error) {
      console.error("處理圖片時發生錯誤:", error);
      alert("處理圖片時發生錯誤，請重試");
    }
  };

  const handleBack = () => {
    if (step === 1) {
      onClose();
    } else if (step === 2) {
      setStep(1);
    } else if (step === 3) {
      setStep(2);
    }
  };

  const handleClose = () => {
    setStep(1);
    setSelectedFrame(currentFrame || "default");
    setSelectedImage(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    onClose();
  };

  if (!isOpen) return null;

  // 顯示頭像框選擇器
  if (showFrameSelector) {
    return (
      <FrameTierSelector
        isOpen={showFrameSelector}
        onClose={() => setShowFrameSelector(false)}
        currentFrame={selectedFrame}
        onFrameSelect={handleFrameSelect}
        userPoints={userPoints}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
      <div className="bg-zinc-800 rounded-xl max-w-md w-full mx-4 max-h-[85vh] flex flex-col shadow-2xl">
        {/* 標題 */}
        <div className="flex justify-between items-center p-6 border-b border-zinc-700">
          <h2 className="text-xl font-bold text-white">
            {step === 1 && "選擇頭像框"}
            {step === 2 && "選擇圖片"}
            {step === 3 && "裁剪圖片"}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* 內容區域 */}
        <div className="p-6 overflow-y-auto flex-1 min-h-0">
          {step === 1 && (
            <div className="space-y-4">
              {/* 預覽 */}
              <div className="text-center">
                <h3 className="text-white mb-4">預覽效果</h3>
                <div className="flex justify-center">
                  <AvatarFrame
                    src="https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/b479a9e9-6c1a-4c6a-94ff-283541062d00/public"
                    size={120}
                    frameId={selectedFrame}
                    showFrame={true}
                  />
                </div>
              </div>

              {/* 頭像框選擇 */}
              <div className="space-y-3">
                <h3 className="text-white font-medium">選擇頭像框</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSelectedFrame("default")}
                    className={`p-3 rounded-lg border-2 transition-colors ${
                      selectedFrame === "default"
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
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-white font-medium">選擇圖片</h3>
              <div className="border-2 border-dashed border-zinc-600 rounded-lg p-8 text-center">
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
          )}

          {step === 3 && selectedImage && (
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

        {/* 底部按鈕 */}
        <div className="p-6 border-t border-zinc-700 relative z-10">
          <div className="flex gap-3">
            <button
              onClick={handleBack}
              className="flex-1 px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors"
            >
              {step === 1 ? "取消" : "返回"}
            </button>
            <button
              onClick={() => {
                if (step === 1) {
                  setStep(2);
                } else if (step === 2) {
                  // 跳過裁剪，直接確認
                  handleConfirm();
                } else {
                  handleConfirm();
                }
              }}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {step === 3 ? "確認" : "下一步"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}