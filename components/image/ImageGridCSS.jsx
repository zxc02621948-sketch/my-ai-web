"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import ImageCard from "./ImageCard";
import styles from "./ImageGridCSS.module.css";

export default function ImageGridCSS({
  images = [],
  filteredImages,
  currentUser,
  isLikedByCurrentUser,
  onSelectImage,
  onToggleLike,
  onLocalLikeChange,
  viewMode,
  loadMoreRef,
}) {
  const list = filteredImages || images || [];
  const [loadedImages, setLoadedImages] = useState(new Set());
  const gridRef = useRef(null);

  // 計算列數 - 服務器端渲染時使用默認值
  const getColumnCount = () => {
    if (typeof window === 'undefined') return 5;
    const width = window.innerWidth;
    let columns;
    if (width <= 767) columns = 2;
    else if (width <= 1023) columns = 3;
    else columns = 5;
    
    return columns;
  };

  const [columnCount, setColumnCount] = useState(5); // 服務器端和客戶端都使用相同的初始值
  const [forceUpdate, setForceUpdate] = useState(0); // 強制重新渲染的計數器
  const columnCountRef = useRef(5); // 用於在 resize 處理函數中獲取最新的列數

  // ✅ 性能優化：使用 requestAnimationFrame 和 debounce 來減少強制重排
  const resizeTimeoutRef = useRef(null);
  
  const handleResize = useCallback(() => {
    // 清除之前的 timeout
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }
    
    // 使用 debounce 和 requestAnimationFrame 來批量處理 resize 事件
    resizeTimeoutRef.current = setTimeout(() => {
      requestAnimationFrame(() => {
        const newColumnCount = getColumnCount();
        const currentColumnCount = columnCountRef.current;
        
        if (newColumnCount !== currentColumnCount) {
          columnCountRef.current = newColumnCount;
          setColumnCount(newColumnCount);
          setForceUpdate(prev => prev + 1);
          
          // 在 requestAnimationFrame 中更新 CSS 自定義屬性，避免強制重排
          if (gridRef.current) {
            gridRef.current.style.setProperty('--grid-columns', newColumnCount);
          }
        }
      });
    }, 150); // 150ms debounce
  }, []);

  useEffect(() => {
    // 客戶端掛載後設置正確的列數
    // 使用 requestAnimationFrame 確保在下一幀更新，避免強制重排
    requestAnimationFrame(() => {
      const initialColumnCount = getColumnCount();
      setColumnCount(initialColumnCount);
      columnCountRef.current = initialColumnCount;
      setForceUpdate(prev => prev + 1);
      
      // 設置 CSS 自定義屬性
      if (gridRef.current) {
        gridRef.current.style.setProperty('--grid-columns', initialColumnCount);
      }
    });

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      // 清理 timeout
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [handleResize]);

  // 處理圖片載入
  const handleImageLoad = (imageId) => {
    setLoadedImages(prev => new Set([...prev, imageId]));
  };

  // 將圖片分配到各列 - 使用 useMemo 確保在依賴項改變時重新計算
  const columns = useMemo(() => {
    const columnsArray = Array.from({ length: columnCount }, () => []);
    const columnHeights = Array(columnCount).fill(0);

    // 確保 list 是有效陣列
    if (!Array.isArray(list) || list.length === 0) {
      return columnsArray;
    }

    list.forEach((image) => {
      // 確保 image 物件存在且有必要的屬性
      if (!image || !image.width || !image.height) {
        return;
      }

      // 找到最短的列
      const shortestColumnIndex = columnHeights.indexOf(Math.min(...columnHeights));
      columnsArray[shortestColumnIndex].push(image);
      
      // 估算圖片高度（基於寬高比）
      const aspectRatio = image.height / image.width;
      const estimatedHeight = 300 * aspectRatio + 60; // 基礎高度 + 邊距
      columnHeights[shortestColumnIndex] += estimatedHeight;
    });

    return columnsArray;
  }, [list, columnCount, forceUpdate]);

  return (
    <div className={styles.container}>
      <div 
        className={styles.grid} 
        ref={gridRef}
        style={{ '--grid-columns': columnCount }}
      >
        {columns.map((column, columnIndex) => (
          <div key={columnIndex} className={styles.column}>
            {column.map((image, imageIndex) => (
              <div
                key={image._id}
                className={`${styles.item} ${loadedImages.has(image._id) ? styles.loaded : ''}`}
              >
                <ImageCard
                  img={image}
                  currentUser={currentUser}
                  isLiked={isLikedByCurrentUser ? isLikedByCurrentUser(image) : false}
                  onClick={() => onSelectImage && onSelectImage(image)}
                  onToggleLike={onToggleLike}
                  onLocalLikeChange={onLocalLikeChange}
                  viewMode={viewMode}
                  onImageLoad={() => handleImageLoad(image._id)}
                  isFirstInColumn={imageIndex === 0}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
      
      {/* 無限滾動 sentinel */}
      {loadMoreRef && (
        <div
          ref={loadMoreRef}
          className={styles.loadMoreSentinel}
        />
      )}
    </div>
  );
}