'use client';

import React, { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { getCroppedImg } from "@/lib/cropImage";
import { Slider } from "@mui/material";
import Image from "next/image";
import AvatarFrame from "@/components/common/AvatarFrame";

const FRAME_OPTIONS = [
  {
    id: "default",
    name: "預設",
    preview: "/frames/default.svg",
    description: "無頭像框"
  },
  {
    id: "cat-ears",
    name: "貓耳",
    preview: "/frames/cat-ears.svg",
    description: "可愛的貓耳頭像框"
  },
  {
    id: "flame-ring",
    name: "火焰環",
    preview: "/frames/flame-ring.svg",
    description: "燃燒的火焰環頭像框"
  },
  {
    id: "flower-wreath",
    name: "花環",
    preview: "/frames/flower-wreath.svg",
    description: "美麗的花環頭像框"
  },
  {
    id: "ai-generated",
    name: "AI 生成",
    preview: "/frames/ai-generated-7899315_1280.png",
    description: "AI 生成的藝術頭像框"
  },
  {
    id: "animals",
    name: "動物",
    preview: "/frames/animals-5985896_1280.png",
    description: "動物主題頭像框"
  },
  {
    id: "flowers",
    name: "花朵",
    preview: "/frames/flowers-1973874_1280.png",
    description: "花朵圖案頭像框"
  },
  {
    id: "leaves",
    name: "葉子",
    preview: "/frames/leaves-6649803_1280.png",
    description: "自然葉子頭像框"
  }
];

export default function AvatarSelectorModal({ 
  isOpen, 
  onClose, 
  currentFrame, 
  onAvatarUpdate 
}) {
  const [step, setStep] = useState(1); // 1: 選擇頭像框, 2: 選擇圖片, 3: 裁剪圖片
  const [selectedFrame, setSelectedFrame] = useState(currentFrame || "default");
  const [selectedImage, setSelectedImage] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const onCropChange = (c) => setCrop(c);
  const onZoomChange = (z) => setZoom(z);
  const onCropAreaComplete = useCallback((_, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleFrameSelect = (frameId) => {
    setSelectedFrame(frameId);
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
    if (selectedImage && croppedAreaPixels) {
      const file = await getCroppedImg(selectedImage, croppedAreaPixels, "image/jpeg");
      onAvatarUpdate(file, selectedFrame);
    } else {
      // 只更新頭像框，不更新圖片
      onAvatarUpdate(null, selectedFrame);
    }
    onClose();
  };

  const handleBack = () => {
    if (step === 3) {
      setStep(2);
    } else if (step === 2) {
      setStep(1);
    }
  };

  const resetModal = () => {
    setStep(1);
    setSelectedFrame(currentFrame || "default");
    setSelectedImage(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
    <div className="bg-zinc-900 rounded-xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col relative shadow-2xl">
      {/* 標題欄 */}
      <div className="flex items-center justify-between p-6 border-b border-zinc-700">
        <h2 className="text-2xl font-bold text-white">
          {step === 1 && "選擇頭像框"}
          {step === 2 && "選擇圖片"}
          {step === 3 && "裁剪圖片"}
        </h2>
        <button
          onClick={handleClose}
          className="text-gray-400 hover:text-white text-2xl"
        >
          ×
        </button>
      </div>

      {/* 內容區域 */}
      <div className="p-6 overflow-y-auto flex-1 min-h-0">
        {step === 1 && (
          <div>
            <p className="text-gray-400 mb-6">選擇你喜歡的頭像框樣式</p>
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
                    onClick={() => handleFrameSelect(frame.id)}
                  >
                    <div className="relative w-20 h-20 mx-auto mb-3">
                      <AvatarFrame
                        src="https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/b479a9e9-6c1a-4c6a-94ff-283541062d00/public"
                        size={80}
                        frameId={frame.id}
                        showFrame={true}
                        ring={false}
                      />
                    </div>

                    <div className="text-center">
                      <h3 className="text-sm font-semibold text-white mb-1">{frame.name}</h3>
                      <p className="text-xs text-gray-400 mb-2">{frame.description}</p>
                      <div className="text-xs text-green-400">免費</div>
                    </div>

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
        )}

        {step === 2 && (
          <div className="text-center">
            <p className="text-gray-400 mb-6">選擇新的頭像圖片（可選）</p>
            <div className="border-2 border-dashed border-zinc-600 rounded-lg p-8 hover:border-zinc-500 transition-colors">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
                id="avatar-upload"
              />
              <label
                htmlFor="avatar-upload"
                className="cursor-pointer block"
              >
                <div className="text-4xl mb-4">📷</div>
                <p className="text-white mb-2">點擊選擇圖片</p>
                <p className="text-gray-400 text-sm">或拖拽圖片到此處</p>
              </label>
            </div>
            <p className="text-gray-500 text-sm mt-4">
              如果不想更換圖片，可以直接跳過此步驟
            </p>
          </div>
        )}

        {step === 3 && selectedImage && (
          <div className="flex flex-col items-center">
            <div className="w-full max-w-[400px] aspect-square bg-black relative rounded-lg overflow-hidden mb-4">
              <Cropper
                image={selectedImage}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={onCropChange}
                onZoomChange={onZoomChange}
                onCropComplete={onCropAreaComplete}
              />
            </div>

            <div className="w-full max-w-[400px]">
              <Slider
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                onChange={(e, z) => setZoom(z)}
                className="mb-4"
              />
            </div>
          </div>
        )}
      </div>

      {/* 底部按鈕 */}
      <div className="flex items-center justify-between p-6 border-t border-zinc-700 bg-zinc-900 flex-shrink-0 relative z-10">
        <div className="text-sm text-gray-400">
          {step === 1 && "選擇頭像框來個性化你的頭像"}
          {step === 2 && "選擇新的頭像圖片"}
          {step === 3 && "調整圖片大小和位置"}
        </div>
        <div className="flex gap-3">
          {step > 1 && (
            <button
              onClick={handleBack}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              上一步
            </button>
          )}
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            取消
          </button>
          {step === 1 && (
            <div className="flex gap-3">
              <button
                onClick={() => handleConfirm()}
                className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
              >
                確認選擇
              </button>
              <button
                onClick={() => setStep(2)}
                className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
              >
                下一步
              </button>
            </div>
          )}
          {step === 2 && (
            <button
              onClick={() => handleConfirm()}
              className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              完成（僅更新頭像框）
            </button>
          )}
          {step === 3 && (
            <button
              onClick={handleConfirm}
              className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              確認更新
            </button>
          )}
        </div>
      </div>
    </div>
  </div>
  );
}
