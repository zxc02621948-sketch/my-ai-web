"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import ImageCard from "./ImageCard";
import { trackEvent } from "@/utils/analyticsQueue";

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
  
  // ✅ 圖片分析：滾動深度追蹤
  const viewedImagesRef = useRef(new Set());
  const scrollDepthMapRef = useRef(new Map()); // imageId -> maxScrollDepth
  const scrollTimerRef = useRef(null);
  const trackEventRef = useRef(trackEvent); // ✅ 使用 ref 保存 trackEvent 引用

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
  
  // ✅ 圖片分析：滾動深度追蹤
  useEffect(() => {
    if (!list || list.length === 0) return;
    
    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: [0, 0.25, 0.5, 0.75, 1],
    };
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const imageId = entry.target.dataset.imageId;
        if (!imageId) return;
        
        if (entry.isIntersecting) {
          // 計算滾動深度
          const rect = entry.boundingClientRect;
          const viewportHeight = window.innerHeight;
          const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
          const elementTop = rect.top + scrollTop;
          const windowBottom = scrollTop + viewportHeight;
          
          // 計算圖片在視口中的可見比例
          const visibleTop = Math.max(0, windowBottom - elementTop);
          const visibleBottom = Math.max(0, windowBottom - (elementTop + rect.height));
          const visibleHeight = Math.min(rect.height, visibleTop - visibleBottom);
          const scrollDepth = rect.height > 0 ? (visibleHeight / rect.height) * 100 : 0;
          
          // 更新最大滾動深度
          const currentMax = scrollDepthMapRef.current.get(imageId) || 0;
          const newMax = Math.max(currentMax, scrollDepth);
          scrollDepthMapRef.current.set(imageId, newMax);
          
          // 記錄 view 事件（第一次進入視口時）
          if (!viewedImagesRef.current.has(imageId)) {
            viewedImagesRef.current.add(imageId);
            if (typeof trackEventRef.current === 'function') {
              trackEventRef.current('image', {
                imageId,
                eventType: 'view',
                scrollDepth: 0,
              });
            }
          }
        }
      });
    }, observerOptions);
    
    // 觀察所有圖片卡片
    const imageCards = document.querySelectorAll('[data-image-id]');
    imageCards.forEach(card => observer.observe(card));
    
    // 定期上報滾動深度（1秒一次）
    const handleScroll = () => {
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
      }
      
      scrollTimerRef.current = setTimeout(() => {
        if (typeof trackEventRef.current === 'function') {
          scrollDepthMapRef.current.forEach((depth, imageId) => {
            trackEventRef.current('image', {
              imageId,
              eventType: 'scroll_depth',
              scrollDepth: Math.round(depth),
            });
          });
        }
      }, 1000); // 1秒 debounce
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
      }
    };
  }, [list]);

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
            {columnImages.map((image, imageIndex) => (
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
                  isFirstInColumn={imageIndex === 0}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
