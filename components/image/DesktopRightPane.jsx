"use client";

import { useEffect, useRef, useState } from "react";
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
  isFollowing,
  onFollowToggle,
  onUserClick,
  onClose,
  onDelete,
  canEdit,
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

  const avatarUrl = image?.user?.image
    ? `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${image.user.image}/public`
    : "https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/b479a9e9-6c1a-4c6a-94ff-283541062d00/public";
  const displayName = image?.user?.username || "未命名用戶";
  const ownerId = typeof image?.user === "object" ? image.user._id : image?.user;

  return (
    <div className="w-full md:w-[400px] max-h-[90vh] border-l border-white/10 flex flex-col relative">
      <div ref={rightScrollRef} className="flex-1 overflow-y-auto p-4 relative">
        {image && (
          <>
            {/* 作者頭像列 */}
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <AvatarFrame src={avatarUrl} size={64} onClick={onUserClick} />
                <button
                  type="button"
                  onClick={onUserClick}
                  className="text-base font-medium hover:underline text-left"
                  title={displayName}
                >
                  {displayName}
                </button>
              </div>

              {currentUser && ownerId && currentUser._id !== ownerId && (
                <button
                  onClick={(e) => { e.stopPropagation(); onFollowToggle?.(); }}
                  className={`px-3 py-1.5 rounded-md text-sm ${
                    isFollowing ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {isFollowing ? "取消追蹤" : "追蹤作者"}
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
