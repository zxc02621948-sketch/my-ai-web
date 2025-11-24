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

  const handleResize = useCallback(() => {
    const newColumnCount = getColumnCount();
    const currentColumnCount = columnCountRef.current;
    
    console.log(`[ImageGridCSS] Resize - New: ${newColumnCount}, Current: ${currentColumnCount}, State: ${columnCount}`);
    
    if (newColumnCount !== currentColumnCount) {
      console.log(`[ImageGridCSS] Column count changed from ${currentColumnCount} to ${newColumnCount}`);
      setColumnCount(newColumnCount);
      columnCountRef.current = newColumnCount;
      setForceUpdate(prev => prev + 1); // 強制重新渲染
      
      // 更新 CSS 自定義屬性
      if (gridRef.current) {
        gridRef.current.style.setProperty('--grid-columns', newColumnCount);
        console.log(`[ImageGridCSS] CSS property updated to: ${newColumnCount}`);
      }
    } else {
      console.log(`[ImageGridCSS] No change needed - staying at ${currentColumnCount} columns`);
    }
  }, []);

  useEffect(() => {
    // 客戶端掛載後設置正確的列數
    const initialColumnCount = getColumnCount();
    console.log(`[ImageGridCSS] Initial setup - Column count: ${initialColumnCount}`);
    setColumnCount(initialColumnCount);
    columnCountRef.current = initialColumnCount;
    setForceUpdate(prev => prev + 1);
    
    // 設置 CSS 自定義屬性
    if (gridRef.current) {
      gridRef.current.style.setProperty('--grid-columns', initialColumnCount);
      console.log(`[ImageGridCSS] CSS property set to: ${initialColumnCount}`);
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  // 處理圖片載入
  const handleImageLoad = (imageId) => {
    setLoadedImages(prev => new Set([...prev, imageId]));
  };

  // 將圖片分配到各列 - 使用 useMemo 確保在依賴項改變時重新計算
  const columns = useMemo(() => {
    console.log(`[ImageGridCSS] Redistributing ${list.length} images into ${columnCount} columns (forceUpdate: ${forceUpdate})`);
    const columnsArray = Array.from({ length: columnCount }, () => []);
    const columnHeights = Array(columnCount).fill(0);

    // 確保 list 是有效陣列
    if (!Array.isArray(list) || list.length === 0) {
      console.log(`[ImageGridCSS] No images to distribute`);
      return columnsArray;
    }

    list.forEach((image, index) => {
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
            {column.map((image) => (
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