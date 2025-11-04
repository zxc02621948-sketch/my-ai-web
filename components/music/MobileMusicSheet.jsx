"use client";

import { useEffect, useRef, useState } from "react";
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
  // Audio 事件處理器
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
    music?.authorName || music?.author?.username || "未命名用戶";

  return (
    <>
      {/* ===== Mobile：Section 1 — 封面和播放器 ===== */}
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
                  title={isLikedLocal ? "取消按讚" : "點擊按讚"}
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

              {/* 播放器（疊加在封面底部） */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent pb-2 pt-6">
                <audio
                  ref={audioRef}
                  src={music.musicUrl}
                  controls
                  controlsList="nodownload nofullscreen noplaybackrate"
                  autoPlay
                  data-music-full-player="true"
                  className="w-full px-2"
                  onError={onAudioError}
                  onCanPlay={onAudioCanPlay}
                  onVolumeChange={onAudioVolumeChange}
                  onPlay={onAudioPlay}
                  onPause={onAudioPause}
                  onSeeked={onAudioSeeked}
                  onEnded={onAudioEnded}
                  onTimeUpdate={onAudioTimeUpdate}
                />
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
