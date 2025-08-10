"use client";

import { Dialog } from "@headlessui/react";
import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import ImageViewer from "./ImageViewer";
import CommentBox from "./CommentBox";
import ImageInfoBox from "./ImageInfoBox";
import axios from "axios";
import EditImageModal from "@/components/image/EditImageModal";

const defaultAvatarUrl =
  "https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/b479a9e9-6c1a-4c6a-94ff-283541062d00/public";

function getTokenFromCookie() {
  const match = typeof document !== "undefined" && document.cookie.match(/token=([^;]+)/);
  return match ? match[1] : "";
}

export default function ImageModal({ imageData, onClose, currentUser, onLikeUpdate }) {
  const [image, setImage] = useState(imageData);
  const [displayAuthor, setDisplayAuthor] = useState(() =>
    typeof imageData?.author === "string" ? imageData.author.trim() : ""
  );
  const [showScrollTop, setShowScrollTop] = useState(false);
  const scrollRef = useRef(null);
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    setImage(imageData);
    if (typeof imageData?.author === "string") {
      const next = imageData.author.trim();
      if (next !== displayAuthor) setDisplayAuthor(next);
    }
  }, [imageData]);

  useEffect(() => {
    const id = imageData?._id;
    if (!id) return;
    let aborted = false;
    (async () => {
      try {
        const res = await fetch(`/api/images/${id}`, { credentials: "include" });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok || !payload?.image || aborted) return;
        const full = payload.image;
        setImage((prev) => ({ ...prev, ...full }));
        if (typeof full?.author === "string") {
          const next = full.author.trim();
          if (next !== displayAuthor) setDisplayAuthor(next);
        }
      } catch (e) {
        console.warn("補抓圖片詳細資料失敗：", e);
      }
    })();
    return () => {
      aborted = true;
    };
  }, [imageData?._id]);

  const canEdit = useMemo(() => {
    if (!currentUser || !image) return false;
    const ownerId =
      typeof image.user === "string" ? image.user : image.user?._id || image.user?.id || null;
    return currentUser.isAdmin || (ownerId && String(ownerId) === String(currentUser._id));
  }, [currentUser, image]);

  const targetUserId = useMemo(() => {
    const u = image?.user || {};
    return (typeof u === "string" ? u : u?._id || u?.id) || image?.userId || null;
  }, [image]);

  const followingIds = useMemo(() => {
    if (!currentUser?.following) return [];
    return currentUser.following
      .map((f) => (typeof f === "string" ? f : f?.userId?._id || f?.userId || f?._id))
      .filter(Boolean)
      .map(String);
  }, [currentUser]);

  useEffect(() => {
    if (!targetUserId) return setIsFollowing(false);
    setIsFollowing(followingIds.includes(String(targetUserId)));
  }, [targetUserId, followingIds]);

  const handleScroll = () => {
    const top = scrollRef.current?.scrollTop || 0;
    setShowScrollTop(top > 200);
  };

  const handleScrollToTop = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  const handleUserClick = () => {
    const uid =
      typeof image?.user === "string"
        ? image.user
        : image?.user?._id || image?.user?.id || null;
    if (uid) {
      router.push(`/user/${uid}`);
      onClose();
    }
  };

  const handleDelete = async (imageId) => {
    const confirmed = window.confirm("你確定要刪除這張圖片嗎？");
    if (!confirmed) return;
    const token = getTokenFromCookie();
    try {
      const res = await axios.delete("/api/delete-image", {
        data: { imageId },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status < 200 || res.status >= 300) throw new Error("刪除失敗");
      alert("圖片刪除成功！");
      window.location.reload();
      onClose();
    } catch (err) {
      console.error("刪除圖片錯誤：", err);
      alert("刪除失敗，請稍後再試。");
    }
  };

  const handleFollowToggle = async () => {
    if (!currentUser) return alert("請先登入");
    if (!targetUserId || followLoading) return;
    setFollowLoading(true);
    setIsFollowing((prev) => !prev);
    try {
      const token = getTokenFromCookie();
      if (isFollowing) {
        await axios.delete("/api/follow", {
          data: { userIdToUnfollow: targetUserId },
          headers: {
            Authorization: token ? `Bearer ${token}` : undefined,
            "Content-Type": "application/json",
          },
        });
      } else {
        await axios.post(
          "/api/follow",
          { userIdToFollow: targetUserId },
          {
            headers: {
              Authorization: token ? `Bearer ${token}` : undefined,
              "Content-Type": "application/json",
            },
          }
        );
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("follow-changed", {
            detail: { targetUserId, isFollowing: !isFollowing },
          })
        );
      }
    } catch (err) {
      console.error("❌ 追蹤切換失敗：", err);
      setIsFollowing((prev) => !prev);
      alert("追蹤更新失敗");
    } finally {
      setFollowLoading(false);
    }
  };

  const handleImageUpdated = (updated) => {
    if (!updated) return;
    setImage((prev) => ({ ...prev, ...updated }));
    if (typeof updated?.author === "string") {
      const next = updated.author.trim();
      if (next !== displayAuthor) setDisplayAuthor(next);
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("image-updated", { detail: { image: updated } }));
    }
  };

  if (!imageData) return null;
  const likesArr = Array.isArray(image?.likes) ? image.likes : [];

  return (
    <Dialog
      open={!!imageData}
      onClose={() => {
        if (editOpen) return;
        onClose();
      }}
      className="relative z-50"
    >
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-6xl bg-[#1a1a1a] text-white rounded-xl shadow-lg flex flex-col lg:flex-row overflow-hidden"
        >
          <div className="flex-1 flex items-center justify-center p-4 overflow-hidden relative">
            <div style={{ zIndex: 10, position: "relative" }}>
              <ImageViewer
                key={image._id + "_" + likesArr.length}
                image={image}
                currentUser={currentUser}
                isLiked={likesArr.includes(currentUser?._id)}
                onToggleLike={async () => {
                  if (isProcessing || !currentUser?._id) return;
                  setIsProcessing(true);
                  try {
                    const token = getTokenFromCookie();
                    if (!token || !currentUser?._id) return;
                    const hasLiked = likesArr.includes(currentUser._id);
                    const newLikeState = !hasLiked;
                    const optimisticLikes = newLikeState
                      ? [...likesArr, currentUser._id]
                      : likesArr.filter((id) => id !== currentUser._id);
                    const optimisticImage = { ...image, likes: optimisticLikes };
                    setImage(optimisticImage);
                    onLikeUpdate?.(optimisticImage);
                    if (typeof window !== "undefined") {
                      window.dispatchEvent(
                        new CustomEvent("image-liked", { detail: { ...optimisticImage } })
                      );
                    }
                    const res = await axios.put(
                      `/api/like-image?id=${image._id}`,
                      { shouldLike: newLikeState },
                      {
                        headers: {
                          Authorization: `Bearer ${token}`,
                          "Content-Type": "application/json",
                        },
                      }
                    );
                    if (res.status === 200 && res.data) {
                      const updated = { ...image, likes: res.data.likes || [] };
                      setImage(updated);
                      onLikeUpdate?.(updated);
                      if (typeof window !== "undefined") {
                        window.dispatchEvent(
                          new CustomEvent("image-liked", { detail: { ...updated } })
                        );
                      }
                    }
                  } catch (err) {
                    console.error("❌ 點讚失敗", err);
                  } finally {
                    setTimeout(() => setIsProcessing(false), 1000);
                  }
                }}
              />
            </div>
          </div>
          <div className="w-full lg:w-[400px] max-h-[90vh] border-l border-white/10 flex flex-col relative">
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 relative">
              {image && (
                <>
                  <div className="absolute top-15 right-10 flex flex-col items-center z-10">
                    
                    <div onClick={handleUserClick} className="cursor-pointer">
                      <img
                        src={
                          (typeof image.user !== "string" && image.user?.image)
                            ? `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${image.user.image}/public`
                            : defaultAvatarUrl
                        }
                        alt="User Avatar"
                        className="w-20 h-20 rounded-full object-cover border border-white shadow"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = defaultAvatarUrl;
                        }}
                      />
                    </div>
                    <span className="text-sm mt-2 text-center text-white select-none">
                      {(typeof image.user !== "string" && image.user?.username) || "未命名用戶"}
                    </span>
                    {currentUser &&
                      image?.user &&
                      (String(currentUser._id) !== String(
                        typeof image.user === "string" ? image.user : image.user._id || image.user.id
                      )) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFollowToggle();
                          }}
                          disabled={followLoading}
                          className={`mt-2 px-3 py-1 text-sm rounded ${
                            isFollowing
                              ? "bg-red-600 hover:bg-red-700"
                              : "bg-blue-600 hover:bg-blue-700"
                          } ${followLoading ? "opacity-60 cursor-not-allowed" : ""}`}
                        >
                          {isFollowing ? "取消追蹤" : "追蹤作者"}
                        </button>
                      )}
                  </div>
                  <ImageInfoBox
                    image={{ ...image, user: image.user || image.userId, author: displayAuthor }}
                    currentUser={currentUser}
                    onClose={onClose}
                    onEdit={() => setEditOpen(true)}
                  />
                  <CommentBox currentUser={currentUser} imageId={image._id} />
                </>
              )}
            </div>
            {showScrollTop && (
              <button
                onClick={handleScrollToTop}
                className="absolute bottom-16 right-4 z-20 text-white bg-sky-400 hover:bg-gray-600 rounded-full w-10 h-10 text-xl flex items-center justify-center shadow"
                title="回到頂部"
              >
                ↑
              </button>
            )}
          </div>
        </Dialog.Panel>
      </div>
      {canEdit && (
        <EditImageModal
          imageId={image?._id}
          isOpen={editOpen}
          onClose={() => setEditOpen(false)}
          onImageUpdated={handleImageUpdated}
        />
      )}
    </Dialog>
  );
}
