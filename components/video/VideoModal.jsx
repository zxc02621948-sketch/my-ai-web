"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Heart } from "lucide-react";
import DesktopVideoRightPane from "./DesktopVideoRightPane";
import { usePortalContainer } from "@/components/common/usePortal";
import MobileVideoSheet from "./MobileVideoSheet";
import { useFollowState } from "@/hooks/useFollowState";
import { trackEvent } from "@/utils/analyticsQueue";

const VideoModal = ({ 
  video, 
  onClose, 
  currentUser,
  displayMode = "gallery",
  isFollowing,
  onFollowToggle,
  onUserClick,
  onDelete,
  canEdit = false,
  onEdit,
  isLiked,
  onToggleLike
}) => {
  const modalRef = useRef(null);
  const videoRef = useRef(null);
  const [videoState, setVideoState] = useState(video);
  const [isLikedLocal, setIsLikedLocal] = useState(isLiked);
  const [likeCount, setLikeCount] = useState(video?.likes?.length || 0);
  const viewedRef = useRef(new Set());
  const portalContainer = usePortalContainer();
  const [isMobile, setIsMobile] = useState(false);
  
  // ✅ 影片分析追蹤：播放相關狀態
  const bufferStartTimeRef = useRef(null);
  const totalBufferDurationRef = useRef(0);
  const bufferCountRef = useRef(0);
  const playStartTimeRef = useRef(null);
  const hasTrackedPlayStartRef = useRef(false);
  const abandonPointRef = useRef(null);
  const playCompleteTrackedRef = useRef(false); // ✅ 标记是否已记录播放完成
  const modalOpenTimeRef = useRef(null); // ✅ 记录弹窗打开时间
  const trackEventRef = useRef(trackEvent); // 保存 trackEvent 的引用

  // 確保 trackEventRef 始終指向最新的 trackEvent
  useEffect(() => {
    trackEventRef.current = trackEvent;
  }, []);
  const [touchOffsetX, setTouchOffsetX] = useState(0);
  const [isTouching, setIsTouching] = useState(false);
  const touchDataRef = useRef({
    startX: 0,
    startY: 0,
    isHorizontal: false,
    active: false,
  });

  // 當 props 的 video 改變時，更新內部 state
  useEffect(() => {
    setVideoState(video);
    
    // ✅ 影片切換時重置追蹤狀態
    if (video?._id) {
      hasTrackedPlayStartRef.current = false;
      playStartTimeRef.current = null;
      totalBufferDurationRef.current = 0;
      bufferCountRef.current = 0;
      bufferStartTimeRef.current = null;
      abandonPointRef.current = null;
      playCompleteTrackedRef.current = false; // ✅ 重置播放完成标记
      modalOpenTimeRef.current = Date.now(); // ✅ 记录弹窗打开时间
    }
  }, [video]);
  
  // ✅ 影片分析：追蹤播放事件
  useEffect(() => {
    if (!videoState?._id) {
      return;
    }

    let timeoutId = null;
    let cleanupFn = null;
    let retryCount = 0;
    const MAX_RETRIES = 10; // 最多重试10次（1秒）

    // 延迟检查，确保 video 元素已经渲染
    const checkAndSetup = () => {
      const videoElement = videoRef.current;
      if (!videoElement) {
        retryCount++;
        if (retryCount < MAX_RETRIES) {
          // 如果 video 元素还没加载，延迟重试
          timeoutId = setTimeout(checkAndSetup, 100);
        }
        return;
      }
      
      console.log('[VideoAnalytics] Setting up event listeners for video:', videoState._id);

      const handlePlay = () => {
        // 如果是新的播放周期（播放完成后重播），重置状态
        if (!hasTrackedPlayStartRef.current) {
          playStartTimeRef.current = Date.now();
          hasTrackedPlayStartRef.current = true;
          totalBufferDurationRef.current = 0;
          bufferCountRef.current = 0;
          bufferStartTimeRef.current = null; // ✅ 重置 buffer 开始时间
          playCompleteTrackedRef.current = false; // ✅ 重置播放完成标记
          abandonPointRef.current = null; // ✅ 重置放弃点
          
          console.log('[VideoAnalytics] play_start event:', videoState._id, 'currentTime:', videoElement.currentTime);
          if (typeof trackEventRef.current === 'function') {
            trackEventRef.current('video', {
              videoId: videoState._id,
              eventType: 'play_start',
            });
          } else {
            console.warn('[VideoAnalytics] trackEvent is not a function');
          }
        } else {
          // 如果已经记录过 play_start，可能是重播（loop），不重复记录
          console.log('[VideoAnalytics] play event but already tracked, currentTime:', videoElement.currentTime);
        }
      };

    const handlePause = () => {
      // ✅ 暂停时不记录 abandon，只在关闭弹窗时记录
      // 保存当前进度，用于关闭弹窗时记录放弃点
      if (videoElement && playStartTimeRef.current) {
        const progress = videoElement.duration > 0
          ? (videoElement.currentTime / videoElement.duration) * 100
          : 0;
        abandonPointRef.current = progress;
      }
    };

    const handleEnded = () => {
      console.log('[VideoAnalytics] handleEnded called:', {
        hasVideoElement: !!videoElement,
        hasTrackedPlayStart: hasTrackedPlayStartRef.current,
        videoId: videoState._id,
        duration: videoElement?.duration,
        currentTime: videoElement?.currentTime,
      });
      
      if (videoElement && hasTrackedPlayStartRef.current) {
        // ✅ 先发送 play_complete 事件，再重置状态
        console.log('[VideoAnalytics] play_complete event:', videoState._id, 'duration:', videoElement.duration, 'currentTime:', videoElement.currentTime);
        if (typeof trackEventRef.current === 'function') {
          trackEventRef.current('video', {
            videoId: videoState._id,
            eventType: 'play_complete',
            playProgress: 100,
          });
          console.log('[VideoAnalytics] play_complete event sent successfully');
        } else {
          console.warn('[VideoAnalytics] trackEvent is not a function in handleEnded');
        }
        
        // ✅ 重置所有狀態，包括 buffer 相關狀態，避免重播時誤判
        // ✅ 重置 hasTrackedPlayStartRef，让重播时能正确触发新的 play_start
        hasTrackedPlayStartRef.current = false;
        playStartTimeRef.current = null;
        totalBufferDurationRef.current = 0;
        bufferCountRef.current = 0;
        bufferStartTimeRef.current = null; // ✅ 重置 buffer 開始時間
      } else {
        console.warn('[VideoAnalytics] handleEnded called but conditions not met:', {
          hasVideoElement: !!videoElement,
          hasTrackedPlayStart: hasTrackedPlayStartRef.current,
        });
      }
    };

    const handleWaiting = () => {
      // ✅ 只在播放开始后才记录 buffering（避免初始加载时的 buffering 被误判）
      // ✅ 并且只在播放进度 > 0 时才记录（避免重播时的初始加载被误判）
      if (playStartTimeRef.current && !bufferStartTimeRef.current && videoElement.currentTime > 0) {
        bufferStartTimeRef.current = Date.now();
        bufferCountRef.current++;
      }
    };

    const handleCanPlay = () => {
      if (bufferStartTimeRef.current) {
        const bufferDuration = (Date.now() - bufferStartTimeRef.current) / 1000;
        totalBufferDurationRef.current += bufferDuration;
        
        if (typeof trackEventRef.current === 'function') {
          trackEventRef.current('video', {
            videoId: videoState._id,
            eventType: 'buffering',
            bufferDuration,
            bufferCount: bufferCountRef.current,
          });
        }
        
        bufferStartTimeRef.current = null;
      }
    };

    const handleError = (e) => {
      const errorCode = videoElement.error?.code;
      let errorType = 'unknown';
      if (errorCode === 1) errorType = 'MEDIA_ERR_ABORTED';
      else if (errorCode === 2) errorType = 'MEDIA_ERR_NETWORK';
      else if (errorCode === 3) errorType = 'MEDIA_ERR_DECODE';
      else if (errorCode === 4) errorType = 'MEDIA_ERR_SRC_NOT_SUPPORTED';
      
      if (typeof trackEventRef.current === 'function') {
        trackEventRef.current('video', {
          videoId: videoState._id,
          eventType: 'error',
          errorType,
          bufferDuration: totalBufferDurationRef.current,
          bufferCount: bufferCountRef.current,
        });
      }
    };

    const handleTimeUpdate = () => {
      // ✅ 使用 timeupdate 检测播放完成（因为 loop 属性可能影响 ended 事件）
      if (videoElement && hasTrackedPlayStartRef.current && !playCompleteTrackedRef.current && videoElement.duration > 0) {
        const progress = (videoElement.currentTime / videoElement.duration) * 100;
        
        // ✅ 调试：每 10% 记录一次进度
        if (progress > 0 && Math.floor(progress) % 10 === 0 && progress < 100) {
          console.log('[VideoAnalytics] timeupdate progress:', progress.toFixed(1) + '%', 'currentTime:', videoElement.currentTime.toFixed(2), 'duration:', videoElement.duration.toFixed(2));
        }
        
        // ✅ 当播放进度 >= 95% 时，认为播放完成（降低阈值，避免因为精度问题导致无法达到99%）
        if (progress >= 95) {
          console.log('[VideoAnalytics] play_complete detected via timeupdate:', videoState._id, 'progress:', progress.toFixed(2) + '%', 'duration:', videoElement.duration.toFixed(2), 'currentTime:', videoElement.currentTime.toFixed(2));
          
          // 标记已记录完成，避免重复记录
          playCompleteTrackedRef.current = true;
          abandonPointRef.current = 100;
          
          if (typeof trackEventRef.current === 'function') {
            trackEventRef.current('video', {
              videoId: videoState._id,
              eventType: 'play_complete',
              playProgress: 100,
            });
            console.log('[VideoAnalytics] play_complete event sent via timeupdate');
            
            // ✅ 重置状态，让重播时能正确触发新的 play_start
            hasTrackedPlayStartRef.current = false;
            playStartTimeRef.current = null;
            totalBufferDurationRef.current = 0;
            bufferCountRef.current = 0;
            bufferStartTimeRef.current = null;
          }
        }
      }
    };

      videoElement.addEventListener('play', handlePlay);
      videoElement.addEventListener('pause', handlePause);
      videoElement.addEventListener('ended', handleEnded);
      videoElement.addEventListener('waiting', handleWaiting);
      videoElement.addEventListener('canplay', handleCanPlay);
      videoElement.addEventListener('error', handleError);
      videoElement.addEventListener('timeupdate', handleTimeUpdate);
      
      // ✅ 如果视频已经自动播放，立即触发 play_start
      if (!videoElement.paused && !hasTrackedPlayStartRef.current) {
        console.log('[VideoAnalytics] Video already playing, triggering play_start manually');
        handlePlay();
      }

      // 保存清理函数
      cleanupFn = () => {
        videoElement.removeEventListener('play', handlePlay);
        videoElement.removeEventListener('pause', handlePause);
        videoElement.removeEventListener('ended', handleEnded);
        videoElement.removeEventListener('waiting', handleWaiting);
        videoElement.removeEventListener('canplay', handleCanPlay);
        videoElement.removeEventListener('error', handleError);
        videoElement.removeEventListener('timeupdate', handleTimeUpdate);
      };
    };

    // 立即尝试设置，如果失败会重试
    checkAndSetup();
    
    // 返回清理函数
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (cleanupFn && typeof cleanupFn === 'function') {
        cleanupFn();
      }
    };
  }, [videoState?._id]);

  useEffect(() => {
    setIsLikedLocal(isLiked);
  }, [isLiked]);

  useEffect(() => {
    setLikeCount(videoState?.likes?.length || 0);
  }, [videoState?.likes]);

  const ownerId = videoState?.author?._id || videoState?.author;

  const externalIsFollowing =
    typeof isFollowing === "boolean"
      ? isFollowing
      : videoState?.author?.isFollowing;

  const { authorFollowing, handleFollowToggle } = useFollowState({
    ownerId,
    currentUser,
    externalIsFollowing,
    onFollowToggle,
    onLocalUpdate: (next) =>
      setVideoState((prev) =>
        prev
          ? {
              ...prev,
              author: prev.author
                ? { ...prev.author, isFollowing: next }
                : prev.author,
            }
          : prev
      ),
  });

  useEffect(() => {
    const updateIsMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    updateIsMobile();
    window.addEventListener("resize", updateIsMobile);
    return () => window.removeEventListener("resize", updateIsMobile);
  }, []);

  // ✅ 記錄點擊（每次打開影片時調用一次），並更新本地 state
  useEffect(() => {
    const videoId = videoState?._id;
    if (!videoId) return;

    // 避免同一個影片在同一次開啟中被重複計分
    if (viewedRef.current.has(videoId)) return;
    viewedRef.current.add(videoId);

    fetch(`/api/videos/${videoId}/click`, { method: "POST" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.ok) return;
        // 把 server 更新後的 clicks / likesCount / popScore 回寫到當前 video
        setVideoState((prev) =>
          prev && prev._id === videoId
            ? {
                ...prev,
                clicks: data.clicks ?? prev.clicks,
                views: data.views ?? prev.views,
                likesCount: data.likesCount ?? prev.likesCount,
                popScore: data.popScore ?? prev.popScore,
              }
            : prev
        );
      })
      .catch(() => {});
  }, [videoState?._id]);

  useEffect(() => {
    // 禁止背景滾動
    document.body.style.overflow = 'hidden';
    
    // ESC 鍵關閉
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleEsc);

    return () => {
      document.body.style.overflow = 'unset';
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  // ✅ 關閉彈窗時記錄觀看數據
  const handleClose = () => {
    const videoElement = videoRef.current;
    // 計算觀看時長和進度
    if (videoElement && modalOpenTimeRef.current && typeof trackEventRef.current === 'function') {
      const watchDuration = (Date.now() - modalOpenTimeRef.current) / 1000; // 秒
      const progress = videoElement.duration > 0
        ? (videoElement.currentTime / videoElement.duration) * 100
        : 0;
      
      // ✅ 記錄觀看數據（包括時長和進度）
      // 注意：如果進度接近 0 且時長很短，可能是重播後的起點，需要特殊處理
      const isAtStart = progress < 5 && videoElement.currentTime < 1;
      const actualProgress = isAtStart && abandonPointRef.current !== null 
        ? abandonPointRef.current // 使用之前記錄的進度
        : progress;
      
      console.log('[VideoAnalytics] watch data on close:', videoState._id, {
        watchDuration: watchDuration.toFixed(1) + 's',
        progress: actualProgress.toFixed(1) + '%',
        isAtStart,
      });
      
      trackEventRef.current('video', {
        videoId: videoState._id,
        eventType: 'abandon', // 保持原有事件类型，但包含更多数据
        abandonPoint: actualProgress,
        playProgress: actualProgress,
        watchDuration, // ✅ 新增：觀看時長
      });
    }
    onClose();
  };

  // 點擊背景關閉
  const handleBackdropClick = (e) => {
    if (e.target === modalRef.current) {
      handleClose();
    }
  };

  // 處理愛心點擊
  const handleLikeClick = async (e) => {
    e?.stopPropagation();
    if (!currentUser || !onToggleLike) return;

    // 樂觀更新 UI
    setIsLikedLocal(!isLikedLocal);
    setLikeCount(prev => isLikedLocal ? prev - 1 : prev + 1);

    try {
      await onToggleLike(videoState._id);
      
      // ✅ 影片分析：追蹤點讚事件
      if (videoState?._id && typeof trackEventRef.current === 'function') {
        trackEventRef.current('video', {
          videoId: videoState._id,
          eventType: 'like',
        });
      }
    } catch (error) {
      // 如果失敗，回滾狀態
      setIsLikedLocal(isLikedLocal);
      setLikeCount(prev => isLikedLocal ? prev + 1 : prev - 1);
      console.error('愛心切換失敗:', error);
    }
  };

  const resetTouchState = () => {
    touchDataRef.current = {
      startX: 0,
      startY: 0,
      isHorizontal: false,
      active: false,
    };
    setIsTouching(false);
    setTouchOffsetX(0);
  };

  const handleTouchStart = (e) => {
    if (!isMobile || e.touches.length !== 1) return;

    const target = e.target;
    if (
      target.closest?.('[data-stop-swipe]') ||
      target.closest?.('video') ||
      target.closest?.('iframe') ||
      target.closest?.('button')
    ) {
      touchDataRef.current = {
        startX: 0,
        startY: 0,
        isHorizontal: false,
        active: false,
      };
      setIsTouching(false);
      setTouchOffsetX(0);
      return;
    }

    const { clientX, clientY } = e.touches[0];
    touchDataRef.current = {
      startX: clientX,
      startY: clientY,
      isHorizontal: false,
      active: true,
    };
    setIsTouching(true);
    setTouchOffsetX(0);
  };

  const handleTouchMove = (e) => {
    if (!touchDataRef.current.active || !isMobile || e.touches.length !== 1) return;

    const { clientX, clientY } = e.touches[0];
    const dx = clientX - touchDataRef.current.startX;
    const dy = clientY - touchDataRef.current.startY;

    if (!touchDataRef.current.isHorizontal) {
      const isHorizontalGesture = Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10;
      touchDataRef.current.isHorizontal = isHorizontalGesture;
    }

    if (touchDataRef.current.isHorizontal) {
      if (e.cancelable) {
        e.preventDefault();
      }
      setTouchOffsetX(dx);
    }
  };

  const handleTouchEnd = () => {
    if (!touchDataRef.current.active || !isMobile) {
      resetTouchState();
      return;
    }

    const shouldClose =
      touchDataRef.current.isHorizontal && Math.abs(touchOffsetX) > 80;

    if (shouldClose) {
      handleClose();
      resetTouchState();
    } else {
      setTouchOffsetX(0);
      setTimeout(() => {
        resetTouchState();
      }, 200);
    }
  };

  if (!portalContainer) return null;

  return createPortal(
    <div
      ref={modalRef}
      onClick={handleBackdropClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
    >
      <div
        className={`relative w-full max-w-5xl bg-[#1a1a1a] rounded-lg shadow-2xl overflow-hidden ${
          !isTouching ? 'transition-transform duration-200 ease-out' : ''
        }`}
        style={
          isMobile
            ? {
                transform: `translateX(${touchOffsetX}px)`,
                opacity: Math.max(0.2, 1 - Math.min(1, Math.abs(touchOffsetX) / 220)),
              }
            : undefined
        }
      >
        {isMobile ? (
          <MobileVideoSheet
            video={videoState}
            currentUser={currentUser}
            displayMode={displayMode}
            isFollowing={authorFollowing}
            onFollowToggle={handleFollowToggle}
            onUserClick={onUserClick}
            onClose={handleClose}
            onDelete={onDelete}
            canEdit={canEdit}
            onEdit={onEdit}
            isLiked={isLikedLocal}
            likeCount={likeCount}
            onLikeClick={handleLikeClick}
          />
        ) : (
          <div className="flex flex-row h-full">
            <div className="flex-1 relative bg-black flex items-center justify-center">
              {videoState?.streamId ? (
                <iframe
                  src={`https://iframe.cloudflarestream.com/${videoState.streamId}?autoplay=true&loop=true`}
                  className="w-full h-full max-h-[70vh] border-0"
                  allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                  allowFullScreen
                  onError={(e) => {
                    console.error('Stream 影片載入失敗:', e);
                    console.log('Stream ID:', videoState?.streamId);
                    console.log('播放 URL:', videoState?.videoUrl);
                  }}
                />
              ) : (
                <video
                  ref={videoRef}
                  src={videoState?.videoUrl}
                  controls
                  autoPlay
                  loop
                  className="w-full h-full max-h-[70vh] object-contain"
                  onError={(e) => {
                    console.error('影片載入失敗:', e);
                    console.log('影片 URL:', videoState?.videoUrl);
                    console.log('影片類型:', videoState?.videoUrl?.includes('r2.dev') ? 'R2 影片' : '其他');
                  }}
                  onLoadStart={() => {
                    console.log('開始載入影片:', videoState?.videoUrl);
                  }}
                  onCanPlay={() => {
                    console.log('影片可以播放:', videoState?.videoUrl);
                  }}
                  onPlay={() => {
                    // 事件已在 useEffect 中處理
                  }}
                  onPause={() => {
                    // 事件已在 useEffect 中處理
                  }}
                  onEnded={() => {
                    // 事件已在 useEffect 中處理
                  }}
                  onWaiting={() => {
                    // 事件已在 useEffect 中處理
                  }}
                />
              )}

              {currentUser && (
                <button
                  onClick={handleLikeClick}
                  className="absolute bottom-16 right-4 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-full p-3 transition-all duration-200 hover:scale-110 z-10"
                  title={isLikedLocal ? "取消愛心" : "點愛心"}
                  data-stop-swipe
                >
                  <Heart
                    size={24}
                    className={`transition-all duration-200 ${
                      isLikedLocal
                        ? "text-pink-400 fill-pink-400"
                        : "text-white"
                    }`}
                  />
                  {likeCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-pink-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                      {likeCount > 99 ? '99+' : likeCount}
                    </span>
                  )}
                </button>
              )}
            </div>

            <DesktopVideoRightPane
              video={videoState}
              currentUser={currentUser}
              displayMode={displayMode}
              isFollowing={authorFollowing}
              onFollowToggle={handleFollowToggle}
              onUserClick={onUserClick}
              onClose={handleClose}
              onDelete={onDelete}
              canEdit={canEdit}
              onEdit={onEdit}
              isLiked={isLiked}
              onToggleLike={onToggleLike}
            />
          </div>
        )}
      </div>
    </div>,
    portalContainer
  );
};

export default VideoModal;