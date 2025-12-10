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

  // ✅ 將圖片智能分配到各列（總是放入最短的列，使布局更均勻）
  useEffect(() => {
    if (!list || list.length === 0) {
      setColumnArrays([]);
      return;
    }

    const newColumnArrays = Array.from({ length: columns }, () => []);
    const columnHeights = Array.from({ length: columns }, () => 0);
    
    // ✅ 智能分配：總是將圖片放入當前最短的列
    list.forEach((image) => {
      // 找到最短的列
      let shortestColumnIndex = 0;
      let shortestHeight = columnHeights[0];
      
      for (let i = 1; i < columns; i++) {
        if (columnHeights[i] < shortestHeight) {
          shortestHeight = columnHeights[i];
          shortestColumnIndex = i;
        }
      }
      
      // 將圖片放入最短的列
      newColumnArrays[shortestColumnIndex].push(image);
      
      // ✅ 估算列高度（基於圖片寬高比）
      // 假設圖片寬度固定，高度取決於寬高比
      // 使用一個合理的估算值（實際高度會在渲染後由瀏覽器計算）
      const aspectRatio = image.width && image.height 
        ? image.height / image.width 
        : 1.5; // 默認寬高比（假設是豎圖）
      
      // ✅ 根據視窗寬度估算列寬，然後計算圖片高度
      const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
      let columnWidth;
      if (viewportWidth >= 1024) {
        columnWidth = (viewportWidth - 10 * (columns - 1) - 20) / columns; // 減去 gap 和 padding
      } else if (viewportWidth >= 768) {
        columnWidth = (viewportWidth - 10 * (columns - 1) - 20) / columns;
      } else {
        columnWidth = (viewportWidth - 10 * (columns - 1) - 20) / columns;
      }
      
      const estimatedHeight = columnWidth * aspectRatio;
      columnHeights[shortestColumnIndex] += estimatedHeight + 10; // +10 是 gap
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
                  isFirstInColumn={imageIndex < 2} // ✅ 優化：前2張圖片使用eager加載
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
