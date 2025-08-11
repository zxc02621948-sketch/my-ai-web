"use client";

import { Dialog } from "@headlessui/react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ImageViewer from "./ImageViewer";
import CommentBox from "./CommentBox";
import ImageInfoBox from "./ImageInfoBox";
import axios from "axios";

/**
 * 行動版：
 * - Dialog.Panel 自己是「唯一滾動容器」：height = 100 * --app-vh
 * - snap 兩段：①滿版圖片（ImageViewer），②資訊/留言
 * 桌機：維持左圖右資訊既有功能（追蹤、刪除、留言…）
 * 傳參：
 * - 支援 imageData（整包資料）或 imageId（由這裡 fetch）
 */

const defaultAvatarUrl =
  "https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/b479a9e9-6c1a-4c6a-94ff-283541062d00/public";

// 取得擁有者 ID（不論 user 是物件或字串）
const getOwnerId = (img) => {
  if (!img) return null;
  const u = img.user ?? img.userId;
  return typeof u === "string" ? u : u?._id ?? null;
};

export default function ImageModal({
  imageId,
  imageData, // 可直接帶整包圖片資料進來
  onClose,
  currentUser,
  onLikeUpdate,
}) {
  const [image, setImage] = useState(imageData || null);
  const [loading, setLoading] = useState(!imageData);
  const [error, setError] = useState(null);

  const [isFollowing, setIsFollowing] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const rightScrollRef = useRef(null);
  const router = useRouter();

  // 鎖住 body 捲動，避免與 Panel 雙重捲動
  useEffect(() => {
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = orig;
    };
  }, []);

  // --app-vh（以視窗實高為準，避免行動瀏覽器工具列誤差）
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

  // 載入圖片：優先用 imageData；否則用 imageId fetch
  useEffect(() => {
    if (imageData?._id) {
      setImage(imageData);
      setLoading(false);
      setError(null);
      return;
    }
    if (!imageId) return; // 沒有任何資訊就不啟動請求
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/images/${imageId}`);
        const data = await res.json();
        if (!res.ok) throw new Error("找不到該圖片，可能已被刪除");
        setImage(data.image);
        setError(null);
      } catch (err) {
        console.error("❌ 載入圖片失敗", err);
        setError(err.message || "載入失敗");
      } finally {
        setLoading(false);
      }
    })();
  }, [imageId, imageData]);

  // 如果 image.user 只有字串 ID，補抓作者資料（避免顯示未命名用戶／權限判斷失敗）
  useEffect(() => {
    if (!image) return;
    const u = image.user ?? image.userId;
    if (!u || typeof u !== "string") return; // 已是物件就不抓
    (async () => {
      try {
        // 優先嘗試抓使用者
        let userObj = null;
        try {
          const r = await fetch(`/api/user/${u}`);
          if (r.ok) {
            const data = await r.json();
            userObj = data?.user || data?.data || null;
          }
        } catch {}
        // 退而求其次：再打一次 images API（有的會 populate）
        if (!userObj && image?._id) {
          try {
            const r2 = await fetch(`/api/images/${image._id}`);
            if (r2.ok) {
              const d2 = await r2.json();
              userObj = d2?.image?.user || null;
            }
          } catch {}
        }
        if (userObj && typeof userObj === "object") {
          setImage((prev) => (prev ? { ...prev, user: userObj } : prev));
        }
      } catch {}
    })();
  }, [image]);

  // 追蹤狀態
  const ownerId = getOwnerId(image);
  useEffect(() => {
    if (!currentUser || !ownerId) return;
    setIsFollowing(!!currentUser.following?.includes(ownerId));
  }, [currentUser, ownerId]);

  const handleFollowToggle = async () => {
    if (!ownerId) return;
    try {
      if (isFollowing) {
        await axios.delete("/api/follow", { data: { userIdToUnfollow: ownerId } });
      } else {
        await axios.post("/api/follow", { userIdToFollow: ownerId });
      }
      setIsFollowing((v) => !v);
    } catch (err) {
      console.error("❌ 追蹤切換失敗", err);
    }
  };

  const handleUserClick = () => {
    if (ownerId) {
      router.push(`/user/${ownerId}`);
      onClose?.();
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("你確定要刪除這張圖片嗎？")) return;
    const token = document.cookie.match(/token=([^;]+)/)?.[1];
    try {
      const res = await axios.delete("/api/delete-image", {
        data: { imageId: id },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status < 200 || res.status >= 300) throw new Error("刪除失敗");
      alert("圖片刪除成功！");
      window.location.reload();
      onClose?.();
    } catch (err) {
      console.error("刪除圖片錯誤：", err);
      alert("刪除失敗，請稍後再試。");
    }
  };

  const isLikedByCurrent =
    Array.isArray(image?.likes) && currentUser?._id
      ? image.likes.includes(currentUser._id)
      : false;

  const toggleLikeOnServer = async () => {
    try {
      const token = document.cookie.match(/token=([^;]+)/)?.[1];
      if (!token || !currentUser?._id || !image?._id) return;
      const res = await axios.put(`/api/like-image?id=${image._id}`, null, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 200 && res.data) {
        const updated = { ...image, likes: res.data.likes };
        setImage(updated);
        onLikeUpdate?.(updated);
      }
    } catch (err) {
      console.error("❌ 點讚失敗", err);
    }
  };

  // 桌機右側面板滾動監聽（保留原功能）
  useEffect(() => {
    const el = rightScrollRef.current;
    if (!el) return;
    const onScroll = () => setShowScrollTop(el.scrollTop > 200);
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // fileUrl 供下載等用
  const fileUrl = image?.imageId
    ? `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${image.imageId}/public`
    : image?.imageUrl || "";

  // 供顯示的作者資訊（可能還在補抓中）
  const userObj = typeof image?.user === "object" ? image.user : null;
  const avatarUrl = userObj?.image
    ? `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${userObj.image}/public`
    : defaultAvatarUrl;
  const displayName = userObj?.username || "未命名用戶";
  const canEdit = !!currentUser?._id && !!ownerId && currentUser._id === ownerId;

  // 傳給子層使用的 user（確保有 _id）
  const userForChild = userObj || (ownerId ? { _id: ownerId } : undefined);

  return (
    <Dialog open={!!(imageId || imageData)} onClose={onClose} className="relative z-[99999]">
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />

      {/* Wrapper（點外面關閉） */}
      <div className="fixed inset-0 flex items-center justify-center p-0 md:p-4" onClick={onClose}>
        {/* Panel = 手機唯一滾動容器 + snap 兩段；桌機維持左右版 */}
        <Dialog.Panel
          onClick={(e) => e.stopPropagation()}
          className="
            relative w-full md:max-w-6xl
            bg-[#1a1a1a] text-white
            rounded-none md:rounded-xl shadow-lg
            overflow-y-auto md:overflow-hidden
            snap-y snap-mandatory md:snap-none
            flex flex-col md:flex-row
          "
          style={{
            height: "calc(var(--app-vh, 1vh) * 100)",
            maxHeight: "calc(var(--app-vh, 1vh) * 100)",
            WebkitOverflowScrolling: "touch",
            paddingTop: "max(env(safe-area-inset-top), 0px)",
            paddingBottom: "max(env(safe-area-inset-bottom), 0px)",
          }}
        >
          {/* ===== Mobile：Section 1 — 滿版圖片 ===== */}
          <section
            className="md:hidden snap-start relative"
            style={{ minHeight: "calc(var(--app-vh, 1vh) * 100)" }}
          >
            {loading ? (
              <div className="w-full h-full flex items-center justify-center text-gray-400">載入中...</div>
            ) : error ? (
              <div className="w-full h-full flex items-center justify-center text-red-500">{error}</div>
            ) : image ? (
              <ImageViewer
                image={image}
                currentUser={currentUser}
                isLiked={isLikedByCurrent}
                onToggleLike={toggleLikeOnServer}
                showClose
                onClose={onClose}
              />
            ) : null}

            {/* 上滑提示 */}
            <div className="absolute left-1/2 -translate-x-1/2 bottom-4 text-xs text-white/80">
              ↑ 上滑查看資訊
            </div>
          </section>

          {/* ===== Mobile：Section 2 — 資訊 & 留言 ===== */}
          <section className="md:hidden snap-start bg-zinc-950 text-zinc-100 border-t border-white/10">
            <div className="flex justify-center pt-3">
              <div className="h-1.5 w-12 rounded-full bg-white/20" />
            </div>
            {image && (
              <div className="p-4 space-y-4">
                {/* 作者＆追蹤 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={avatarUrl}
                      alt="User Avatar"
                      className="w-12 h-12 rounded-full object-cover border border-white/20 shadow"
                      onClick={handleUserClick}
                    />
                    <span className="text-sm">{displayName}</span>
                  </div>
                  {currentUser && ownerId && currentUser._id !== ownerId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFollowToggle();
                      }}
                      className={`px-3 py-1 text-sm rounded ${
                        isFollowing ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
                      }`}
                    >
                      {isFollowing ? "取消追蹤" : "追蹤作者"}
                    </button>
                  )}
                </div>

                {/* 詳細資訊（保留全部功能） */}
                <ImageInfoBox
                  image={{ ...image, user: userForChild }}
                  currentUser={currentUser}
                  onClose={onClose}
                  onDelete={handleDelete}
                  fileUrl={fileUrl}
                  canEdit={canEdit}
                />

                {/* 留言 */}
                <CommentBox currentUser={currentUser} imageId={image._id} />
              </div>
            )}
          </section>

          {/* ===== Desktop：維持原左右版 ===== */}
          <div className="hidden md:flex md:flex-row w-full">
            {/* 左：圖片區 */}
            <div className="flex-1 bg-black relative p-4 flex items-center justify-center">
              {loading ? (
                <div className="text-gray-400">載入中...</div>
              ) : error ? (
                <div className="text-red-500">{error}</div>
              ) : image ? (
                <ImageViewer
                  key={image._id + (Array.isArray(image.likes) ? image.likes.length : 0)}
                  image={image}
                  currentUser={currentUser}
                  isLiked={isLikedByCurrent}
                  onToggleLike={toggleLikeOnServer}
                />
              ) : null}
            </div>

            {/* 右：資訊區 */}
            <div className="w-full md:w-[400px] max-h-[90vh] border-l border-white/10 flex flex-col relative">
              <div ref={rightScrollRef} className="flex-1 overflow-y-auto p-4 relative">
                {image && (
                  <>
                    <div className="absolute top-15 right-10 flex flex-col items-center z-50">
                      <div onClick={handleUserClick} className="cursor-pointer">
                        <img
                          src={avatarUrl}
                          alt="User Avatar"
                          className="w-20 h-20 rounded-full object-cover border border-white shadow"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = defaultAvatarUrl;
                          }}
                        />
                      </div>
                      <span className="text-sm mt-2 text-center select-none">
                        {displayName}
                      </span>

                      {currentUser && ownerId && currentUser._id !== ownerId && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFollowToggle();
                          }}
                          className={`mt-2 px-3 py-1 text-sm rounded ${
                            isFollowing ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
                          }`}
                        >
                          {isFollowing ? "取消追蹤" : "追蹤作者"}
                        </button>
                      )}
                    </div>

                    <ImageInfoBox
                      image={{ ...image, user: userForChild }}
                      currentUser={currentUser}
                      onClose={onClose}
                      onDelete={handleDelete}
                      fileUrl={fileUrl}
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
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
