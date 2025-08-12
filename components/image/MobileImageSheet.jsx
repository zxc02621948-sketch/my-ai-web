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
  onNavigate, // "prev" | "next"
}) {
  // ----- 手勢狀態 -----
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [overlayDim, setOverlayDim] = useState(0.6);
  const [isDragging, setIsDragging] = useState(false);
  const startRef = useRef({ x: 0, y: 0, t: 0, locked: null });
  const panelRef = useRef(null);
  const animatingRef = useRef(false);

  // 這次手勢是否從「不該觸發換圖」的元素開始（例如愛心/關閉/更多）
  const skipNavRef = useRef(false);

  // 縮放/多指偵測
  const pinchingRef = useRef(false);
  const zoomedRef = useRef(false);
  const bypassSwipeRef = useRef(false);

  // 門檻
  const H_RATIO_X = 0.22;
  const V_RATIO_UP = 0.17;
  const DIST_X_MIN = 90;
  const DIST_Y_MIN = 150;
  const VEL_X_THRESH = 1200;
  const VEL_Y_UP = 1500;
  const LOCK_DIFF = 14;

  // 輕點判定 & 排除區
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
      if (Math.abs(targetX) > Math.abs(targetY)) {
        const dist = Math.min(Math.abs(x), 200);
        const alpha = 0.6 - dist / 1000;
        setOverlayDim(Math.max(0.4, alpha));
      } else {
        setOverlayDim(startOverlay + (0.45 - startOverlay) * k);
      }
      if (t < 1) requestAnimationFrame(step);
      else { onDone?.(); requestAnimationFrame(() => { animatingRef.current = false; }); }
    };

    requestAnimationFrame(step);
  }

  function onTouchStart(e) {
    if (animatingRef.current) return;

    // ✅ 新增：若起點在 data-stop-nav（愛心/關閉…）之內，整段手勢都不觸發換圖
    if (e.target.closest("[data-stop-nav]")) {
      skipNavRef.current = true;
      return;
    }
    skipNavRef.current = false;

    // 縮放/多指 → 交給 ImageViewer
    pinchingRef.current = e.touches.length > 1;
    bypassSwipeRef.current = pinchingRef.current || zoomedRef.current;

    const t = e.touches[0];
    startRef.current = { x: t.clientX, y: t.clientY, t: performance.now(), locked: bypassSwipeRef.current ? "img" : null };
    setIsDragging(true);
    if (!bypassSwipeRef.current) setOverlayDim(0.55);
  }

  function onTouchMove(e) {
    // ✅ 若這次手勢是從 data-stop-nav 開始，完全不處理
    if (skipNavRef.current) return;

    if (!isDragging || animatingRef.current) return;

    // 進行中從單指變雙指：立即改為 bypass
    if (e.touches && e.touches.length > 1) {
      pinchingRef.current = true;
      bypassSwipeRef.current = true;
      setIsDragging(false);
      setDragX(0); setDragY(0); setOverlayDim(0.6);
      startRef.current.locked = "img";
      return;
    }

    if (bypassSwipeRef.current || pinchingRef.current || zoomedRef.current) return;

    const width = panelRef.current?.clientWidth || window.innerWidth;

    const t = e.touches[0];
    let dx = t.clientX - startRef.current.x;
    const dy = t.clientY - startRef.current.y;

    if (startRef.current.locked === null) {
      if (Math.abs(dx) > Math.abs(dy) + LOCK_DIFF) startRef.current.locked = "x";
      else if (Math.abs(dy) > Math.abs(dx) + LOCK_DIFF) startRef.current.locked = "y";
    }

    if (startRef.current.locked === "x") {
      e.preventDefault();
      if (dx > 0 && !prevImage) dx *= 0.35;
      if (dx < 0 && !nextImage) dx *= 0.35;
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
    // ✅ 若這次手勢是從 data-stop-nav 開始，結束時清旗標並離開
    if (skipNavRef.current) {
      skipNavRef.current = false;
      return;
    }

    if (!isDragging || animatingRef.current) return;

    const width = panelRef.current?.clientWidth || window.innerWidth;
    const height = panelRef.current?.clientHeight || window.innerHeight;

    if (bypassSwipeRef.current) {
      bypassSwipeRef.current = false;
      pinchingRef.current = false;
      setIsDragging(false);
      setDragX(0); setDragY(0); setOverlayDim(0.6);
      startRef.current.locked = null;
      return;
    }

    const elapsedMs = performance.now() - startRef.current.t;
    const absDx = Math.abs(dragX);
    const absDy = Math.abs(dragY);

    const dt = elapsedMs / 1000;
    const vx = dragX / Math.max(dt, 0.001);
    const vy = dragY / Math.max(dt, 0.001);

    const needSwitchX =
      Math.abs(dragX) >= Math.max(DIST_X_MIN, width * H_RATIO_X) || Math.abs(vx) > VEL_X_THRESH;
    const needInfoUp =
      -dragY >= Math.max(DIST_Y_MIN, height * V_RATIO_UP) || -vy > VEL_Y_UP;

    const locked = startRef.current.locked;

    const panelRect = panelRef.current?.getBoundingClientRect();
    const startX = startRef.current.x;
    const startY = startRef.current.y;
    const localX = panelRect ? startX - panelRect.left : startX;
    const localY = panelRect ? startY - panelRect.top : startY;
    const inCloseRect = (localX >= width - EXCLUDE_CLOSE_PX) && (localY <= EXCLUDE_CLOSE_PX);

    if (!zoomedRef.current && !inCloseRect && absDx <= TAP_DIST_MAX && absDy <= TAP_DIST_MAX && elapsedMs <= TAP_TIME_MAX) {
      const leftZone = width / 3;
      const rightZone = (2 * width) / 3;

      if (localX <= leftZone && prevImage) {
        onNavigate?.("prev");
        setDragX(0); setDragY(0); setIsDragging(false);
        startRef.current.locked = null; setOverlayDim(0.6);
        return;
      }
      if (localX >= rightZone && nextImage) {
        onNavigate?.("next");
        setDragX(0); setDragY(0); setIsDragging(false);
        startRef.current.locked = null; setOverlayDim(0.6);
        return;
      }
      // 中間 1/3：不動作
    }

    if (locked === "x") {
      if (zoomedRef.current) {
        animateTo({
          targetX: 0, targetY: 0, duration: 160,
          onDone: () => { setOverlayDim(0.6); setIsDragging(false); startRef.current.locked = null; }
        });
        return;
      }
      if (needSwitchX && dragX < 0 && nextImage) {
        animateTo({
          targetX: -width, targetY: 0, duration: 260,
          onDone: () => { onNavigate?.("next"); requestAnimationFrame(() => {
            setDragX(0); setDragY(0); setOverlayDim(0.6); setIsDragging(false); startRef.current.locked = null;
          });}
        });
        return;
      }
      if (needSwitchX && dragX > 0 && prevImage) {
        animateTo({
          targetX: width, targetY: 0, duration: 260,
          onDone: () => { onNavigate?.("prev"); requestAnimationFrame(() => {
            setDragX(0); setDragY(0); setOverlayDim(0.6); setIsDragging(false); startRef.current.locked = null;
          });}
        });
        return;
      }
      animateTo({ targetX: 0, targetY: 0, duration: 190, onDone: () => {
        setOverlayDim(0.6); setIsDragging(false); startRef.current.locked = null;
      }});
      return;
    }

    if (locked === "y") {
      if (needInfoUp) {
        const panel = panelRef.current;
        if (panel) {
          const h = panel.clientHeight || window.innerHeight;
          panel.scrollTo({ top: h, behavior: "smooth" });
        }
        animateTo({ targetX: 0, targetY: 0, duration: 160, onDone: () => {
          setOverlayDim(0.6); setIsDragging(false); startRef.current.locked = null;
        }});
        return;
      }
      const needClose = dragY >= Math.max(160, height * 0.16) || vy > 1400;
      if (needClose) {
        animateTo({ targetX: 0, targetY: Math.max(180, dragY + 60), duration: 180, onDone: () => {
          setDragX(0); setDragY(0); setOverlayDim(0.6); setIsDragging(false); startRef.current.locked = null; onClose?.();
        }});
        return;
      }
      animateTo({ targetX: 0, targetY: 0, duration: 160, onDone: () => {
        setOverlayDim(0.6); setIsDragging(false); startRef.current.locked = null;
      }});
      return;
    }

    animateTo({ targetX: 0, targetY: 0, duration: 160, onDone: () => {
      setOverlayDim(0.6); setIsDragging(false); startRef.current.locked = null;
    }});
  }

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

  const prevUrl = useMemo(() => fileUrlOf(prevImage), [prevImage]);
  const nextUrl = useMemo(() => fileUrlOf(nextImage), [nextImage]);

  const avatarUrl = image?.user?.image
    ? `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${image.user.image}/public`
    : "https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/b479a9e9-6c1a-4c6a-94ff-283541062d00/public";
  const displayName = image?.user?.username || "未命名用戶";

  const panelW = panelRef.current?.clientWidth || (typeof window !== "undefined" ? window.innerWidth : 375);
  const prevPeek = Math.max(0, Math.min(1, dragX > 0 ? dragX / panelW : 0));
  const nextPeek = Math.max(0, Math.min(1, dragX < 0 ? -dragX / panelW : 0));
  const prevShade = 0.12 + prevPeek * 0.18;
  const nextShade = 0.12 + nextPeek * 0.18;

  return (
    <>
      {/* ===== Mobile：Section 1 — 三層滑動 ===== */}
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

        <div className="absolute inset-0 overflow-hidden">
          {/* prev */}
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

          {/* current */}
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
              <div className="w-full h-full flex items-center justify中心 text-red-500">{error}</div>
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

          {/* next */}
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

        <div className="absolute left-1/2 -translate-x-1/2 bottom-4 text-xs text-white/80 text-center px-3 py-1 rounded-full bg-black/30 md:hidden" data-stop-nav>
          ← 上一張　·　→ 下一張　·　↓ 關閉　·　↑ 看資訊　·　點左右可翻頁
        </div>
      </section>

      {/* ===== Mobile：Section 2 — 資訊 & 留言 ===== */}
      <section className="md:hidden snap-start bg-zinc-950 text-zinc-100 border-t border-white/10">
        <div className="flex justify-center pt-3">
          <div className="h-1.5 w-12 rounded-full bg白/20" />
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
