"use client";

import { useEffect, useRef, useState } from "react";
import AvatarFrame from "@/components/common/AvatarFrame";
import MusicInfoBox from "./MusicInfoBox";

export default function DesktopMusicRightPane({
  music,
  currentUser,
  displayMode = "gallery",
  isFollowing,
  onFollowToggle,
  onUserClick,
  onClose,
  onDelete,
  canEdit,
  onEdit,
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
  const ownerId = music?.author?._id || music?.author;
  const [followLoading, setFollowLoading] = useState(false);
  const followLockRef = useRef(false);
  const [following, setFollowing] = useState(
    Boolean(isFollowing ?? music?.author?.isFollowing),
  );

  // props / 音樂切換時，同步目前狀態
  useEffect(() => {
    setFollowing(Boolean(isFollowing ?? music?.author?.isFollowing));
  }, [isFollowing, music?.author?.isFollowing, ownerId]);

  const handleFollowToggleInternal = async () => {
    if (followLoading || followLockRef.current || !ownerId || !currentUser)
      return;

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
      setTimeout(() => {
        followLockRef.current = false;
      }, 1000);
    }
  };

  // 頭像 URL
  const avatarUrl = (() => {
    if (music?.authorAvatar) {
      return `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${music.authorAvatar}/public`;
    }
    return null;
  })();

  const displayName =
    music?.authorName || music?.author?.username || "未命名用戶";

  return (
    <div className="w-full md:w-[400px] max-h-[90vh] border-l border-white/10 flex flex-col relative">
      <div ref={rightScrollRef} className="flex-1 overflow-y-auto p-4 relative">
        {music && (
          <>
            {/* 作者頭像列 */}
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <AvatarFrame
                  src={avatarUrl}
                  size={64}
                  userId={ownerId}
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
                <button
                  type="button"
                  onClick={onUserClick}
                  className="text-base font-medium hover:underline text-left"
                  title={displayName}
                >
                  <div className="text-white truncate max-w-[200px]">
                    {displayName}
                  </div>
                </button>
              </div>
              {currentUser &&
                ownerId &&
                String(currentUser._id) !== String(ownerId) && (
                  <button
                    onClick={handleFollowToggleInternal}
                    disabled={followLoading}
                    className={`px-3 py-1.5 rounded-md text-sm text-white ${
                      following ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
                    } disabled:opacity-50 ${followLoading ? "pointer-events-none" : ""}`}
                    title={following ? "取消追蹤" : "追蹤作者"}
                  >
                    {followLoading ? "..." : following ? "取消追蹤" : "追蹤作者"}
                  </button>
                )}
            </div>

            {/* 音樂資訊區 */}
            <MusicInfoBox
              music={music}
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

      {/* 返回頂部按鈕 */}
      {showScrollTop && (
        <button
          onClick={() => {
            rightScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="absolute bottom-4 right-4 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full shadow-lg transition-colors z-10"
          title="返回頂部"
        >
          <span className="text-xs">↑</span>
        </button>
      )}
    </div>
  );
}


