'use client';

import React, { useEffect, useState, useMemo } from 'react';
import MusicPreview from './MusicPreview';

export default function MusicGrid({
  music = [],
  onSelectMusic,
}) {
  const [columns, setColumns] = useState(5);
  const [columnArrays, setColumnArrays] = useState([]);

  // 監聽窗口大小變化，計算欄數
  useEffect(() => {
    const updateColumns = () => {
      const width = window.innerWidth;
      let newColumns;
      if (width >= 1536) {
        newColumns = 6; // 2xl - 音樂卡片更小，可以更多列
      } else if (width >= 1280) {
        newColumns = 5; // xl
      } else if (width >= 1024) {
        newColumns = 4; // lg
      } else if (width >= 768) {
        newColumns = 3; // md
      } else {
        newColumns = 2; // sm
      }
      
      setColumns(newColumns);
    };

    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  // 將音樂分配到各列（使用最短列優先演算法）
  useEffect(() => {
    if (!music || music.length === 0) {
      setColumnArrays([]);
      return;
    }

    const newColumnArrays = Array.from({ length: columns }, () => []);
    const columnHeights = Array(columns).fill(0);
    
    // 將音樂分配到最短的列
    music.forEach((track) => {
      // 找到最短的列
      const shortestColumnIndex = columnHeights.indexOf(Math.min(...columnHeights));
      newColumnArrays[shortestColumnIndex].push(track);
      
      // 估算音樂卡片高度（1:1 比例 - 正方形）
      const estimatedHeight = 280; // 固定高度
      columnHeights[shortestColumnIndex] += estimatedHeight;
    });

    setColumnArrays(newColumnArrays);
  }, [music, columns]);

  // 如果沒有音樂，顯示空狀態
  if (!music || music.length === 0) {
    return null;
  }

  return (
    <div className="music-grid-container">
      <style jsx>{`
        .music-grid-container {
          padding: 10px;
        }
        
        .music-grid {
          display: flex;
          gap: 16px;
          max-width: 100%;
          margin: 0 auto;
          align-items: flex-start;
        }
        
        .grid-column {
          width: calc((100% - ${(columns - 1) * 16}px) / ${columns});
          display: flex;
          flex-direction: column;
          gap: 16px;
          flex-shrink: 0;
        }
        
        .grid-item {
          width: 100%;
          overflow: hidden;
          border-radius: 12px;
          background: #27272a;
          transition: all 0.3s ease;
        }

        .grid-item:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px -10px rgba(139, 92, 246, 0.3);
        }
      `}</style>
      
      <div className="music-grid">
        {columnArrays.map((columnMusic, columnIndex) => (
          <div key={columnIndex} className="grid-column">
            {columnMusic.map((track) => (
              <div key={track._id} className="grid-item">
                <MusicPreview
                  music={track}
                  onClick={() => onSelectMusic?.(track)}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}



