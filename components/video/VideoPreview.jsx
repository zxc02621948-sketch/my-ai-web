'use client';

import React, { useRef, useEffect, useState, useMemo, memo } from 'react';
import { Heart } from 'lucide-react';
import NewBadge from '@/components/image/NewBadge';

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
  const [posterIndex, setPosterIndex] = useState(0);
  const [posterDebug, setPosterDebug] = useState([]);

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

  useEffect(() => {
    setPosterIndex(0);
    setPosterDebug([]);
  }, [video?._id]);

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

  const posterCandidates = useMemo(() => {
    const sources = [];
    const push = (url) => {
      if (typeof url === 'string' && url.trim() && !sources.includes(url.trim())) {
        sources.push(url.trim());
      }
    };

    push(video?.thumbnailUrl);

    if (video?.streamId) {
      push(`https://customer-h5be4kbubhrszsgr.cloudflarestream.com/${video.streamId}/thumbnails/thumbnail.jpg?time=1s`);
      push(`https://videodelivery.net/${video.streamId}/thumbnails/thumbnail.jpg?time=1s`);
      push(`https://customer-h5be4kbubhrszsgr.cloudflarestream.com/${video.streamId}/thumbnails/thumbnail.jpg?height=720`);
    }

    return sources;
  }, [video?.thumbnailUrl, video?.streamId]);

  const currentPoster = posterCandidates[posterIndex] || '';

  const debugInfo = useMemo(() => ({
    id: video?._id || '(無)',
    streamId: video?.streamId || '(無)',
    videoUrl: video?.videoUrl || '',
    previewUrl: video?.previewUrl || '',
    thumbnailUrl: video?.thumbnailUrl || '',
    posterCandidates: posterCandidates.length,
    posterIndex,
  }), [video?._id, video?.streamId, video?.videoUrl, video?.previewUrl, video?.thumbnailUrl, posterCandidates.length, posterIndex]);

  const handlePosterError = () => {
    setPosterDebug(prev => {
      const source = posterCandidates[posterIndex] || '(空)';
      if (prev.includes(source)) return prev;
      return [...prev, source];
    });

    setPosterIndex((prev) => {
      if (prev < posterCandidates.length - 1) {
        return prev + 1;
      }
      return posterCandidates.length; // 標記為沒有可用縮圖
    });
  };

  useEffect(() => {
    if (posterCandidates.length === 0) {
      console.warn('[VideoPreview] 沒有可用縮圖來源', debugInfo);
    }
  }, [posterCandidates.length, debugInfo]);

  const renderDebugOverlay = (message) => (
    <div className="absolute inset-x-0 bottom-0 bg-black/75 text-[10px] text-yellow-300 px-2 py-1 space-y-0.5 pointer-events-none max-h-[45%] overflow-y-auto">
      <div>{message}</div>
      <div className="opacity-70 break-words">ID: {debugInfo.id}</div>
      <div className="opacity-70 break-words">streamId: {debugInfo.streamId}</div>
      <div className="opacity-70 break-words">videoUrl: {debugInfo.videoUrl ? '✅' : '❌'}</div>
      <div className="opacity-70 break-words">previewUrl: {debugInfo.previewUrl ? '✅' : '❌'}</div>
      <div className="opacity-70 break-words">thumbnailUrl: {debugInfo.thumbnailUrl ? '✅' : '❌'}</div>
      <div className="opacity-70 break-words">候選縮圖數量: {posterCandidates.length}</div>
      {posterDebug.length > 0 ? (
        <div className="opacity-70 break-words">
          失敗來源：
          {posterDebug.map((src, idx) => (
            <div key={idx} className="ml-2 break-words">{idx + 1}. {src}</div>
          ))}
        </div>
      ) : (
        <div className="opacity-70 break-words">目前尚無失敗來源紀錄</div>
      )}
    </div>
  );

  // 影片播放控制 - 預覽循環播放前 2 秒片段
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !video.videoUrl || isMobile) return;

    const handleTimeUpdate = () => {
      // 當播放超過 2 秒時，重新從頭開始（循環前 2 秒）
      if (videoElement.currentTime >= 2) {
        videoElement.currentTime = 0;
      }
    };

    if (isPlaying) {
      // 重置到開頭
      videoElement.currentTime = 0;
      
      // 添加時間更新監聽器，實現循環播放前 2 秒
      videoElement.addEventListener('timeupdate', handleTimeUpdate);
      
      videoElement.play().catch(error => {
        console.warn('影片自動播放失敗:', error);
        setIsPlaying(false);
      });
    } else {
      videoElement.pause();
      videoElement.currentTime = 0;
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
    }

    return () => {
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [isPlaying, video.videoUrl]);

  // 計算影片比例
  const aspectRatio = video?.width && video?.height 
    ? `${video.width} / ${video.height}`
    : '16 / 9'; // 預設 16:9

  // ✅ NEW 圖示判斷（< 10 小時）
  const getCreatedMsFromObjectId = (id) => {
    if (typeof id === "string" && id.length === 24) {
      const sec = parseInt(id.slice(0, 8), 16);
      if (!Number.isNaN(sec)) return sec * 1000;
    }
    return Date.now();
  };
  
  const createdMs = video?.createdAt ? new Date(video.createdAt).getTime() : getCreatedMsFromObjectId(video?._id);
  const isNew = (Date.now() - createdMs) / 36e5 < 10;

  const renderPosterImage = () => {
    if (currentPoster) {
      return (
        <>
          <img
            src={currentPoster}
            alt={video.title || '影片縮圖'}
            className="w-full h-full object-cover transition-all duration-300"
            style={{
              filter: isHovered ? 'brightness(1.1)' : 'brightness(1.05)',
              transform: isHovered ? 'scale(1.02)' : 'scale(1)',
            }}
            onError={handlePosterError}
            loading="lazy"
            crossOrigin="anonymous"
          />
          {posterDebug.length > 0 && renderDebugOverlay('⚠️ 部分縮圖載入失敗')}
        </>
      );
    }

    if (video?.videoUrl) {
      return (
        <>
          <video
            ref={videoRef}
            src={video.videoUrl}
            className="w-full h-full object-cover transition-all duration-300"
            preload="metadata"
            playsInline
            muted
            data-video-preview="true"
            style={{
              filter: isHovered ? 'brightness(1.08)' : 'brightness(1.02)',
              transform: isHovered ? 'scale(1.01)' : 'scale(1)',
            }}
          />
          {renderDebugOverlay('⚠️ 沒有縮圖，改顯示影片第一幀')}
        </>
      );
    }

    return (
      <>
        <div className="w-full h-full bg-zinc-600 flex items-center justify-center">
          <div className="text-white text-sm opacity-50">🎬 影片載入中...</div>
        </div>
        {renderDebugOverlay('⚠️ 沒有任何縮圖來源')}
      </>
    );
  };

  const renderStreamContent = () => {
    if (!video.streamId) return null;

    const shouldUsePreviewVideo = !isMobile && Boolean(video.previewUrl);

    if (shouldUsePreviewVideo) {
      return (
        <video
          ref={videoRef}
          src={video.previewUrl}
          className="w-full h-full object-cover transition-all duration-300"
          preload="metadata"
          muted
          playsInline
          data-video-preview="true"
          poster={posterCandidates[0] || undefined}
          style={{
            filter: isHovered ? 'brightness(1.1)' : 'brightness(1.05)',
            transform: isHovered ? 'scale(1.02)' : 'scale(1)',
          }}
        />
      );
    }

    if (!currentPoster && video?.videoUrl) {
      return (
        <>
          <video
            ref={videoRef}
            src={video.videoUrl}
            className="w-full h-full object-cover transition-all duration-300"
            preload="metadata"
            muted
            playsInline
            data-video-preview="true"
            style={{
              filter: isHovered ? 'brightness(1.1)' : 'brightness(1.05)',
              transform: isHovered ? 'scale(1.02)' : 'scale(1)',
            }}
          />
          {renderDebugOverlay('⚠️ Stream 沒有縮圖，改用影片 URL')}
        </>
      );
    }

    return renderPosterImage();
  };

  const renderRegularContent = () => {
    if (!video.videoUrl) {
      return renderPosterImage();
    }

    if (!isMobile || !currentPoster) {
      return (
        <video
          ref={videoRef}
          src={video.videoUrl}
          className="w-full h-full object-cover transition-all duration-300"
          preload="metadata"
          muted
          playsInline
          data-video-preview="true"
          poster={posterCandidates[0] || undefined}
          style={{
            filter: isHovered ? 'brightness(1.1)' : 'brightness(1.05)',
            transform: isHovered ? 'scale(1.02)' : 'scale(1)',
          }}
        />
      );
    }

    return renderPosterImage();
  };

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
      {/* 影片元素 / 縮圖 */}
      {video.streamId ? renderStreamContent() : renderRegularContent()}
      
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

      {/* NEW 徽章（左上角） */}
      {isNew && (
        <div className="absolute left-2 top-2 z-20 pointer-events-none">
          <NewBadge animated />
        </div>
      )}

      {/* 預覽指示器 - 中間上方 */}
      {isPlaying && (
        <div className="absolute top-3 left-1/2 transform -translate-x-1/2 bg-black/70 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg z-20">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          預覽中
        </div>
      )}

      {/* 影片時長標籤 - 移除顯示 */}
      {/* {video.duration > 0 && (
        <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm text-white text-xs px-2 py-1 rounded">
          {video.duration}秒
        </div>
      )} */}

      {/* 愛心按鈕 - 右上角 */}
      <div 
        className={`absolute top-2 right-2 z-10 bg-black/60 rounded-full px-2 py-1 flex items-center space-x-1 ${
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
