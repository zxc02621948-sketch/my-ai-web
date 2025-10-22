'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X, Heart } from 'lucide-react';
import DesktopVideoRightPane from './DesktopVideoRightPane';

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

  useEffect(() => {
    setIsLikedLocal(isLiked);
  }, [isLiked]);

  useEffect(() => {
    setLikeCount(video?.likes?.length || 0);
  }, [video?.likes]);

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
    e.stopPropagation();
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

  return (
    <div
      ref={modalRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
    >
      <div className="relative w-full max-w-5xl bg-[#1a1a1a] rounded-lg shadow-2xl overflow-hidden">
        <div className="flex flex-col md:flex-row h-full">
          {/* 左側：影片播放器 */}
          <div className="flex-1 relative bg-black flex items-center justify-center">
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
                console.log('請檢查：');
                console.log('1. R2 Bucket 是否設定公開存取');
                console.log('2. 自訂域名是否正確設定');
                console.log('3. 直接在新分頁開啟 URL 測試：', video.videoUrl);
                
                // 測試檔案是否存在
                fetch(video.videoUrl, {method: 'HEAD'})
                  .then(response => {
                    console.log('檔案狀態:', response.status);
                    console.log('檔案存在:', response.ok);
                    if (!response.ok) {
                      console.error('檔案不存在或無法存取！');
                    }
                  })
                  .catch(error => {
                    console.error('檔案測試失敗:', error);
                  });
              }}
            />
            
            {/* 愛心按鈕 - 右下角（避開進度條） */}
            {currentUser && (
              <button
                onClick={handleLikeClick}
                className="absolute bottom-16 right-4 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-full p-3 transition-all duration-200 hover:scale-110 z-10"
                title={isLikedLocal ? "取消愛心" : "點愛心"}
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

          {/* 右側：影片資訊 - 使用新的組件 */}
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
      </div>
    </div>
  );
};

export default VideoModal;