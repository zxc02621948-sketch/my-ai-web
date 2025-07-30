"use client";

import { Heart } from "lucide-react";
import { useState, useEffect } from "react";

export default function ImageViewer({ image, currentUser, isLiked, onToggleLike }) {
  const [clicked, setClicked] = useState(false);

  useEffect(() => {
    if (isLiked) {
      setClicked(true);
      const timer = setTimeout(() => setClicked(false), 400);
      return () => clearTimeout(timer);
    } else {
      setClicked(false);
    }
  }, [isLiked]);

  if (!image || !image.imageId) {
    return (
      <div className="text-sm text-red-400 bg-neutral-800 p-2 rounded">
        ⚠️ 無法顯示圖片：缺少 imageId。
      </div>
    );
  }

  const imageUrl = `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${image.imageId}/public`;

  const handleClick = (e) => {
    e.stopPropagation();
    if (!onToggleLike) return;
    onToggleLike(image._id);

    if (!isLiked) {
      setClicked(true);
      setTimeout(() => setClicked(false), 400);
    }
  };

  const likeCount = image.likes?.length || 0;

  return (
    <div className="relative w-full h-full max-h-[90vh] flex justify-center items-center overflow-hidden">
      <div className="relative flex justify-center items-center max-h-[90vh]">
        <img
          src={imageUrl}
          alt={image.title || "圖片"}
          className="max-h-[90vh] max-w-full object-contain rounded"
        />

        {/* ❤️ 愛心 + 數字一起放在黑底圓角框中 */}
        <div className="absolute bottom-2 right-2 bg-black/60 text-white px-3 py-1 rounded-full flex items-center space-x-1">
          <button onClick={handleClick} title="愛心" disabled={!currentUser}>
            <Heart
              fill={isLiked || clicked ? "#f472b6" : "transparent"}
              color={isLiked || clicked ? "#f472b6" : "#ccc"}
              strokeWidth={2.5}
              className="w-6 h-6 hover:scale-110 transition duration-200"
            />
          </button>
          <span className="text-sm">{likeCount}</span>
        </div>
      </div>
    </div>
  );
}
