"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Heart } from "lucide-react";
import AvatarFrame from "@/components/common/AvatarFrame";
import MusicInfoBox from "./MusicInfoBox";

export default function MobileMusicSheet({
  music,
  audioRef,
  isMobile,
  currentUser,
  displayMode = "gallery",
  isFollowing,
  onFollowToggle,
  onUserClick,
  onClose,
  onDelete,
  canEdit,
  onEdit,
  isLiked,
  onToggleLike,
  likeCount,
  isLikedLocal,
  setIsLikedLocal,
  setLikeCount,
  handleLikeClick,
  // Audio 事件處理
  onAudioError,
  onAudioCanPlay,
  onAudioVolumeChange,
  onAudioPlay,
  onAudioPause,
  onAudioSeeked,
  onAudioEnded,
  onAudioTimeUpdate,
}) {
  const panelRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const progressBarRef = useRef(null);
  const isDraggingRef = useRef(false);

  // 格式化時間 (秒數轉換為 MM:SS)
  const formatTime = (seconds) => {
    if (!isFinite(seconds) || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // 更新當前時間
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (!isDraggingProgress) {
        setCurrentTime(audio.currentTime || 0);
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };

    const handleDurationChange = () => {
      setDuration(audio.duration || 0);
    };

    const handlePlay = () => {
      setIsPlaying(true);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);

    // 初始設置
    if (audio.duration) {
      setDuration(audio.duration);
    }

    // 初始檢查播放狀態
    setIsPlaying(!audio.paused);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
    };
  }, [audioRef, isDraggingProgress]);

  // 處理播放/暫停切換
  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      audio.play().catch((err) => {
        console.warn("播放失敗:", err);
      });
    } else {
      audio.pause();
    }
  };

  // 處理進度條點擊/拖動
  const handleProgressClick = useCallback((e) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;

    const rect = progressBarRef.current?.getBoundingClientRect();
    if (!rect) return;

    // 支援觸摸事件和鼠標事件
    // 對於 touch 事件，從 e.touches 獲取；對於 mouse 事件，從 e.clientX 獲取
    // 對於 touchmove，也可能從 changedTouches 獲取
    let clientX = 0;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
    } else if (e.changedTouches && e.changedTouches.length > 0) {
      clientX = e.changedTouches[0].clientX;
    } else if (e.clientX !== undefined) {
      clientX = e.clientX;
    } else {
      return; // 無法獲取位置
    }
    
    const clickX = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = percentage * duration;

    audio.currentTime = newTime;
    setCurrentTime(newTime);
    onAudioSeeked?.();
  }, [duration, onAudioSeeked]);

  // 處理進度條拖動開始
  const handleProgressMouseDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingRef.current = true;
    setIsDraggingProgress(true);
    handleProgressClick(e);
  }, [handleProgressClick]);

  // 處理進度條拖動結束
  const handleProgressMouseUp = useCallback(() => {
    isDraggingRef.current = false;
    setIsDraggingProgress(false);
  }, []);

  // 處理進度條拖動
  useEffect(() => {
    if (!isDraggingProgress) return;

    const handleMove = (e) => {
      if (!isDraggingRef.current) return;
      // 阻止默認行為，避免頁面滾動
      e.preventDefault();
      e.stopPropagation();
      handleProgressClick(e);
    };

    const handleEnd = (e) => {
      e.preventDefault();
      e.stopPropagation();
      isDraggingRef.current = false;
      setIsDraggingProgress(false);
    };

    document.addEventListener("mousemove", handleMove, { passive: false });
    document.addEventListener("mouseup", handleEnd, { passive: false });
    document.addEventListener("touchmove", handleMove, { passive: false });
    document.addEventListener("touchend", handleEnd, { passive: false });
    document.addEventListener("touchcancel", handleEnd, { passive: false });

    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleEnd);
      document.removeEventListener("touchmove", handleMove);
      document.removeEventListener("touchend", handleEnd);
      document.removeEventListener("touchcancel", handleEnd);
    };
  }, [isDraggingProgress, handleProgressClick]);

  // --app-vh 修正
  useEffect(() => {
    const setVH = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty("--app-vh", `${vh}px`);
    };
    setVH();
    window.addEventListener("resize", setVH);
    window.addEventListener("orientationchange", setVH);
    return () => {
      window.removeEventListener("resize", setVH);
      window.removeEventListener("orientationchange", setVH);
    };
  }, []);

  const ownerId = music?.author?._id || music?.author;
  const avatarUrl = (() => {
    if (music?.authorAvatar) {
      return `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${music.authorAvatar}/public`;
    }
    return null;
  })();

  const displayName =
    music?.authorName || music?.author?.username || "未知用戶";

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <>
      {/* ===== Mobile：Section 1 封面與播放器 ===== */}
      <section
        className="md:hidden snap-start relative flex flex-col items-center justify-center"
        style={{ minHeight: "calc(var(--app-vh, 1vh) * 100)" }}
        ref={panelRef}
      >
        <div className="flex-1 w-full flex items-center justify-center p-4">
          {/* 封面 */}
          <div className="relative w-full max-w-md">
            <div
              className={`aspect-square rounded-lg overflow-hidden shadow-2xl max-w-md mx-auto relative ${
                music.coverImageUrl
                  ? ""
                  : "bg-gradient-to-br from-purple-600 via-pink-600 to-blue-600"
              }`}
              style={
                music.coverImageUrl
                  ? {
                      backgroundImage: `url(${music.coverImageUrl})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      backgroundRepeat: "no-repeat",
                    }
                  : {}
              }
            >
              {music.coverImageUrl && (
                <img
                  src={music.coverImageUrl}
                  alt={music.title || "音樂封面"}
                  className="w-full h-full object-cover"
                />
              )}

              {/* 愛心按鈕 */}
              {currentUser && (
                <div
                  onClick={handleLikeClick}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleLikeClick(e);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className="absolute top-6 right-6 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-full p-3 transition-all duration-200 hover:scale-110 z-50 pointer-events-auto cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/50"
                  title={isLikedLocal ? "取消喜歡" : "點擊喜歡"}
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
                      {likeCount > 99 ? "99+" : likeCount}
                    </span>
                  )}
                </div>
              )}

              {/* 關閉按鈕 */}
              <button
                onClick={onClose}
                className="absolute top-6 left-6 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-full p-2 transition-all duration-200 hover:scale-110 z-50"
                aria-label="關閉"
              >
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>

              {/* 播放控制器與進度條 */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent pb-4 pt-8 px-4">
                {/* 音頻元素（隱藏原生控制條） */}
                <audio
                  ref={audioRef}
                  src={music.musicUrl}
                  controls={false}
                  autoPlay
                  data-music-full-player="true"
                  className="hidden"
                  onError={onAudioError}
                  onCanPlay={onAudioCanPlay}
                  onVolumeChange={onAudioVolumeChange}
                  onPlay={(e) => {
                    setIsPlaying(true);
                    onAudioPlay?.(e);
                  }}
                  onPause={(e) => {
                    setIsPlaying(false);
                    onAudioPause?.(e);
                  }}
                  onSeeked={onAudioSeeked}
                  onEnded={onAudioEnded}
                  onTimeUpdate={onAudioTimeUpdate}
                />

                {/* 自定義控制器 */}
                <div className="space-y-3">
                  {/* 播放/暫停按鈕和時間顯示 */}
                  <div className="flex items-center gap-3">
                    {/* 播放/暫停按鈕 */}
                    <button
                      onClick={handlePlayPause}
                      className="flex-shrink-0 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm flex items-center justify-center transition-all duration-200 active:scale-95"
                      aria-label={isPlaying ? "暫停" : "播放"}
                    >
                      {isPlaying ? (
                        <svg
                          className="w-5 h-5 text-white"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                        </svg>
                      ) : (
                        <svg
                          className="w-5 h-5 text-white ml-0.5"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      )}
                    </button>

                    {/* 時間顯示 */}
                    <div className="flex items-center justify-between flex-1 text-white text-sm">
                      <span>{formatTime(currentTime)}</span>
                      <span className="opacity-60">/</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>

                  {/* 進度條 */}
                  <div
                    ref={progressBarRef}
                    className="relative h-2 bg-white/20 rounded-full cursor-pointer group"
                    onClick={handleProgressClick}
                    onMouseDown={handleProgressMouseDown}
                    onMouseUp={handleProgressMouseUp}
                    onTouchStart={handleProgressMouseDown}
                    onTouchEnd={handleProgressMouseUp}
                    style={{ touchAction: 'none' }}
                  >
                    {/* 已播放進度 */}
                    <div
                      className="absolute left-0 top-0 h-full bg-white rounded-full transition-all duration-100"
                      style={{ width: `${progressPercentage}%` }}
                    />
                    {/* 拖動點 */}
                    <div
                      className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full transition-opacity ${
                        isDraggingProgress ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      }`}
                      style={{
                        left: `calc(${progressPercentage}% - 8px)`,
                        pointerEvents: "none",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Mobile：Section 2 — 資訊 & 留言 ===== */}
      <section className="md:hidden snap-start bg-zinc-950 text-zinc-100 border-t border-white/10">
        <div className="flex justify-center pt-3">
          <div className="h-1.5 w-12 rounded-full bg-white/20" />
        </div>
        {music && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AvatarFrame
                  src={avatarUrl}
                  size={48}
                  frameId={music?.author?.currentFrame || "default"}
                  showFrame={true}
                  onClick={onUserClick}
                  frameColor={
                    music?.author?.frameSettings?.[
                      music?.author?.currentFrame || "default"
                    ]?.color || "#ffffff"
                  }
                  frameOpacity={
                    music?.author?.frameSettings?.[
                      music?.author?.currentFrame || "default"
                    ]?.opacity || 1
                  }
                  layerOrder={
                    music?.author?.frameSettings?.[
                      music?.author?.currentFrame || "default"
                    ]?.layerOrder || "frame-on-top"
                  }
                  frameTransparency={
                    music?.author?.frameSettings?.[
                      music?.author?.currentFrame || "default"
                    ]?.frameOpacity || 1
                  }
                />
                <span className="text-sm">{displayName}</span>
              </div>
              {currentUser &&
                ownerId &&
                String(currentUser._id) !== String(ownerId) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onFollowToggle?.();
                    }}
                    className={`px-3 py-1 text-sm rounded ${
                      isFollowing
                        ? "bg-red-600 hover:bg-red-700"
                        : "bg-blue-600 hover:bg-blue-700"
                    }`}
                  >
                    {isFollowing ? "取消追蹤" : "追蹤作者"}
                  </button>
                )}
            </div>

            <MusicInfoBox
              music={music}
              currentUser={currentUser}
              displayMode={displayMode}
              onClose={onClose}
              onDelete={onDelete}
              canEdit={canEdit}
              onEdit={onEdit}
            />
          </div>
        )}
      </section>
    </>
  );
}
