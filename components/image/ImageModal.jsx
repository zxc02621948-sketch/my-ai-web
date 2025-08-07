// ImageModal.jsx
"use client";

import { Dialog } from "@headlessui/react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ImageViewer from "./ImageViewer";
import CommentBox from "./CommentBox";
import ImageInfoBox from "./ImageInfoBox";
import axios from "axios";

const defaultAvatarUrl =
  "https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/b479a9e9-6c1a-4c6a-94ff-283541062d00/public";

export default function ImageModal({
  imageData,
  onClose,
  currentUser,
  onLikeUpdate,
}) {
  const [image, setImage] = useState(imageData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const scrollRef = useRef(null);
  const router = useRouter();
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    if (!currentUser || !image?.user) return;
    const userId = image.user._id || image.user;
    setIsFollowing(currentUser.following?.includes(userId));
  }, [currentUser, image]);

  // ✅ 打開時重新抓最新圖片資料
  useEffect(() => {
    const fetchLatestImage = async () => {
      try {
        const res = await axios.get(`/api/image?id=${imageData._id}`);
        if (res.status === 200 && res.data) {
          setImage(res.data);
        } else {
          setImage(imageData); // fallback
        }
      } catch (err) {
        console.error("❌ 取得圖片最新資料失敗", err);
        setImage(imageData); // fallback
      } finally {
        setLoading(false);
      }
    };

    if (imageData?._id) {
      fetchLatestImage();
    }
  }, [imageData]);

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
    if (image?.user?._id) {
      router.push(`/user/${image.user._id}`);
      onClose();
    }
  };

  const handleDelete = async (imageId) => {
    const confirmed = window.confirm("你確定要刪除這張圖片嗎？");
    if (!confirmed) return;

    const match = document.cookie.match(/token=([^;]+)/);
    const token = match ? match[1] : null;

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

  if (!imageData) return null;

  return (
    <Dialog open={!!imageData} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-6xl bg-[#1a1a1a] text-white rounded-xl shadow-lg flex flex-col lg:flex-row overflow-hidden"
        >
          {/* 左側圖片區 */}
          <div className="flex-1 flex items-center justify-center p-4 overflow-hidden relative">
            <div style={{ zIndex: 10, position: "relative" }}>
              {loading ? (
                <div className="text-gray-400">載入中...</div>
              ) : error ? (
                <div className="text-red-500">{error}</div>
              ) : (
                <ImageViewer
                  key={image._id + "_" + (image._forceSync || 0)}
                  image={image}
                  currentUser={currentUser}
                  isLiked={image.likes.includes(currentUser?._id)}
                  onToggleLike={async () => {
                    try {
                      const token = document.cookie.match(/token=([^;]+)/)?.[1];
                      if (!token || !currentUser?._id) return;

                      const hasLiked = image.likes.includes(currentUser._id);
                      const newLikeState = !hasLiked;

                      // ✅ 樂觀更新
                      const optimisticLikes = newLikeState
                        ? [...image.likes, currentUser._id]
                        : image.likes.filter((id) => id !== currentUser._id);

                      const optimisticImage = {
                        ...image,
                        likes: optimisticLikes,
                      };
                      setImage(optimisticImage);
                      onLikeUpdate?.(optimisticImage);

                      // 真實請求
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
                        const updated = {
                          ...image,
                          likes: res.data.likes,
                        };
                        setImage(updated);
                        onLikeUpdate?.(updated);
                      }
                    } catch (err) {
                      console.error("❌ 點讚失敗", err);
                      const rolledBackLikes = image.likes.includes(currentUser._id)
                        ? image.likes.filter((id) => id !== currentUser._id)
                        : [...image.likes, currentUser._id];

                      const rolledBackImage = {
                        ...image,
                        likes: rolledBackLikes,
                      };
                      setImage(rolledBackImage);
                      onLikeUpdate?.(rolledBackImage);
                    }
                  }}
                />
              )}
            </div>
          </div>

          {/* 右側資訊與留言區 */}
          <div className="w-full lg:w-[400px] max-h-[90vh] border-l border-white/10 flex flex-col relative">
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 relative">
              {image && (
                <>
                  <div className="absolute top-15 right-10 flex flex-col items-center z-50">
                    <div onClick={handleUserClick} className="cursor-pointer">
                      <img
                        src={
                          image.user?.image
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
                      {image.user?.username || "未命名用戶"}
                    </span>
                    {currentUser &&
                      image?.user &&
                      currentUser._id !== (image.user._id || image.user) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFollowToggle();
                          }}
                          className={`mt-2 px-3 py-1 text-sm rounded ${
                            isFollowing
                              ? "bg-red-600 hover:bg-red-700"
                              : "bg-blue-600 hover:bg-blue-700"
                          }`}
                        >
                          {isFollowing ? "取消追蹤" : "追蹤作者"}
                        </button>
                      )}
                  </div>
                  <ImageInfoBox
                    image={{ ...image, user: image.user || image.userId }}
                    currentUser={currentUser}
                    onClose={onClose}
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
    </Dialog>
  );
}
