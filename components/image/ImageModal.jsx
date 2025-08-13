"use client";

import { Dialog } from "@headlessui/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ImageViewer from "./ImageViewer";
import MobileImageSheet from "@/components/image/MobileImageSheet";
import DesktopRightPane from "@/components/image/DesktopRightPane";
import axios from "axios";
import { getLikesFromCache } from "@/lib/likeSync";

const getOwnerId = (img) => {
  if (!img) return null;
  const u = img.user ?? img.userId;
  return typeof u === "string" ? u : u?._id ?? null;
};

const inFollowing = (list, uid) =>
  Array.isArray(list) &&
  list.some((f) => {
    const id = typeof f === "object" && f !== null ? f.userId : f;
    return String(id) === String(uid);
  });

export default function ImageModal({
  imageId,
  imageData,
  prevImage,
  nextImage,
  onClose,
  currentUser,
  onLikeUpdate,
  onNavigate,
  onFollowChange,     // 父層回寫 currentUser.following
  followOverrides,    // Map: userId -> boolean（前端優先生效）
}) {
  const router = useRouter();

  const [image, setImage] = useState(imageData || null);
  const [loading, setLoading] = useState(!imageData);
  const [error, setError] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);

  // 載入圖片（若只有 id）
  useEffect(() => {
    if (imageData?._id) {
      setImage(imageData);
      setLoading(false);
      setError(null);
      return;
    }
    if (!imageId) return;

    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/images/${imageId}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error("找不到該圖片，可能已被刪除");
        if (alive) {
          setImage(data.image);
          setError(null);
        }
      } catch (err) {
        if (alive) setError(err.message || "載入失敗");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [imageId, imageData]);

  useEffect(() => {
    const id = image?._id || imageId || imageData?._id;
    if (!id) return;
    const cached = getLikesFromCache(id);
    if (cached && Array.isArray(cached)) {
      setImage((prev) => prev ? { ...prev, likes: cached, likesCount: cached.length } : prev);
    }
  }, [image?._id, imageId, imageData]);

  // 若 user 是字串 → 補抓作者物件
  useEffect(() => {
    if (!image) return;
    const u = image.user ?? image.userId;
    if (!u || typeof u !== "string") return;

    let alive = true;
    (async () => {
      try {
        let userObj = null;
        try {
          const r = await fetch(`/api/user/${u}`, { cache: "no-store" });
          if (r.ok) {
            const data = await r.json();
            userObj = data?.user || data?.data || null;
          }
        } catch {}
        if (!userObj && image?._id) {
          try {
            const r2 = await fetch(`/api/images/${image._id}`, { cache: "no-store" });
            if (r2.ok) {
              const d2 = await r2.json();
              userObj = d2?.image?.user || null;
            }
          } catch {}
        }
        if (alive && userObj && typeof userObj === "object") {
          setImage((prev) => (prev ? { ...prev, user: userObj } : prev));
        }
      } catch {}
    })();
    return () => { alive = false; };
  }, [image]);

  // 根據 followOverrides / currentUser.following 計算是否已追蹤（覆蓋優先）
  const ownerId = getOwnerId(image);
  useEffect(() => {
    if (!ownerId) return;
    const ov = followOverrides?.get?.(String(ownerId));
    if (typeof ov === "boolean") {
      setIsFollowing(ov);
    } else {
      setIsFollowing(inFollowing(currentUser?.following, ownerId));
    }
  }, [currentUser, ownerId, followOverrides]);

  // ✅ 追蹤切換（沿用你舊版：axios + userIdToFollow / userIdToUnfollow）
  const handleFollowToggle = async () => {
    if (!ownerId) return;
    const next = !isFollowing;

    // 樂觀先亮
    setIsFollowing(next);

    try {
      if (next) {
        await axios.post("/api/follow", { userIdToFollow: ownerId });
      } else {
        await axios.delete("/api/follow", { data: { userIdToUnfollow: ownerId } });
      }
      // 成功：通知父層同步 currentUser.following + 覆蓋表
      onFollowChange?.(String(ownerId), next);
    } catch (e) {
      // 失敗還原
      setIsFollowing(!next);
      console.error("❌ 追蹤切換失敗", e);
    }
  };

  // 點作者 → 進作者頁並關閉 modal
  const handleUserClick = () => {
    if (ownerId) {
      router.push(`/user/${ownerId}`);
      handleBackdropClick();
    }
  };

  // 刪除圖片（作者本人）
  const handleDelete = async (id) => {
    if (!window.confirm("你確定要刪除這張圖片嗎？")) return;
    try {
      const res = await fetch("/api/delete-image", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId: id }),
      });
      if (!res.ok) throw new Error("刪除失敗");
      alert("圖片刪除成功！");
      window.location.reload();
      onClose?.();
    } catch (err) {
      console.error("刪除圖片錯誤：", err);
      alert("刪除失敗，請稍後再試。");
    }
  };

  // Like
  const isLikedByCurrent =
    Array.isArray(image?.likes) && currentUser?._id
      ? image.likes.includes(currentUser._id)
      : false;

  const toggleLikeOnServer = async () => {
    try {
      const token = document.cookie.match(/token=([^;]+)/)?.[1];
      if (!token || !currentUser?._id || !image?._id) return;
      const res = await fetch(`/api/like-image?id=${image._id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const likesArr = Array.isArray(data.likes) ? data.likes : (image.likes || []);
        const updated = { ...image, likes: likesArr, likesCount: likesArr.length };
        setImage(updated);
        onLikeUpdate?.(updated);
      }
    } catch (err) {
      console.error("❌ 點讚失敗", err);
    }
  };

  function handleBackdropClick() {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    onClose?.();
  }

  // Body 鎖定 + 關閉還原 scroll
  useEffect(() => {
    const body = document.body;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    const scrollY = window.scrollY || window.pageYOffset || 0;

    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";

    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      window.scrollTo(0, scrollY);
    };
  }, []);

  // 桌機快捷鍵
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleBackdropClick();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onNavigate ? onNavigate("prev") : onClose?.();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onNavigate ? onNavigate("next") : onClose?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onNavigate]);

  const canEdit =
    !!currentUser?._id && !!ownerId && currentUser._id === ownerId;

  return (
    <Dialog open={!!(imageId || imageData)} onClose={handleBackdropClick} className="relative z-[99999]">
      <div className="fixed inset-0 backdrop-blur-sm" aria-hidden="true" style={{ backgroundColor: "rgba(0,0,0,0.6)" }} />
      <div className="fixed inset-0 flex items-center justify-center p-0 md:p-4" onClick={handleBackdropClick}>
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
          <MobileImageSheet
            image={image}
            prevImage={prevImage}
            nextImage={nextImage}
            loading={loading}
            error={error}
            currentUser={currentUser}
            isFollowing={isFollowing}
            onFollowToggle={handleFollowToggle}
            onUserClick={handleUserClick}
            onToggleLike={toggleLikeOnServer}
            onLikeUpdate={onLikeUpdate}
            onClose={handleBackdropClick}
            onNavigate={onNavigate}
          />

          <div className="hidden md:flex md:flex-row w-full">
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

              <button
                type="button"
                aria-label="上一張"
                onClick={(e) => { e.stopPropagation(); onNavigate ? onNavigate("prev") : onClose?.(); }}
                className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 items-center justify-center w-12 h-12 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur text-white text-2xl"
              >←</button>

              <button
                type="button"
                aria-label="下一張"
                onClick={(e) => { e.stopPropagation(); onNavigate ? onNavigate("next") : onClose?.(); }}
                className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 items-center justify-center w-12 h-12 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur text-white text-2xl"
              >→</button>

              <button
                type="button"
                aria-label="關閉"
                title="Esc 關閉"
                onClick={(e) => { e.stopPropagation(); handleBackdropClick(); }}
                className="hidden md:flex absolute top-3 right-3 items-center justify-center w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur text-white text-xl"
              >✕</button>
            </div>

            <DesktopRightPane
              image={image}
              currentUser={currentUser}
              isFollowing={isFollowing}
              onFollowToggle={handleFollowToggle}
              onUserClick={handleUserClick}
              onClose={handleBackdropClick}
              onDelete={handleDelete}
              canEdit={canEdit}
            />
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
