"use client";

import React from "react";
import ImageCard from "./ImageCard";

/**
 * 手機：等寬 2 欄 Grid（不會出現一窄一寬）
 * md+：columns 瀑布流（維持你想要的自然高度）
 */
export default function ImageGrid({
  images = [],
  filteredImages,
  currentUser,
  isLikedByCurrentUser,
  onSelectImage,
  onToggleLike,
  onLocalLikeChange,
}) {
  const finalImages = images.length ? images : (filteredImages || []);

  if (!finalImages?.length) return null;

  return (
    <>
      {/* Mobile: uniform grid */}
      <div className="md:hidden grid grid-cols-2 gap-3">
        {finalImages.map((img) => (
          <div key={img._id} className="break-inside-avoid">
            <ImageCard
              img={img}
              currentUser={currentUser}
              isLiked={isLikedByCurrentUser?.(img)}
              onClick={() => onSelectImage?.(img)}
              onToggleLike={() => onToggleLike?.(img._id)}
              onLocalLikeChange={onLocalLikeChange}
            />
          </div>
        ))}
      </div>

      {/* Desktop+: masonry via CSS columns */}
      <div className="hidden md:block">
        <div className="columns-3 lg:columns-4 xl:columns-5 gap-4 [column-fill:_balance]">
          {finalImages.map((img) => (
            <div key={img._id} className="mb-4 break-inside-avoid">
              <ImageCard
                img={img}
                currentUser={currentUser}
                isLiked={isLikedByCurrentUser?.(img)}
                onClick={() => onSelectImage?.(img)}
                onToggleLike={() => onToggleLike?.(img._id)}
                onLocalLikeChange={onLocalLikeChange}
              />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
