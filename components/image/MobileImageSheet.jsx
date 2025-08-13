"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ImageViewer from "./ImageViewer";
import ImageInfoBox from "./ImageInfoBox";
import CommentBox from "./CommentBox";
import AvatarFrame from "@/components/common/AvatarFrame";

const fileUrlOf = (image) =>
  image?.imageId
    ? `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${image.imageId}/public`
    : image?.imageUrl || "";

export default function MobileImageSheet({
  image,
  prevImage,
  nextImage,
  loading,
  error,
  currentUser,
  isFollowing,
  onFollowToggle,
  onUserClick,
  onToggleLike,
  onLikeUpdate,
  onClose,
}) {
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [overlayDim, setOverlayDim] = useState(0.6);
  const [isDragging, setIsDragging] = useState(false);
  const startRef = useRef({ x: 0, y: 0, t: 0, locked: null });
  const panelRef = useRef(null);
  const animatingRef = useRef(false);

  const skipNavRef = useRef(false);

  const pinchingRef = useRef(false);
  const zoomedRef = useRef(false);
  const bypassSwipeRef = useRef(false);

  const LOCK_DIFF = 14;
  const DIST_X_MIN = 90;
  const DIST_Y_MIN = 150;
  const VEL_Y_UP = 1500;
  const TAP_DIST_MAX = 10;
  const TAP_TIME_MAX = 250;
  const EXCLUDE_CLOSE_PX = 56;

  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  function animateTo({ targetX = dragX, targetY = dragY, duration = 240, onDone }) {
    if (animatingRef.current) return;
    animatingRef.current = true;
    const start = performance.now();
    const fromX = dragX, fromY = dragY, startOverlay = overlayDim;

    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const k = easeOutCubic(t);
      const x = fromX + (targetX - fromX) * k;
      const y = fromY + (targetY - fromY) * k;
      setDragX(x); setDragY(y);
      setOverlayDim(startOverlay + (0.45 - startOverlay) * k);
      if (t < 1) requestAnimationFrame(step);
      else { onDone?.(); requestAnimationFrame(() => { animatingRef.current = false; }); }
    };

    requestAnimationFrame(step);
  }

  function onTouchStart(e) {
    if (animatingRef.current) return;
    if (e.target.closest("[data-stop-nav]")) {
      skipNavRef.current = true;
      return;
    }
    skipNavRef.current = false;
    pinchingRef.current = e.touches.length > 1;
    bypassSwipeRef.current = pinchingRef.current || zoomedRef.current;

    const t = e.touches[0];
    startRef.current = { x: t.clientX, y: t.clientY, t: performance.now(), locked: bypassSwipeRef.current ? "img" : null };
    setIsDragging(true);
    if (!bypassSwipeRef.current) setOverlayDim(0.55);
  }

  function onTouchMove(e) {
    if (skipNavRef.current) return;
    if (!isDragging || animatingRef.current) return;
    if (e.touches && e.touches.length > 1) {
      pinchingRef.current = true;
      bypassSwipeRef.current = true;
      setIsDragging(false);
      setDragX(0); setDragY(0); setOverlayDim(0.6);
      startRef.current.locked = "img";
      return;
    }
    if (bypassSwipeRef.current || pinchingRef.current || zoomedRef.current) return;

    const t = e.touches[0];
    const dx = t.clientX - startRef.current.x;
    const dy = t.clientY - startRef.current.y;

    if (startRef.current.locked === null) {
      if (Math.abs(dx) > Math.abs(dy) + LOCK_DIFF) startRef.current.locked = "x";
      else if (Math.abs(dy) > Math.abs(dx) + LOCK_DIFF) startRef.current.locked = "y";
    }

    setDragX(dx);
    setDragY(dy);
  }

  function onTouchEnd() {
    if (skipNavRef.current) {
      skipNavRef.current = false;
      return;
    }
    if (!isDragging || animatingRef.current) return;
    const elapsedMs = performance.now() - startRef.current.t;
    const absDx = Math.abs(dragX);
    const absDy = Math.abs(dragY);
    const dt = elapsedMs / 1000;
    const vy = dragY / Math.max(dt, 0.001);

    const needCloseBySwipe = absDx >= DIST_X_MIN || dragY >= Math.max(160, window.innerHeight * 0.16) || vy > 1400;

    if (!zoomedRef.current && absDx <= TAP_DIST_MAX && absDy <= TAP_DIST_MAX && elapsedMs <= TAP_TIME_MAX) {
      // 輕點不動作
    }

    if (startRef.current.locked === "x" && needCloseBySwipe) {
      // 左右滑動 → 關閉
      animateTo({
        targetX: dragX > 0 ? window.innerWidth : -window.innerWidth,
        duration: 200,
        onDone: () => { onClose?.(); resetState(); }
      });
      return;
    }

    if (startRef.current.locked === "y") {
      if (-dragY >= Math.max(DIST_Y_MIN, window.innerHeight * 0.17) || -vy > VEL_Y_UP) {
        animateTo({ targetX: 0, targetY: 0, duration: 160, onDone: resetState });
        return;
      }
      if (dragY >= Math.max(160, window.innerHeight * 0.16) || vy > 1400) {
        animateTo({ targetX: 0, targetY: Math.max(180, dragY + 60), duration: 180, onDone: () => { onClose?.(); resetState(); } });
        return;
      }
    }
    animateTo({ targetX: 0, targetY: 0, duration: 160, onDone: resetState });
  }

  function resetState() {
    setDragX(0); setDragY(0); setOverlayDim(0.6); setIsDragging(false); startRef.current.locked = null;
  }

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

  const avatarUrl = image?.user?.image
    ? `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${image.user.image}/public`
    : "https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/b479a9e9-6c1a-4c6a-94ff-283541062d00/public";
  const displayName = image?.user?.username || "未命名用戶";

  return (
    <>
      <section
        className="md:hidden snap-start relative touch-pan-y"
        style={{ minHeight: "calc(var(--app-vh, 1vh) * 100)" }}
        ref={panelRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundColor: `rgba(0,0,0,${overlayDim})` }}
        />
        <div className="absolute inset-0 overflow-hidden flex items-center justify-center">
          {loading ? (
            <div className="w-full h-full flex items-center justify-center text-gray-400">載入中...</div>
          ) : error ? (
            <div className="w-full h-full flex items-center justify-center text-red-500">{error}</div>
          ) : image ? (
            <ImageViewer
              image={image}
              currentUser={currentUser}
              isLiked={Array.isArray(image?.likes) && currentUser?._id ? image.likes.includes(currentUser._id) : false}
              onToggleLike={onToggleLike}
              showClose
              onClose={onClose}
              disableTapZoom
              onZoomChange={(scale) => { zoomedRef.current = (scale || 1) > 1.001; }}
            />
          ) : null}
        </div>
      </section>

      <section className="md:hidden snap-start bg-zinc-950 text-zinc-100 border-t border-white/10">
        <div className="flex justify-center pt-3">
          <div className="h-1.5 w-12 rounded-full bg-white/20" />
        </div>
        {image && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AvatarFrame src={avatarUrl} size={48} onClick={onUserClick} />
                <span className="text-sm">{displayName}</span>
              </div>
              {currentUser && image?.user && currentUser._id !== (image.user._id || image.user) && (
                <button
                  onClick={(e) => { e.stopPropagation(); onFollowToggle?.(); }}
                  className={`px-3 py-1 text-sm rounded ${isFollowing ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}
                >
                  {isFollowing ? "取消追蹤" : "追蹤作者"}
                </button>
              )}
            </div>

            <ImageInfoBox
              image={image}
              currentUser={currentUser}
              onClose={onClose}
              onDelete={undefined}
              fileUrl={fileUrlOf(image)}
              canEdit={currentUser?._id && image?.user && (currentUser._id === (image.user._id || image.user))}
              onLikeUpdate={onLikeUpdate}
            />

            <CommentBox currentUser={currentUser} imageId={image._id} />
          </div>
        )}
      </section>
    </>
  );
}
