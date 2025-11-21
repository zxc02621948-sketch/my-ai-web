'use client';

import React, { useRef, useEffect, useState, useMemo, memo, useCallback } from 'react';
import { Heart } from 'lucide-react';
import NewBadge from '@/components/image/NewBadge';
import FireEffect from '@/components/image/FireEffect';

const VideoPreview = memo(({ 
  video, 
  className = '', 
  onClick, 
  currentUser, 
  isLiked, 
  onToggleLike, 
  onLikeUpdate,
  showNewBadge = true,
}) => {
  const videoRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const hoverTimeoutRef = useRef(null);
  const mobilePreviewTimeoutRef = useRef(null);
  
  // 愛心相關狀態
  const canLike = !!currentUser;
  const [isLikedLocal, setIsLikedLocal] = useState(isLiked);
  const [likeCountLocal, setLikeCountLocal] = useState(
    Array.isArray(video?.likes) ? video.likes.length : (video?.likesCount || 0)
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [posterIndex, setPosterIndex] = useState(0);
  const [mobilePreviewActive, setMobilePreviewActive] = useState(false);
  const [hasTriggeredPreview, setHasTriggeredPreview] = useState(false);
  const mobileCanPlayHandlerRef = useRef(null);
  const desktopPreviewTimeoutRef = useRef(null);

  const cleanupMobileCanPlay = useCallback(() => {
    const handler = mobileCanPlayHandlerRef.current;
    const el = videoRef.current;
    if (handler && el) {
      el.removeEventListener('canplay', handler);
    }
    mobileCanPlayHandlerRef.current = null;
  }, []);

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
    setMobilePreviewActive(false);
    cleanupMobileCanPlay();
    if (mobilePreviewTimeoutRef.current) {
      clearTimeout(mobilePreviewTimeoutRef.current);
      mobilePreviewTimeoutRef.current = null;
    }
    if (desktopPreviewTimeoutRef.current) {
      clearTimeout(desktopPreviewTimeoutRef.current);
      desktopPreviewTimeoutRef.current = null;
    }
    setHasTriggeredPreview(false);
  }, [video?._id, cleanupMobileCanPlay]);

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
  const stopPreview = useCallback(({ resetTriggered = false } = {}) => {
    cleanupMobileCanPlay();
    if (mobilePreviewTimeoutRef.current) {
      clearTimeout(mobilePreviewTimeoutRef.current);
      mobilePreviewTimeoutRef.current = null;
    }
    if (desktopPreviewTimeoutRef.current) {
      clearTimeout(desktopPreviewTimeoutRef.current);
      desktopPreviewTimeoutRef.current = null;
    }
    setMobilePreviewActive(false);
    setIsPlaying(false);
    const el = videoRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
    if (resetTriggered) {
      setHasTriggeredPreview(false);
    }
  }, [cleanupMobileCanPlay]);

  const startMobilePreviewPlayback = useCallback(async () => {
    const el = videoRef.current;
    if (!el) return false;

    const attemptPlay = () => {
      try {
        const playPromise = el.play();
        if (playPromise && typeof playPromise.then === 'function') {
          return playPromise
            .then(() => true)
            .catch((err) => {
              console.warn('行動裝置預覽播放失敗:', err);
              stopPreview();
              return false;
            });
        }
        return Promise.resolve(true);
      } catch (err) {
        console.warn('行動裝置預覽播放錯誤:', err);
        stopPreview();
        return Promise.resolve(false);
      }
    };

    if (el.readyState >= 2) {
      return attemptPlay();
    }

    return new Promise((resolve) => {
      cleanupMobileCanPlay();
      const handler = async () => {
        cleanupMobileCanPlay();
        const result = await attemptPlay();
        resolve(result);
      };
      mobileCanPlayHandlerRef.current = handler;
      el.addEventListener('canplay', handler, { once: true });
      try {
        el.load();
      } catch (err) {
        console.warn('行動裝置預覽載入錯誤:', err);
        cleanupMobileCanPlay();
        resolve(false);
      }
    });
  }, [cleanupMobileCanPlay, stopPreview]);

  const startDesktopPreviewPlayback = useCallback(async () => {
    const el = videoRef.current;
    if (!el) return false;
    try {
      el.currentTime = 0;
      const playPromise = el.play();
      if (playPromise && typeof playPromise.then === 'function') {
        await playPromise;
      }
      desktopPreviewTimeoutRef.current = window.setTimeout(() => {
        stopPreview();
      }, 2500);
      return true;
    } catch (err) {
      console.warn('桌面預覽播放失敗:', err);
      stopPreview();
      return false;
    }
  }, [stopPreview]);

  const handlePreviewRequest = useCallback(async () => {
    if (!videoRef.current) return false;
    videoRef.current.currentTime = 0;
    const started = await startMobilePreviewPlayback();
    if (started) {
      const duration = Number.isFinite(video?.previewDuration)
        ? Math.max(200, Math.min(5000, video.previewDuration * 1000))
        : 2500;
      mobilePreviewTimeoutRef.current = window.setTimeout(() => {
        stopPreview();
      }, duration);
      return true;
    }
    return false;
  }, [startMobilePreviewPlayback, stopPreview, video?.previewDuration]);

  const handleClick = useCallback(async () => {
    if (isMobile) {
      if (!hasTriggeredPreview) {
        setMobilePreviewActive(true);
        setIsPlaying(true);
        const started = await handlePreviewRequest();
        if (!started) {
          setMobilePreviewActive(false);
          setIsPlaying(false);
        } else {
          setHasTriggeredPreview(true);
        }
        return;
      }
      if (mobilePreviewActive || isPlaying) {
        stopPreview();
      }
    }

    stopPreview();
    if (onClick) {
      onClick(video);
    }
  }, [
    handlePreviewRequest,
    hasTriggeredPreview,
    isMobile,
    mobilePreviewActive,
    onClick,
    stopPreview,
    video,
    isPlaying,
  ]);

  const handlePreviewButtonClick = useCallback(async (event) => {
    event.stopPropagation();
    if (isMobile) {
      if (mobilePreviewActive) {
        stopPreview();
        if (onClick) {
          onClick(video);
        }
        return;
      }
      setMobilePreviewActive(true);
      setIsPlaying(true);
      const started = await handlePreviewRequest();
      if (!started) {
        setMobilePreviewActive(false);
        setIsPlaying(false);
      }
    } else {
      if (isPlaying) {
        stopPreview();
        return;
      }
      const started = await startDesktopPreviewPlayback();
      if (started) {
        setIsPlaying(true);
      } else {
        setIsPlaying(false);
      }
    }
  }, [
    handlePreviewRequest,
    isMobile,
    isPlaying,
    mobilePreviewActive,
    startDesktopPreviewPlayback,
    stopPreview,
    onClick,
    video,
  ]);

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
      stopPreview({ resetTriggered: true });
    };
  }, [stopPreview]);

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

  const handlePosterError = () => {
    setPosterIndex((prev) => {
      if (prev < posterCandidates.length - 1) {
        return prev + 1;
      }
      return posterCandidates.length; // 使用預設佔位圖
    });
  };

  // 影片播放控制 - 預覽循環播放前 2 秒片段
  useEffect(() => {
    const videoElement = videoRef.current;
    const allowPlayback = !isMobile || mobilePreviewActive;
    if (!videoElement || !video.videoUrl || !allowPlayback) {
      if (videoElement) {
        videoElement.pause();
        videoElement.currentTime = 0;
      }
      return;
    }

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
  }, [isPlaying, video.videoUrl, isMobile, mobilePreviewActive]);

  // 計算影片比例
  // 橫向影片（寬 > 高）使用固定的 1:1 比例（正方形），讓縮圖更有競爭力
  // 其他比例的影片保持原樣
  const aspectRatio = (() => {
    if (video?.width && video?.height) {
      const isLandscape = video.width > video.height; // 橫向影片
      if (isLandscape) {
        return '1 / 1'; // 橫向影片固定為 1:1（正方形）
      }
      // 縱向或正方形影片保持原比例
      return `${video.width} / ${video.height}`;
    }
    // 沒有尺寸資訊時，預設為 16:9（橫向），使用 1:1
    return '1 / 1';
  })();

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
        <img
          src={currentPoster}
          alt={video.title || '影片縮圖'}
          className="w-full h-full object-cover object-center transition-all duration-300"
          style={{
            filter: isHovered ? 'brightness(1.1)' : 'brightness(1.05)',
            transform: isHovered ? 'scale(1.02)' : 'scale(1)',
          }}
          onError={handlePosterError}
          loading="lazy"
        />
      );
    }

    return (
      <div className="w-full h-full relative flex flex-col items-center justify-center bg-gradient-to-br from-zinc-800 via-zinc-900 to-black text-white/80">
        <div className="w-12 h-12 flex items-center justify-center rounded-full bg-white/10 mb-3">
          <svg
            className="w-6 h-6"
            fill="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
        <div className="text-sm font-medium tracking-wide">Video</div>
        <div className="text-xs text-white/50 mt-1">暫無預覽縮圖</div>
      </div>
    );
  };


  const baseVideoSource = useMemo(() => {
    if (video?.streamId) {
      if (video?.previewUrl) return video.previewUrl;
      if (video?.videoUrl) return video.videoUrl;
      return '';
    }
    return video?.videoUrl || '';
  }, [video?.streamId, video?.previewUrl, video?.videoUrl]);

  const showVideo = Boolean(baseVideoSource) && ((isMobile && mobilePreviewActive) || (!isMobile && isPlaying));
  const showTapHint = isMobile && !hasTriggeredPreview;

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
      {/* 縮圖層 */}
      <div className="absolute inset-0">
        {renderPosterImage()}
      </div>

      {/* 影片層 */}
      {baseVideoSource && (
        <video
          key={`${video._id}-${mobilePreviewActive ? 'playing' : 'idle'}`}
          ref={videoRef}
          src={baseVideoSource}
          className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-200 ${showVideo ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
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
      )}

      {/* 手機提示 */}
      {showTapHint && (
        <div className="absolute bottom-3 left-3 bg-black/70 text-white text-[11px] px-2 py-1 rounded-full z-50 pointer-events-none">
          點擊一次預覽
        </div>
      )}

      {/* 播放按鈕覆蓋層 */}
      <button
        type="button"
        onClick={handlePreviewButtonClick}
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-full p-4 transition-all duration-300 bg-black/60 hover:bg-black/40 focus:outline-none focus:ring-2 focus:ring-white/60 ${
          isHovered ? 'scale-110' : 'scale-100'
        }`}
        aria-label={isPlaying ? '停止預覽' : '播放預覽'}
      >
        <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z"/>
        </svg>
      </button>

      {/* NEW 徽章（左上角） */}
      {showNewBadge && isNew && (
        <div className="absolute left-2 top-2 z-20 pointer-events-none">
          <NewBadge animated />
        </div>
      )}

      {/* 加成券火焰效果（左下角） */}
      {video?.powerUsed && video?.powerExpiry && new Date(video.powerExpiry) > new Date() && (
        <FireEffect 
          powerExpiry={video.powerExpiry}
          powerType={video.powerType}
        />
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

        </div>
      </div>
    </div>
  );
});

export default VideoPreview;
