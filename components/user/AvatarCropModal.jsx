// components/user/AvatarCropModal.jsx
import React, { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import Modal from "@/components/common/Modal";
import { getCroppedImg } from "@/lib/cropImage";
import { Slider } from "@mui/material";

export default function AvatarCropModal({ isOpen, onClose, imageSrc, onCropComplete }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

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
    onClose();
  };

  return (
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
          <div className="flex justify-end gap-2 mt-2">
            <button onClick={onClose} className="px-4 py-2 bg-gray-300 rounded">取消</button>
            <button onClick={handleConfirm} className="px-4 py-2 bg-blue-500 text-white rounded">確定</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
