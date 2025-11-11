"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Heart, X } from "lucide-react";
import AvatarFrame from "@/components/common/AvatarFrame";
import VideoInfoBox from "./VideoInfoBox";

export default function MobileVideoSheet({
  video,
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
  likeCount,
  onLikeClick,
}) {
  const ownerId = video?.author?._id || video?.author;
  const followLockRef = useRef(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [following, setFollowing] = useState(
    Boolean(isFollowing ?? video?.author?.isFollowing),
  );

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

  useEffect(() => {
    setFollowing(Boolean(isFollowing ?? video?.author?.isFollowing));
  }, [isFollowing, video?.author?.isFollowing]);

  const handleFollowToggleInternal = async () => {
    if (!ownerId || !currentUser || !onFollowToggle) return;
    if (followLoading || followLockRef.current) return;

    followLockRef.current = true;
    setFollowLoading(true);
    const next = !following;
    setFollowing(next);

    try {
      await onFollowToggle(ownerId, next);
    } catch (error) {
      console.error("追蹤切換失敗:", error);
      setFollowing(!next);
    } finally {
      setFollowLoading(false);
      setTimeout(() => {
        followLockRef.current = false;
      }, 1000);
    }
  };

  const avatarUrl = useMemo(() => {
    if (video?.authorAvatar) {
      return `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${video.authorAvatar}/public`;
    }
    if (typeof video?.author?.image === "string" && video.author.image.trim() !== "") {
      if (video.author.image.startsWith("http")) {
        return video.author.image;
      }
      return `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${video.author.image}/avatar`;
    }
    return null;
  }, [video?.authorAvatar, video?.author?.image]);

  if (!video) {
    return null;
  }

  const displayName =
    video?.authorName || video?.author?.username || "未命名用戶";

  const renderVideo = () => {
    if (video.streamId) {
      return (
        <iframe
          src={`https://iframe.cloudflarestream.com/${video.streamId}?autoplay=false&loop=true`}
          className="w-full h-full border-0"
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
          allowFullScreen
          title={video.title || "影片預覽"}
          data-stop-swipe
        />
      );
    }

    return (
      <video
        src={video.videoUrl}
        controls
        loop
        playsInline
        className="max-h-full w-full object-contain"
        style={{ maxHeight: "calc(var(--app-vh, 1vh) * 100)" }}
        onError={(e) => {
          console.error("影片載入失敗:", e);
        }}
        data-stop-swipe
      />
    );
  };

  return (
    <div
      className="md:hidden flex-1 overflow-y-auto snap-y snap-mandatory"
      style={{ maxHeight: "calc(var(--app-vh, 1vh) * 100)" }}
    >
      <section
        className="relative snap-start bg-black"
        style={{ minHeight: "calc(var(--app-vh, 1vh) * 100)" }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          {renderVideo()}
        </div>

        {currentUser && (
          <button
            onClick={onLikeClick}
            className="absolute bottom-16 right-4 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-full p-3 transition-all duration-200 hover:scale-110 z-20 text-white"
            title={isLiked ? "取消愛心" : "點愛心"}
            data-stop-swipe
          >
            <Heart
              size={24}
              className={isLiked ? "text-pink-400 fill-pink-400" : "text-white"}
            />
            {likeCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-pink-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {likeCount > 99 ? "99+" : likeCount}
              </span>
            )}
          </button>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose?.();
          }}
          className="absolute top-4 right-4 z-20 rounded-full bg-black/60 p-2 text-white backdrop-blur hover:bg-black/70 active:scale-95"
          aria-label="關閉"
          data-stop-swipe
        >
          <X size={20} />
        </button>
      </section>

      <section className="snap-start bg-zinc-950 text-zinc-100 border-t border-white/10">
        <div className="flex items-center justify-between px-4 pt-5 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <AvatarFrame
              src={avatarUrl}
              size={48}
              userId={ownerId}
              frameId={video?.author?.currentFrame || "default"}
              showFrame={true}
              onClick={onUserClick}
              frameColor={
                video?.author?.frameSettings?.[
                  video?.author?.currentFrame || "default"
                ]?.color || "#ffffff"
              }
              frameOpacity={
                video?.author?.frameSettings?.[
                  video?.author?.currentFrame || "default"
                ]?.opacity || 1
              }
              layerOrder={
                video?.author?.frameSettings?.[
                  video?.author?.currentFrame || "default"
                ]?.layerOrder || "frame-on-top"
              }
              frameTransparency={
                video?.author?.frameSettings?.[
                  video?.author?.currentFrame || "default"
                ]?.frameOpacity || 1
              }
            />
            <button
              type="button"
              onClick={onUserClick}
              className="text-left text-base font-medium hover:underline"
              title={displayName}
            >
              {displayName}
            </button>
          </div>

          {currentUser && ownerId && String(currentUser._id) !== String(ownerId) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleFollowToggleInternal();
              }}
              disabled={followLoading}
              className={`px-3 py-1.5 rounded-md text-sm text-white ${
                following ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
              } disabled:opacity-50 ${followLoading ? "pointer-events-none" : ""}`}
              title={following ? "取消追蹤" : "追蹤作者"}
              data-stop-swipe
            >
              {following ? "取消追蹤" : "追蹤作者"}
            </button>
          )}
        </div>

        <div className="px-4 pb-8">
          <VideoInfoBox
            video={video}
            currentUser={currentUser}
            displayMode={displayMode}
            onClose={onClose}
            onDelete={onDelete}
            canEdit={canEdit}
            onEdit={onEdit}
          />
        </div>
      </section>
    </div>
  );
}
