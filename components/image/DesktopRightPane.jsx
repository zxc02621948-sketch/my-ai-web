"use client";

import { useEffect, useRef, useState } from "react";
import axios from "axios";
import AvatarFrame from "@/components/common/AvatarFrame";
import ImageInfoBox from "./ImageInfoBox";
import CommentBox from "./CommentBox";

const fileUrlOf = (image) =>
  image?.imageId
    ? `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${image.imageId}/public`
    : image?.imageUrl || "";

export default function DesktopRightPane({
  image,
  currentUser,
  isFollowing,        // 仍支援父層傳入
  onFollowToggle,     // 仍支援回呼（選用）
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
  const ownerId =
    image?.user && typeof image.user === "object"
      ? (image.user._id ?? image.user.id ?? image.user.userId ?? null)
      : (image?.user ?? null);
  const [followLoading, setFollowLoading] = useState(false);
  const followLockRef = useRef(false);
  const [following, setFollowing] = useState(
    Boolean(isFollowing ?? image?.user?.isFollowing)
  );

  // props / 圖片切換時，同步目前狀態
  useEffect(() => {
    setFollowing(Boolean(isFollowing ?? image?.user?.isFollowing));
  }, [isFollowing, image?.user?.isFollowing, ownerId]);

  // 監聽其他元件（例如 UserHeader）的廣播
  useEffect(() => {
    const onChanged = (e) => {
      const { targetUserId, isFollowing: next } = e.detail || {};
      if (ownerId && String(targetUserId) === String(ownerId)) {
        setFollowing(Boolean(next));
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("follow-changed", onChanged);
      return () => window.removeEventListener("follow-changed", onChanged);
    }
  }, [ownerId]);

  // 追蹤/取消：委派給父層（若有），否則自己處理（fallback）
  async function handleFollowToggleInternal() {
    if (!currentUser || !ownerId) return;

    const willFollow = !following;

    // ✅ 有父層 handler（ImageModal）時：只做樂觀更新 + 委派，不自己打 API
    if (typeof onFollowToggle === "function") {
      setFollowing(willFollow);      // 樂觀顯示
      onFollowToggle(willFollow);    // 交給父層送 API & 同步
      return;
    }

    // ↓↓↓ 沒有父層 handler 才用本地 fallback（你原本的 axios 流程）
    if (followLockRef.current || followLoading) return;
    followLockRef.current = true;

    setFollowing(willFollow);
    setFollowLoading(true);

    try {
      const token = document.cookie.match(/token=([^;]+)/)?.[1];
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      if (willFollow) {
        await axios.post(
          "/api/follow",
          { userIdToFollow: ownerId },
          { headers, withCredentials: true }
        );
      } else {
        await axios.delete("/api/follow", {
          data: { userIdToUnfollow: ownerId },
          headers,
          withCredentials: true,
        });
      }

      // 廣播給其他地方同步（保持 window 與首頁一致）
      if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
        window.dispatchEvent(
          new CustomEvent("follow-changed", {
            detail: { targetUserId: String(ownerId), isFollowing: willFollow },
          })
        );
      }
    } catch (err) {
      setFollowing((prev) => !prev); // 失敗回滾
      console.error("[follow] failed:", err);
    } finally {
      setFollowLoading(false);
      setTimeout(() => { followLockRef.current = false; }, 300);
    }
  }

  const avatarUrl = image?.user?.image
    ? `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${image.user.image}/public`
    : "https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/b479a9e9-6c1a-4c6a-94ff-283541062d00/public";
  const displayName = image?.user?.username || "未命名用戶";

  return (
    <div className="w-full md:w-[400px] max-h-[90vh] border-l border-white/10 flex flex-col relative">
      <div ref={rightScrollRef} className="flex-1 overflow-y-auto p-4 relative">
        {image && (
          <>
            {/* 作者頭像列 */}
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <AvatarFrame
                  src={avatarUrl}
                  size={64}
                  userId={ownerId}
                  onClick={onUserClick}
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

            <ImageInfoBox
              image={image}
              currentUser={currentUser}
              onClose={onClose}
              onDelete={onDelete}
              fileUrl={fileUrlOf(image)}
              canEdit={canEdit}
              onEdit={onEdit}
            />
            <CommentBox currentUser={currentUser} imageId={image._id} />
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
