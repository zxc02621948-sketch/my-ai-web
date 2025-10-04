"use client";

import React, { useEffect, useState, useMemo } from "react";
import ImageCard from "./ImageCard";

export default function ImageGrid({
  images = [],
  filteredImages,
  currentUser,
  isLikedByCurrentUser,
  onSelectImage,
  onToggleLike,
  onLocalLikeChange,
  onLikeUpdate,
  viewMode,
}) {
  const list = useMemo(() => {
    return images?.length ? images : (filteredImages || []);
  }, [images, filteredImages]);
  const [columns, setColumns] = useState(5);
  const [columnArrays, setColumnArrays] = useState([]);

  // 監聽窗口大小變化，計算欄數
  useEffect(() => {
    const updateColumns = () => {
      const width = window.innerWidth;
      let newColumns;
      if (width >= 1024) {
        newColumns = 5;
      } else if (width >= 768) {
        newColumns = 3;
      } else {
        newColumns = 2;
      }
      
      setColumns(newColumns);
    };

    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []); // 移除 columns 依賴避免無限循環

  // 將圖片按左到右順序分配到各列
  useEffect(() => {
    if (!list || list.length === 0) {
      setColumnArrays([]);
      return;
    }

    const newColumnArrays = Array.from({ length: columns }, () => []);
    
    // 按順序將圖片分配到各列（左到右）
    list.forEach((image, index) => {
      const columnIndex = index % columns;
      newColumnArrays[columnIndex].push(image);
    });

    setColumnArrays(newColumnArrays);
  }, [list, columns]);

  // 如果沒有圖片，顯示空狀態
  if (!list || list.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <p>沒有找到圖片</p>
      </div>
    );
  }

  return (
    <div className="image-grid-container">
      <style jsx>{`
        .image-grid-container {
          padding: 10px;
        }
        
        .image-grid {
          display: flex;
          gap: 10px;
          max-width: 100%;
          margin: 0 auto;
          align-items: flex-start;
        }
        
        .grid-column {
          width: calc((100% - ${(columns - 1) * 10}px) / ${columns});
          display: flex;
          flex-direction: column;
          gap: 10px;
          flex-shrink: 0;
        }
        
        .grid-item {
          width: 100%;
          overflow: hidden;
          border-radius: 8px;
        }
      `}</style>
      
      <div className="image-grid">
        {columnArrays.map((columnImages, columnIndex) => (
          <div key={columnIndex} className="grid-column">
            {columnImages.map((image) => (
              <div key={image._id} className="grid-item">
                <ImageCard
                  img={image}
                  currentUser={currentUser}
                  isLiked={isLikedByCurrentUser?.(image)}
                  onClick={onSelectImage}
                  onToggleLike={onToggleLike}
                  onLocalLikeChange={onLocalLikeChange}
                  onLikeUpdate={onLikeUpdate}
                  viewMode={viewMode}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
