"use client";

import React from "react";
import ImageCard from "./ImageCard";

/**
 * 純 CSS columns 瀑布流：
 * - 手機 columns-2，md:3 / lg:4 / xl:5
 * - 每個 item 加 break-inside-avoid，避免斷裂
 * - 不再使用 .my-masonry-grid（避免舊 CSS 干擾）
 */
export default function ImageGrid({
  images = [],
  filteredImages,
  currentUser,
  isLikedByCurrentUser,
  onSelectImage,
  onToggleLike,
  onLocalLikeChange,
  viewMode,
}) {
  const list = images?.length ? images : (filteredImages || []);
  if (!list?.length) return null;

  return (
    <div
      className={[
        // columns 瀑布流（等寬）
        "columns-2 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5",
        // 欄間距
        "gap-3",
        // 讓內容平均分配（Safari 也較穩）
        "[column-fill:_balance]",
      ].join(" ")}
    >
      {list.map((img, i) => (
        <div key={img._id || i} className="mb-3 break-inside-avoid">
          <ImageCard
            img={img}
            viewMode={viewMode}
            currentUser={currentUser}
            isLiked={isLikedByCurrentUser?.(img)}
            onClick={() => onSelectImage?.(img)}
            onToggleLike={() => onToggleLike?.(img._id)}
            onLocalLikeChange={onLocalLikeChange}
          />
        </div>
      ))}
    </div>
  );
}
