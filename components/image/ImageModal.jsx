"use client";

import { Dialog } from "@headlessui/react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// 左側大圖（桌機用）
import ImageViewer from "./ImageViewer";

// 拆分後的子元件
import MobileImageSheet from "@/components/image/MobileImageSheet";
import DesktopRightPane from "@/components/image/DesktopRightPane";

/** 工具：取得作者 id（可能是物件或字串） */
const getOwnerId = (img) => {
  if (!img) return null;
  const u = img.user ?? img.userId;
  return typeof u === "string" ? u : u?._id ?? null;
};

export default function ImageModal({
  imageId,
  imageData,
  prevImage,
  nextImage,
  onClose,
  currentUser,
  onLikeUpdate,
  onNavigate, // "prev" | "next"
}) {
  const router = useRouter();

  // 主要狀態
  const [image, setImage] = useState(imageData || null);
  const [loading, setLoading] = useState(!imageData);
  const [error, setError] = useState(null);

  // 追蹤狀態
  const [isFollowing, setIsFollowing] = useState(false);

  // =========================
  // 資料載入：若只有 id 就抓單張
  // =========================
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
        const res = await fetch(`/api/images/${imageId}`);
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

  // 若 user 是字串，補抓作者物件
  useEffect(() => {
    if (!image) return;
    const u = image.user ?? image.userId;
    if (!u || typeof u !== "string") return;

    let alive = true;
    (async () => {
      try {
        let userObj = null;
        try {
          const r = await fetch(`/api/user/${u}`);
          if (r.ok) {
            const data = await r.json();
            userObj = data?.user || data?.data || null;
          }
        } catch {}
        if (!userObj && image?._id) {
          try {
            const r2 = await fetch(`/api/images/${image._id}`);
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

  // 是否已追蹤
  const ownerId = getOwnerId(image);
  useEffect(() => {
    if (!currentUser || !ownerId) return;
    setIsFollowing(!!currentUser.following?.includes(ownerId));
  }, [currentUser, ownerId]);

  // 切換追蹤（交由後端 API；這裡只調整本地狀態）
  const handleFollowToggle = async () => {
    if (!ownerId) return;
    try {
      // 你的後端已有 /api/follow /api/unfollow，這裡只做 optimistic UI
      setIsFollowing((v) => !v);
      const method = isFollowing ? "DELETE" : "POST";
      await fetch("/api/follow", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isFollowing ? { userIdToUnfollow: ownerId } : { userIdToFollow: ownerId }
        ),
      });
    } catch {
      // 若失敗就還原狀態
      setIsFollowing((v) => !v);
    }
  };

  // 點作者 → 進作者頁並關閉 modal
  const handleUserClick = () => {
    if (ownerId) {
      router.push(`/user/${ownerId}`);
      handleBackdropClick(); // 同一路關閉管道（含 blur）
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
        const updated = { ...image, likes: data.likes };
        setImage(updated);
        onLikeUpdate?.(updated);
      }
    } catch (err) {
      console.error("❌ 點讚失敗", err);
    }
  };

  // ==============
  // 關閉路徑統一：先 blur 焦點，避免 Dialog 還焦到縮圖導致跳動
  // ==============
  function handleBackdropClick() {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    onClose?.();
  }

  // ==============
  // Body 捲動鎖定＋還原位置（避免關閉後跳到頂）
  // ==============
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
      // 還原捲動位置到開啟前
      window.scrollTo(0, scrollY);
    };
  }, []);

  // 桌機鍵盤 ←/→/Esc
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
  }, [onNavigate]); // 不把 onClose 放進依賴，避免 handler 變動

  const canEdit =
    !!currentUser?._id && !!ownerId && currentUser._id === ownerId;

  return (
    <Dialog open={!!(imageId || imageData)} onClose={handleBackdropClick} className="relative z-[99999]">
      {/* Overlay（固定 0.6；手機拖曳暗度在子元件內處理視覺即可） */}
      <div
        className="fixed inset-0 backdrop-blur-sm"
        aria-hidden="true"
        style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      />

      {/* Wrapper（點外面關閉） */}
      <div
        className="fixed inset-0 flex items-center justify-center p-0 md:p-4"
        onClick={handleBackdropClick}
      >
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
          {/* ====== Mobile：滑動＋資訊留言（子元件） ====== */}
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

          {/* ====== Desktop 左：大圖（保留左右按鈕與 Esc） ====== */}
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

              {/* ← 左一張（桌機） */}
              <button
                type="button"
                aria-label="上一張"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate ? onNavigate("prev") : onClose?.();
                }}
                className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 items-center justify-center w-12 h-12 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur text-white text-2xl"
              >
                ←
              </button>

              {/* → 右一張（桌機） */}
              <button
                type="button"
                aria-label="下一張"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate ? onNavigate("next") : onClose?.();
                }}
                className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 items-center justify-center w-12 h-12 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur text-white text-2xl"
              >
                →
              </button>

              {/* Esc（桌機） */}
              <button
                type="button"
                aria-label="關閉"
                title="Esc 關閉"
                onClick={(e) => {
                  e.stopPropagation();
                  handleBackdropClick();
                }}
                className="hidden md:flex absolute top-3 right-3 items-center justify-center w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur text-white text-xl"
              >
                ✕
              </button>
            </div>

            {/* ====== Desktop 右：作者頭像列 + 資訊留言（子元件） ====== */}
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
