"use client";

import React, { useEffect, useState } from "react";
import ImageCard from "./ImageCard";

const ImageGrid = ({
  images = [],
  filteredImages,
  onSelectImage,
  onToggleLike,
  isLikedByCurrentUser,
  currentUser,
  viewMode,
}) => {
  const finalImages = images.length > 0 ? images : filteredImages || [];
  const [columnCount, setColumnCount] = useState(2);

  useEffect(() => {
    const computeCols = () => {
      const w = window.innerWidth;
      if (w < 640) return 2; // mobile
      if (w < 768) return 2; // sm
      if (w < 1024) return 3; // md
      if (w < 1280) return 4; // lg
      return 5; // xl+
    };
    const apply = () => setColumnCount(computeCols());
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);

  if (!Array.isArray(finalImages)) return null;

  // Split into N columns (keeps your existing my-masonry-grid CSS hooks)
  const columns = Array.from({ length: columnCount }, () => []);
  finalImages.forEach((img, idx) => {
    columns[idx % columnCount].push(img);
  });

  return (
    <div className="my-masonry-grid">
      {columns.map((column, colIdx) => (
        <div key={colIdx} className="my-masonry-grid_column">
          {column.map((img, idx) => (
            <div key={`${img._id || idx}-${colIdx}`} className="mb-3 break-inside-avoid">
              <ImageCard
                img={img}
                viewMode={viewMode}
                currentUser={currentUser}
                isLiked={isLikedByCurrentUser?.(img)}
                onClick={() => onSelectImage(img)}
                onToggleLike={onToggleLike}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default ImageGrid;