'use client';

import React, { useEffect, useState, useMemo, memo } from 'react';
import VideoPreview from './VideoPreview';

const VideoGrid = memo(function VideoGrid({
  videos = [],
  onSelectVideo,
  currentUser,
  onToggleLike,
}) {
  const [columns, setColumns] = useState(5);

  // 監聽窗口大小變化，計算欄數
  useEffect(() => {
    const updateColumns = () => {
      const width = window.innerWidth;
      let newColumns;
      if (width >= 1536) {
        newColumns = 5; // 2xl
      } else if (width >= 1280) {
        newColumns = 4; // xl
      } else if (width >= 1024) {
        newColumns = 3; // lg
      } else if (width >= 768) {
        newColumns = 2; // md
      } else {
        newColumns = 2; // sm
      }
      
      setColumns(newColumns);
    };

    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  // 將影片分配到各列（使用最短列優先演算法）
  const videoColumns = useMemo(() => {
    if (!videos || videos.length === 0) {
      return [];
    }

    const newColumnArrays = Array.from({ length: columns }, () => []);
    const columnHeights = Array(columns).fill(0);
    
    // 將影片分配到最短的列
    videos.forEach((video) => {
      // 找到最短的列
      const shortestColumnIndex = columnHeights.indexOf(Math.min(...columnHeights));
      
      // 將影片添加到最短列
      newColumnArrays[shortestColumnIndex].push(video);
      
      // 更新該列的高度（假設每個影片有相同高度）
      columnHeights[shortestColumnIndex] += 1;
    });

    return newColumnArrays;
  }, [videos, columns]);

  // 愛心狀態更新處理
  const handleLikeUpdate = (updatedVideo) => {
    // 這裡可以添加額外的處理邏輯，比如更新本地狀態
    // 目前主要依賴於 VideoPreview 內部的樂觀更新
  };

  if (!videos || videos.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="text-gray-400 text-lg mb-2">暫無影片</div>
          <div className="text-gray-500 text-sm">請稍後再來查看</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {videoColumns.map((columnVideos, columnIndex) => (
          <div key={columnIndex} className="flex flex-col gap-4">
            {columnVideos.map((video) => (
              <div key={`video-${video._id}`} className="w-full">
                <VideoPreview
                  key={`preview-${video._id}`}
                  video={video}
                  onClick={onSelectVideo}
                  currentUser={currentUser}
                  isLiked={Array.isArray(video.likes) ? video.likes.includes(currentUser?._id) : false}
                  onToggleLike={onToggleLike}
                  onLikeUpdate={handleLikeUpdate}
                  className="w-full"
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
});

export default VideoGrid;
