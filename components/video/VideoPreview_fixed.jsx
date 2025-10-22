'use client';

import React, { useRef, useEffect, useState, memo } from 'react';
import { Heart } from 'lucide-react';

const VideoPreview = memo(({ video, className = '', onClick, currentUser, isLiked, onToggleLike, onLikeUpdate }) => {
  const videoRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const hoverTimeoutRef = useRef(null);
  
  // 愛心相關狀態
  const canLike = !!currentUser;
  const [isLikedLocal, setIsLikedLocal] = useState(isLiked);
  const [likeCountLocal, setLikeCountLocal] = useState(
    Array.isArray(video?.likes) ? video.likes.length : (video?.likesCount || 0)
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [renderKey, setRenderKey] = useState(0);

  useEffect(() => {
    // 檢測是否為行動裝置
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 同步愛心狀態
  useEffect(() => {
    setIsLikedLocal(isLiked);
    setLikeCountLocal(
      Array.isArray(video?.likes) ? video.likes.length : (video?.likesCount || 0)
    );
  }, [isLiked, video?.likes, video?.likesCount, video?._id]);

  // 監聽全域同步事件
  useEffect(() => {
    const onLiked = (e) => {
      const updated = e.detail;
      if (!updated || updated._id !== video?._id) return;

      const likesArr = Array.isArray(updated.likes) ? updated.likes : [];
      const meLiked = currentUser?._id ? likesArr.includes(currentUser._id) : false;

      setIsLikedLocal(meLiked);
      setLikeCountLocal(likesArr.length);
    };

    window.addEventListener('videoLiked', onLiked);
    return () => window.removeEventListener('videoLiked', onLiked);
  }, [video?._id, currentUser?._id]);

  // 愛心點擊處理
  const handleLikeClick = async (e) => {
    e.stopPropagation();
    
    if (!canLike || isProcessing) return;

    setIsProcessing(true);
    const newIsLiked = !isLikedLocal;
    const newLikeCount = newIsLiked ? likeCountLocal + 1 : likeCountLocal - 1;

    // 樂觀更新
    setIsLikedLocal(newIsLiked);
    setLikeCountLocal(newLikeCount);

    try {
      await onToggleLike(video._id, newIsLiked);
      
      // 觸發全域同步事件
      const updatedVideo = {
        ...video,
        likes: newIsLiked 
          ? [...(video.likes || []), currentUser._id]
          : (video.likes || []).filter(id => id !== currentUser._id),
        likesCount: newLikeCount
      };
      
      window.dispatchEvent(new CustomEvent('videoLiked', { detail: updatedVideo }));
      
      // 通知父組件
      if (onLikeUpdate) {
        onLikeUpdate(updatedVideo);
      }
    } catch (error) {
      console.error('愛心操作失敗:', error);
      // 回滾樂觀更新
      setIsLikedLocal(isLikedLocal);
      setLikeCountLocal(likeCountLocal);
    } finally {
      setIsProcessing(false);
    }
  };

  // 點擊處理
  const handleClick = () => {
    if (onClick) {
      onClick(video);
    }
  };

  // 滑鼠進入處理
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

  // 影片播放控制
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    if (isPlaying) {
      videoElement.play().catch(error => {
        console.warn('影片自動播放失敗:', error);
        setIsPlaying(false);
      });
    } else {
      videoElement.pause();
      videoElement.currentTime = 0;
    }
  }, [isPlaying]);

  // 計算影片比例
  const aspectRatio = video?.width && video?.height 
    ? `${video.width} / ${video.height}`
    : '16 / 9'; // 預設 16:9

  return (
    <div 
      className={`bg-zinc-700 relative overflow-hidden ${className}`}
      style={{
        aspectRatio: aspectRatio,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {/* 影片元素 */}
      <video
        ref={videoRef}
        src={video.videoUrl}
        className="w-full h-full object-cover transition-all duration-300"
        preload="metadata"
        muted
        loop
        playsInline
        style={{
          filter: isHovered ? 'brightness(1.1)' : 'brightness(1.05)',
          transform: isHovered ? 'scale(1.02)' : 'scale(1)',
        }}
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
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          預覽中
        </div>
      )}

      {/* 影片時長標籤 */}
      {video.duration > 0 && (
        <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm text-white text-xs px-2 py-1 rounded">
          {video.duration}秒
        </div>
      )}

      {/* 愛心按鈕 - 左上角 */}
      <div 
        className={`absolute top-2 left-2 z-10 bg-black/60 rounded-full px-2 py-1 flex items-center space-x-1 ${
          canLike ? "hover:scale-110 cursor-pointer" : "opacity-70"
        }`}
        onClick={handleLikeClick}
      >
        <Heart 
          className={`w-4 h-4 transition-colors ${
            isLikedLocal ? "fill-red-500 text-red-500" : "text-white"
          } ${isProcessing ? "opacity-50" : ""}`}
        />
        <span className="text-white text-xs font-medium">{likeCountLocal}</span>
      </div>

      {/* 影片資訊覆蓋層 - 只在 hover 時顯示 */}
      <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 transition-all duration-300 ${
        isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}>
        <div className="text-white">
          <h3 className="font-semibold text-sm mb-2 line-clamp-2">
            {video.title || '未命名影片'}
          </h3>
          
          {/* 作者資訊 */}
          {video.author && (
            <div className="flex items-center space-x-2 mb-2">
              {video.author.avatar && (
                <img 
                  src={video.author.avatar} 
                  alt={video.author.username}
                  className="w-6 h-6 rounded-full object-cover"
                />
              )}
              <span className="text-xs text-gray-300">@{video.author.username}</span>
            </div>
          )}
          
          {/* 標籤 */}
          {video.tags && video.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {video.tags.slice(0, 3).map((tag, index) => (
                <span 
                  key={index}
                  className="text-xs bg-white/20 px-2 py-1 rounded-full"
                >
                  #{tag}
                </span>
              ))}
              {video.tags.length > 3 && (
                <span className="text-xs text-gray-300">
                  +{video.tags.length - 3} 更多
                </span>
              )}
            </div>
          )}
          
          {/* 解析度資訊 */}
          {video.width && video.height && (
            <div className="text-xs text-gray-300">
              {video.width} × {video.height}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default VideoPreview;
