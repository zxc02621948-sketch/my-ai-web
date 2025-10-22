'use client';

import React, { useRef, useEffect, useState } from 'react';

const MusicPreview = ({ music, className = '', onClick }) => {
  const audioRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const hoverTimeoutRef = useRef(null);

  useEffect(() => {
    // 檢測是否為行動裝置
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      // 如果播放超過 3 秒，重新開始循環
      if (audio.currentTime >= 3) {
        audio.currentTime = 0;
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      // 使用 Promise 來處理播放，避免中斷錯誤
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            // 播放成功
          })
          .catch((error) => {
            // 播放被中斷或失敗，忽略錯誤
            if (error.name !== 'AbortError' && error.name !== 'NotAllowedError') {
              console.error('音頻播放錯誤:', error);
            }
          });
      }
    } else {
      audio.pause();
      audio.currentTime = 0;
    }
  }, [isPlaying]);

  const handleMouseEnter = () => {
    if (!isMobile) {
      // 清除之前的 timeout
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      
      setIsHovered(true);
      
      // 延遲一小段時間再開始播放，避免快速滑過時觸發
      hoverTimeoutRef.current = setTimeout(() => {
        setIsPlaying(true);
      }, 150); // 150ms 延遲
    }
  };

  const handleMouseLeave = () => {
    if (!isMobile) {
      // 清除 timeout
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      
      setIsHovered(false);
      setIsPlaying(false);
    }
  };

  // 清理 timeout
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const handleClick = () => {
    // 暫停預覽音頻
    setIsPlaying(false);
    if (onClick) onClick();
  };

  return (
    <div 
      className={`aspect-square bg-zinc-700 relative overflow-hidden ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {/* 背景圖片或音樂封面 */}
      <div 
        className="w-full h-full bg-gradient-to-br from-purple-600 via-pink-600 to-blue-600 flex items-center justify-center"
        style={{
          filter: isHovered ? 'brightness(1.1) saturate(1.2)' : 'brightness(1) saturate(1)',
          transform: isHovered ? 'scale(1.02)' : 'scale(1)',
        }}
      >
        {/* 音樂圖標 */}
        <div className="text-white text-6xl opacity-80">
          🎵
        </div>
      </div>

      {/* 音頻元素（隱藏） */}
      <audio
        ref={audioRef}
        src={music.musicUrl}
        preload="metadata"
        muted
        loop
      />
      
      {/* 播放按鈕覆蓋層 */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className={`bg-black bg-opacity-60 rounded-full p-4 transition-all duration-300 ${
          isHovered ? 'bg-opacity-40 scale-110' : 'bg-opacity-60 scale-100'
        }`}>
          <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </div>
      </div>

      {/* 預覽指示器 */}
      {isPlaying && (
        <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          播放中
        </div>
      )}

      {/* 音樂時長標籤 */}
      {music.duration > 0 && (
        <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm text-white text-xs px-2 py-1 rounded">
          {music.duration}秒
        </div>
      )}

      {/* 音樂資訊覆蓋層 - 只在 hover 時顯示 */}
      <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 transition-all duration-300 ${
        isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}>
        <div className="text-white">
          <h3 className="font-semibold text-sm mb-2 line-clamp-2">
            {music.title}
          </h3>
          <div className="flex items-center justify-between text-xs text-gray-300">
            <span>@{music.authorName}</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span>❤️</span>
                <span>{music.likesCount || 0}</span>
              </span>
              <span className="flex items-center gap-1">
                <span>🎵</span>
                <span>{music.plays || 0}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MusicPreview;

