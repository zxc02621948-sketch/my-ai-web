'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Heart } from 'lucide-react';
import DesktopVideoRightPane from './DesktopVideoRightPane';
import { usePortalContainer } from '@/components/common/usePortal';
import MobileVideoSheet from './MobileVideoSheet';

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
  const [isLikedLocal, setIsLikedLocal] = useState(isLiked);
  const [likeCount, setLikeCount] = useState(video?.likes?.length || 0);
  const viewedRef = useRef(new Set());
  const portalContainer = usePortalContainer();
  const [isMobile, setIsMobile] = useState(false);
  const [touchOffsetX, setTouchOffsetX] = useState(0);
  const [isTouching, setIsTouching] = useState(false);
  const touchDataRef = useRef({
    startX: 0,
    startY: 0,
    isHorizontal: false,
    active: false,
  });

  useEffect(() => {
    setIsLikedLocal(isLiked);
  }, [isLiked]);

  useEffect(() => {
    setLikeCount(video?.likes?.length || 0);
  }, [video?.likes]);

  useEffect(() => {
    const updateIsMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    updateIsMobile();
    window.addEventListener('resize', updateIsMobile);
    return () => window.removeEventListener('resize', updateIsMobile);
  }, []);

  // ✅ 記錄點擊（每次打開影片時調用一次）
  useEffect(() => {
    const videoId = video?._id;
    if (!videoId) return;

    // 避免同一個影片在同一次開啟中被重複計分
    if (viewedRef.current.has(videoId)) return;
    viewedRef.current.add(videoId);

    fetch(`/api/videos/${videoId}/click`, { method: "POST" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.ok) {
          console.log('✅ 點擊已記錄:', data);
        }
      })
      .catch(() => {});
  }, [video?._id]);

  useEffect(() => {
    // 禁止背景滾動
    document.body.style.overflow = 'hidden';
    
    // ESC 鍵關閉
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);

    return () => {
      document.body.style.overflow = 'unset';
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  // 點擊背景關閉
  const handleBackdropClick = (e) => {
    if (e.target === modalRef.current) {
      onClose();
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
      await onToggleLike(video._id);
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
      onClose();
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
            video={video}
            currentUser={currentUser}
            displayMode={displayMode}
            isFollowing={isFollowing}
            onFollowToggle={onFollowToggle}
            onUserClick={onUserClick}
            onClose={onClose}
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
              {video.streamId ? (
                <iframe
                  src={`https://iframe.cloudflarestream.com/${video.streamId}?autoplay=true&loop=true`}
                  className="w-full h-full max-h-[70vh] border-0"
                  allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                  allowFullScreen
                  onError={(e) => {
                    console.error('Stream 影片載入失敗:', e);
                    console.log('Stream ID:', video.streamId);
                    console.log('播放 URL:', video.videoUrl);
                  }}
                />
              ) : (
                <video
                  ref={videoRef}
                  src={video.videoUrl}
                  controls
                  autoPlay
                  loop
                  className="w-full h-full max-h-[70vh] object-contain"
                  onError={(e) => {
                    console.error('影片載入失敗:', e);
                    console.log('影片 URL:', video.videoUrl);
                    console.log('影片類型:', video.videoUrl?.includes('r2.dev') ? 'R2 影片' : '其他');
                  }}
                  onLoadStart={() => {
                    console.log('開始載入影片:', video.videoUrl);
                  }}
                  onCanPlay={() => {
                    console.log('影片可以播放:', video.videoUrl);
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
              video={video}
              currentUser={currentUser}
              displayMode={displayMode}
              isFollowing={isFollowing}
              onFollowToggle={onFollowToggle}
              onUserClick={onUserClick}
              onClose={onClose}
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