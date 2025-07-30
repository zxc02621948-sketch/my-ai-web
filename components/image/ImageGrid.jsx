"use client";

import React from "react";
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
  const columnCount = 5;
  const columns = Array.from({ length: columnCount }, () => []);

  if (!Array.isArray(finalImages)) return null;

  finalImages.forEach((img, idx) => {
    columns[idx % columnCount].push(img);
  });

  return (
    <div className="my-masonry-grid">
      {columns.map((column, colIdx) => (
        <div key={colIdx} className="my-masonry-grid_column">
          {column.map((img, idx) => (
            <ImageCard
              key={idx}
              img={img}
              viewMode={viewMode}
              currentUser={currentUser}
              isLiked={isLikedByCurrentUser?.(img)}
              onClick={() => onSelectImage(img)}
              onToggleLike={onToggleLike}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

export default ImageGrid;
