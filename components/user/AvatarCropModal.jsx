'use client';

// components/user/AvatarCropModal.jsx
import React, { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import Modal from "@/components/common/Modal";
import { getCroppedImg } from "@/lib/cropImage";
import { Slider } from "@mui/material";
import Image from "next/image";

export default function AvatarCropModal({ isOpen, onClose, imageSrc, onCropComplete, currentFrame, onFrameSelect }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [selectedFrame, setSelectedFrame] = useState(currentFrame || "default");
  const [showFrameSelector, setShowFrameSelector] = useState(false);

  const onCropChange = (c) => setCrop(c);
  const onZoomChange = (z) => setZoom(z);
  const onCropAreaComplete = useCallback((_, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleConfirm = async () => {
    const file = await getCroppedImg(imageSrc, croppedAreaPixels, "image/jpeg"); // ✅ 固定輸出 jpeg

    console.log("🐞 DEBUG | file:", file);
    console.log("🐞 DEBUG | file.name:", file.name);
    console.log("🐞 DEBUG | file.type:", file.type);
    console.log("🐞 DEBUG | file instanceof File:", file instanceof File);
    console.log("🐞 上傳檔案確認：", file);
    console.log("➡️ 類型：", file.type);

    onCropComplete(file);
    onFrameSelect?.(selectedFrame);
    onClose();
  };

  const handleFrameSelect = (frameId) => {
    setSelectedFrame(frameId);
    setShowFrameSelector(false);
  };

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

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose}>
        <div className="flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-[400px] aspect-square bg-black relative rounded-lg overflow-hidden">
            <Cropper
              image={imageSrc}
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

          <div className="w-full max-w-[400px] mt-4">
            <Slider
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              onChange={(e, z) => setZoom(z)}
            />
            
            {/* 頭像框選擇 */}
            <div className="mt-4">
              <button 
                onClick={() => setShowFrameSelector(true)}
                className="w-full px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
              >
                選擇頭像框
              </button>
              {selectedFrame !== "default" && (
                <div className="mt-2 text-sm text-gray-600">
                  已選擇頭像框: {selectedFrame}
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={onClose} className="px-4 py-2 bg-gray-300 rounded">取消</button>
              <button onClick={handleConfirm} className="px-4 py-2 bg-blue-500 text-white rounded">確定</button>
            </div>
          </div>
        </div>
      </Modal>

      {/* 頭像框選擇器 */}
      {showFrameSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-zinc-700">
              <h2 className="text-2xl font-bold text-white">選擇頭像框</h2>
              <button
                onClick={() => setShowFrameSelector(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

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
                      onClick={() => handleFrameSelect(frame.id)}
                    >
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

            <div className="flex items-center justify-between p-6 border-t border-zinc-700">
              <div className="text-sm text-gray-400">
                選擇頭像框來個性化你的頭像
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowFrameSelector(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => setShowFrameSelector(false)}
                  className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                >
                  確認選擇
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
