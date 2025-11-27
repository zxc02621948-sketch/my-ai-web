"use client";

import { useEffect, useRef, useState } from "react";
import AvatarFrame from "@/components/common/AvatarFrame";
import VideoInfoBox from "./VideoInfoBox";

export default function DesktopVideoRightPane({
  video,
  currentUser,
  displayMode = "gallery",
  isFollowing,
  onFollowToggle,
  onUserClick,
  onClose,
  onDelete,
  canEdit,
  onEdit
}) {
  const rightScrollRef = useRef(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const el = rightScrollRef.current;
    if (!el) return;
    const onScroll = () => setShowScrollTop(el.scrollTop > 200);
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // ===== 追蹤狀態（樂觀 + 與外部同步） =====
  const ownerId = video?.author?._id || video?.author;
  const [followLoading, setFollowLoading] = useState(false);
  const followLockRef = useRef(false);
  const [following, setFollowing] = useState(
    Boolean(isFollowing ?? video?.author?.isFollowing)
  );

  // props / 影片切換時，同步目前狀態
  useEffect(() => {
    setFollowing(Boolean(isFollowing ?? video?.author?.isFollowing));
  }, [isFollowing, video?.author?.isFollowing, ownerId]);

  const handleFollowToggleInternal = async () => {
    if (followLoading || followLockRef.current || !ownerId || !currentUser) return;
    
    followLockRef.current = true;
    setFollowLoading(true);
    
    try {
      const newFollowing = !following;
      setFollowing(newFollowing);
      
      // 呼叫外部回調
      if (onFollowToggle) {
        await onFollowToggle(ownerId, newFollowing);
      }
    } catch (error) {
      console.error("追蹤切換失敗:", error);
      setFollowing(following); // 回滾狀態
    } finally {
      setFollowLoading(false);
      setTimeout(() => { followLockRef.current = false; }, 1000);
    }
  };

  // 頭像 URL（與 MobileVideoSheet 保持一致）
  const avatarUrl = (() => {
    // 優先使用 video.authorAvatar（影片上傳時保存的頭像）
    if (video?.authorAvatar) {
      return `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${video.authorAvatar}/public`;
    }
    // 其次使用 video.author.image（從 User 模型 populate 的頭像）
    if (typeof video?.author?.image === "string" && video.author.image.trim() !== "") {
      if (video.author.image.startsWith("http")) {
        return video.author.image;
      }
      // 如果是 Cloudflare Images ID，構建 URL
      return `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${video.author.image}/avatar`;
    }
    return null;
  })();
  
  const displayName = video?.authorName || video?.author?.username || "未命名用戶";

  return (
    <div className="w-full md:w-[400px] max-h-[90vh] border-l border-white/10 flex flex-col relative">
      <div ref={rightScrollRef} className="flex-1 overflow-y-auto p-4 relative">
        {video && (
          <>
            {/* 作者頭像列 */}
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <AvatarFrame
                  src={avatarUrl}
                  size={64}
                  userId={ownerId}
                  frameId={video?.author?.currentFrame || "default"}
                  showFrame={true}
                  onClick={onUserClick}
                  frameColor={video?.author?.frameSettings?.[video?.author?.currentFrame || "default"]?.color || "#ffffff"}
                  frameOpacity={video?.author?.frameSettings?.[video?.author?.currentFrame || "default"]?.opacity || 1}
                  layerOrder={video?.author?.frameSettings?.[video?.author?.currentFrame || "default"]?.layerOrder || "frame-on-top"}
                  frameTransparency={video?.author?.frameSettings?.[video?.author?.currentFrame || "default"]?.frameOpacity || 1}
                />
                <button
                  type="button"
                  onClick={onUserClick}
                  className="text-base font-medium hover:underline text-left"
                  title={displayName}
                >
                  {displayName}
                </button>
              </div>

              {currentUser && ownerId && String(currentUser._id) !== String(ownerId) && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleFollowToggleInternal(); }}
                  disabled={followLoading}
                  className={`px-3 py-1.5 rounded-md text-sm text-white ${
                    following ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
                  } disabled:opacity-50 ${followLoading ? "pointer-events-none" : ""}`}
                  title={following ? "取消追蹤" : "追蹤作者"}
                >
                  {following ? "取消追蹤" : "追蹤作者"}
                </button>
              )}
            </div>

            <VideoInfoBox
              video={video}
              currentUser={currentUser}
              displayMode={displayMode}
              onClose={onClose}
              onDelete={onDelete}
              canEdit={canEdit}
              onEdit={onEdit}
            />
          </>
        )}
      </div>

      {showScrollTop && (
        <button
          onClick={() => rightScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
          className="absolute bottom-16 right-4 z-20 text-white bg-sky-400 hover:bg-gray-600 rounded-full w-10 h-10 text-xl flex items-center justify-center shadow"
          title="回到頂部"
        >
          ↑
        </button>
      )}
    </div>
  );
}
