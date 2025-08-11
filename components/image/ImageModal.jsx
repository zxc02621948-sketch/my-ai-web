"use client";

import { Dialog } from "@headlessui/react";
import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import ImageViewer from "./ImageViewer";
import CommentBox from "./CommentBox";
import ImageInfoBox from "./ImageInfoBox";
import axios from "axios";

/**
 * 手機
 * - 三層滑動（prev/current/next）＋鄰頁陰影
 * - 換頁：鬆手→精準補位到 ±width，再切換（不再過頭）
 * - 邊界橡皮筋：往沒有鄰居方向 dx*0.35
 * - 上滑看資訊：高門檻（150px 或 17% 高度，或 vy>1500）；小上拉僅回彈不跳段
 *
 * 桌機
 * - ←/→ 切換、Esc 關閉，左右按鈕
 */

const defaultAvatarUrl =
  "https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/b479a9e9-6c1a-4c6a-94ff-283541062d00/public";

const getOwnerId = (img) => {
  if (!img) return null;
  const u = img.user ?? img.userId;
  return typeof u === "string" ? u : u?._id ?? null;
};

const fileUrlOf = (image) =>
  image?.imageId
    ? `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${image.imageId}/public`
    : image?.imageUrl || "";

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
  const [image, setImage] = useState(imageData || null);
  const [loading, setLoading] = useState(!imageData);
  const [error, setError] = useState(null);

  const [isFollowing, setIsFollowing] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const rightScrollRef = useRef(null);
  const router = useRouter();

  const panelRef = useRef(null);

  // === 手機手勢 ===
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startRef = useRef({ x: 0, y: 0, t: 0, locked: null });
  const [overlayDim, setOverlayDim] = useState(0.6);

  // 門檻（比例＋像素，取較大者）
  const H_RATIO_X = 0.22; // 水平換頁 22% 寬
  const V_RATIO_UP = 0.17; // 上滑 17% 高
  const DIST_X_MIN = 90;   // 最低水平像素門檻
  const DIST_Y_MIN = 150;  // 最低垂直像素門檻（↑）
  const VEL_X_THRESH = 1200;
  const VEL_Y_UP = 1500;
  const LOCK_DIFF = 14;    // 方向鎖更嚴格

  // 動畫控制
  const animatingRef = useRef(false);
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  function animateTo({ targetX = dragX, targetY = dragY, duration = 240, onDone }) {
    if (animatingRef.current) return;
    animatingRef.current = true;

    const start = performance.now();
    const fromX = dragX;
    const fromY = dragY;
    const startOverlay = overlayDim;

    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const k = easeOutCubic(t);

      const x = fromX + (targetX - fromX) * k;
      const y = fromY + (targetY - fromY) * k;
      setDragX(x);
      setDragY(y);

      if (Math.abs(targetX) > Math.abs(targetY)) {
        const dist = Math.min(Math.abs(x), 200);
        const alpha = 0.6 - dist / 1000; // 0.6 → ~0.4
        setOverlayDim(Math.max(0.4, alpha));
      } else {
        // 垂直時稍微淡一點
        setOverlayDim(startOverlay + (0.45 - startOverlay) * k);
      }

      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        onDone?.();
        requestAnimationFrame(() => { animatingRef.current = false; });
      }
    };

    requestAnimationFrame(step);
  }

  function onTouchStart(e) {
    if (animatingRef.current) return;
    const t = e.touches[0];
    startRef.current = { x: t.clientX, y: t.clientY, t: performance.now(), locked: null };
    setIsDragging(true);
    setOverlayDim(0.55);
  }

  function onTouchMove(e) {
    if (!isDragging || animatingRef.current) return;

    const width = panelRef.current?.clientWidth || window.innerWidth;
    const height = panelRef.current?.clientHeight || window.innerHeight;

    const t = e.touches[0];
    let dx = t.clientX - startRef.current.x;
    const dy = t.clientY - startRef.current.y;

    // 更嚴格的方向鎖
    if (startRef.current.locked === null) {
      if (Math.abs(dx) > Math.abs(dy) + LOCK_DIFF) startRef.current.locked = "x";
      else if (Math.abs(dy) > Math.abs(dx) + LOCK_DIFF) startRef.current.locked = "y";
    }

    if (startRef.current.locked === "x") {
      e.preventDefault();

      // 邊界橡皮筋阻尼
      const hasPrev = !!prevImage;
      const hasNext = !!nextImage;
      if (dx > 0 && !hasPrev) dx *= 0.35;
      if (dx < 0 && !hasNext) dx *= 0.35;

      // 夾限，避免超過 95% 寬
      const clamp = width * 0.95;
      if (dx > clamp) dx = clamp;
      if (dx < -clamp) dx = -clamp;
    }

    setDragX(dx);
    setDragY(dy);

    if (startRef.current.locked === "x") {
      const dist = Math.min(Math.abs(dx), 200);
      const alpha = 0.6 - dist / 1000;
      setOverlayDim(Math.max(0.4, alpha));
    } else {
      setOverlayDim(0.6);
    }
  }

  function onTouchEnd() {
    if (!isDragging || animatingRef.current) return;

    const width = panelRef.current?.clientWidth || window.innerWidth;
    const height = panelRef.current?.clientHeight || window.innerHeight;

    const dt = (performance.now() - startRef.current.t) / 1000;
    const vx = dragX / Math.max(dt, 0.001);
    const vy = dragY / Math.max(dt, 0.001);

    const needSwitchX =
      Math.abs(dragX) >= Math.max(DIST_X_MIN, width * H_RATIO_X) || Math.abs(vx) > VEL_X_THRESH;
    const needInfoUp =
      -dragY >= Math.max(DIST_Y_MIN, height * V_RATIO_UP) || -vy > VEL_Y_UP;

    const locked = startRef.current.locked;

    if (locked === "x") {
      if (needSwitchX && dragX < 0 && nextImage) {
        // 精準補位到 -width，再切換（不加 throw）
        animateTo({
          targetX: -width,
          targetY: 0,
          duration: 260,
          onDone: () => {
            onNavigate ? onNavigate("next") : onClose?.();
            // 下一幀靜默歸零
            requestAnimationFrame(() => {
              setDragX(0); setDragY(0); setOverlayDim(0.6);
              setIsDragging(false);
              startRef.current.locked = null;
            });
          }
        });
        return;
      }
      if (needSwitchX && dragX > 0 && prevImage) {
        animateTo({
          targetX: width,
          targetY: 0,
          duration: 260,
          onDone: () => {
            onNavigate ? onNavigate("prev") : onClose?.();
            requestAnimationFrame(() => {
              setDragX(0); setDragY(0); setOverlayDim(0.6);
              setIsDragging(false);
              startRef.current.locked = null;
            });
          }
        });
        return;
      }

      // 回彈
      animateTo({
        targetX: 0,
        targetY: 0,
        duration: 190,
        onDone: () => {
          setOverlayDim(0.6);
          setIsDragging(false);
          startRef.current.locked = null;
        }
      });
      return;
    }

    if (locked === "y") {
      if (needInfoUp) {
        // 上滑顯示資訊：面板本身 smooth scroll
        const panel = panelRef.current;
        if (panel) {
          const h = panel.clientHeight || window.innerHeight;
          panel.scrollTo({ top: h, behavior: "smooth" });
        }
        // current 回彈到 0（避免殘留位移）
        animateTo({
          targetX: 0,
          targetY: 0,
          duration: 160,
          onDone: () => {
            setOverlayDim(0.6);
            setIsDragging(false);
            startRef.current.locked = null;
          }
        });
        return;
      }

      // 下滑關閉（維持舊邏輯，但門檻相對較高）
      const needClose = dragY >= Math.max(160, height * 0.16) || vy > 1400;
      if (needClose) {
        animateTo({
          targetX: 0,
          targetY: Math.max(180, dragY + 60),
          duration: 180,
          onDone: () => {
            setDragX(0); setDragY(0); setOverlayDim(0.6);
            setIsDragging(false);
            startRef.current.locked = null;
            onClose?.();
          }
        });
        return;
      }

      // 小上拉 / 小下拉：一律回彈
      animateTo({
        targetX: 0,
        targetY: 0,
        duration: 160,
        onDone: () => {
          setOverlayDim(0.6);
          setIsDragging(false);
          startRef.current.locked = null;
        }
      });
      return;
    }

    // 沒鎖成功：回彈
    animateTo({
      targetX: 0,
      targetY: 0,
      duration: 160,
      onDone: () => {
        setOverlayDim(0.6);
        setIsDragging(false);
        startRef.current.locked = null;
      }
    });
  }

  // 鎖 body 捲動
  useEffect(() => {
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = orig; };
  }, []);

  // --app-vh 修正
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

  // 載入圖片
  useEffect(() => {
    if (imageData?._id) {
      setImage(imageData);
      setLoading(false);
      setError(null);
      return;
    }
    if (!imageId) return;
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

  // 若 user 為字串，補抓資料
  useEffect(() => {
    if (!image) return;
    const u = image.user ?? image.userId;
    if (!u || typeof u !== "string") return;
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
        if (userObj && typeof userObj === "object") {
          setImage((prev) => (prev ? { ...prev, user: userObj } : prev));
        }
      } catch {}
    })();
  }, [image]);

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

  // 桌機右側面板滾動監聽
  useEffect(() => {
    const el = rightScrollRef.current;
    if (!el) return;
    const onScroll = () => setShowScrollTop(el.scrollTop > 200);
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // 桌機鍵盤 ←/→/Esc
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault(); onClose?.();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault(); onNavigate ? onNavigate("prev") : onClose?.();
      } else if (e.key === "ArrowRight") {
        e.preventDefault(); onNavigate ? onNavigate("next") : onClose?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onNavigate]);

  // 使用者頭像顯示
  const userObj = typeof image?.user === "object" ? image.user : null;
  const avatarUrl = userObj?.image
    ? `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${userObj.image}/public`
    : defaultAvatarUrl;
  const displayName = userObj?.username || "未命名用戶";
  const canEdit = !!currentUser?._id && !!ownerId && currentUser._id === ownerId;
  const userForChild = userObj || (ownerId ? { _id: ownerId } : undefined);

  // 手機預覽 URL + peek 陰影
  const prevUrl = useMemo(() => fileUrlOf(prevImage), [prevImage]);
  const nextUrl = useMemo(() => fileUrlOf(nextImage), [nextImage]);
  const panelW = panelRef.current?.clientWidth || (typeof window !== "undefined" ? window.innerWidth : 375);
  const prevPeek = Math.max(0, Math.min(1, dragX > 0 ? dragX / panelW : 0));
  const nextPeek = Math.max(0, Math.min(1, dragX < 0 ? -dragX / panelW : 0));
  const prevShade = 0.12 + prevPeek * 0.18; // 0.12~0.30
  const nextShade = 0.12 + nextPeek * 0.18;

  return (
    <Dialog open={!!(imageId || imageData)} onClose={onClose} className="relative z-[99999]">
      {/* Overlay */}
      <div
        className="fixed inset-0 backdrop-blur-sm"
        aria-hidden="true"
        style={{ backgroundColor: `rgba(0,0,0,${overlayDim})` }}
      />

      {/* Wrapper（點外面關閉） */}
      <div className="fixed inset-0 flex items-center justify-center p-0 md:p-4" onClick={onClose}>
        <Dialog.Panel
          ref={panelRef}
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
          {/* ===== Mobile：Section 1 — 三層滑動（prev/current/next） ===== */}
          <section
            className="md:hidden snap-start relative touch-pan-y"
            style={{ minHeight: "calc(var(--app-vh, 1vh) * 100)" }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <div className="absolute inset-0 overflow-hidden">
              {/* prev slide */}
              {prevUrl && (
                <div
                  className="absolute inset-y-0 w-full flex items-center justify-center"
                  style={{
                    transform: `translateX(calc(-100% + ${dragX}px))`,
                    transition: isDragging || animatingRef.current ? "none" : "transform 180ms ease",
                  }}
                >
                  <img src={prevUrl} alt="Prev" className="max-h-full max-w-full object-contain" draggable={false} />
                  <div
                    className="pointer-events-none absolute top-0 right-0 h-full w-16"
                    style={{ background: `linear-gradient(to left, rgba(0,0,0,${prevShade}), rgba(0,0,0,0))` }}
                  />
                </div>
              )}

              {/* current slide */}
              <div
                className="absolute inset-y-0 w-full flex items-center justify-center"
                style={{
                  transform: `
                    translateX(${dragX}px)
                    translateY(${dragY > 0 ? dragY : 0}px)
                    scale(${isDragging && startRef.current.locked === "y" && dragY > 0 ? 1 - Math.min(dragY, 120) / 3000 : 1})
                  `,
                  transition: isDragging || animatingRef.current ? "none" : "transform 180ms ease",
                }}
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
              </div>

              {/* next slide */}
              {nextUrl && (
                <div
                  className="absolute inset-y-0 w-full flex items-center justify-center"
                  style={{
                    transform: `translateX(calc(100% + ${dragX}px))`,
                    transition: isDragging || animatingRef.current ? "none" : "transform 180ms ease",
                  }}
                >
                  <img src={nextUrl} alt="Next" className="max-h-full max-w-full object-contain" draggable={false} />
                  <div
                    className="pointer-events-none absolute top-0 left-0 h-full w-16"
                    style={{ background: `linear-gradient(to right, rgba(0,0,0,${nextShade}), rgba(0,0,0,0))` }}
                  />
                </div>
              )}
            </div>

            {/* 手勢提示（僅手機） */}
            <div className="absolute left-1/2 -translate-x-1/2 bottom-4 text-xs text-white/80 text-center px-3 py-1 rounded-full bg-black/30 md:hidden">
              ← 上一張　·　→ 下一張　·　↓ 關閉　·　↑ 看資訊
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
                  {currentUser && getOwnerId(image) && currentUser._id !== getOwnerId(image) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleFollowToggle(); }}
                      className={`px-3 py-1 text-sm rounded ${isFollowing ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}
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
                  fileUrl={fileUrlOf(image)}
                  canEdit={canEdit}
                />

                <CommentBox currentUser={currentUser} imageId={image._id} />
              </div>
            )}
          </section>

          {/* ===== Desktop：左右版 + 鍵盤/按鈕 ===== */}
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
              >
                ←
              </button>

              <button
                type="button"
                aria-label="下一張"
                onClick={(e) => { e.stopPropagation(); onNavigate ? onNavigate("next") : onClose?.(); }}
                className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 items-center justify-center w-12 h-12 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur text-white text-2xl"
              >
                →
              </button>

              <button
                type="button"
                aria-label="關閉"
                title="Esc 關閉"
                onClick={(e) => { e.stopPropagation(); onClose?.(); }}
                className="hidden md:flex absolute top-3 right-3 items-center justify-center w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur text-white text-xl"
              >
                ✕
              </button>
            </div>

            <div className="w-full md:w-[400px] max-h-[90vh] border-l border-white/10 flex flex-col relative">
              <div ref={rightScrollRef} className="flex-1 overflow-y-auto p-4 relative">
                {image && (
                  <>
                    <ImageInfoBox
                      image={{ ...image, user: userForChild }}
                      currentUser={currentUser}
                      onClose={onClose}
                      onDelete={handleDelete}
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
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
