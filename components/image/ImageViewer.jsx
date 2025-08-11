"use client";

import { Heart, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function ImageViewer({
  image,
  currentUser,
  isLiked,
  onToggleLike,
  showClose = false,
  onClose,
  disableTapZoom = false,
  onZoomChange,
}) {
  const [clicked, setClicked] = useState(false);

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

  const containerRef = useRef(null);

  const [scale, setScale] = useState(1); // 1..3
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const wasDragging = useRef(false);

  const dragOrigin = useRef({ x: 0, y: 0 });
  const imageOrigin = useRef({ x: 0, y: 0 });

  const clickCount = useRef(0);
  const clickTimer = useRef(null);

  const pinchingRef = useRef(false);
  const pinchStart = useRef({
    dist: 0, scale0: 1, pos0: { x: 0, y: 0 }, center: { x: 0, y: 0 },
  });

  const ZOOM_MIN = 1;
  const ZOOM_MAX = 3;
  const ZOOM_STEP = 1.5;
  const isZoomed = scale > 1.001;

  useEffect(() => { onZoomChange?.(scale); }, [scale, onZoomChange]);

  useEffect(() => {
    if (isLiked) {
      setClicked(true);
      const t = setTimeout(() => setClicked(false), 400);
      return () => clearTimeout(t);
    } else setClicked(false);
  }, [isLiked]);

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const zoomAround = (focal, nextScale, prevScale, prevPos) => {
    const k = nextScale / prevScale;
    return { x: prevPos.x * k + focal.x * (1 - k), y: prevPos.y * k + focal.y * (1 - k) };
  };

  const startDrag = (pt) => {
    if (!isZoomed) return;
    setIsDragging(true);
    wasDragging.current = false;
    dragOrigin.current = { x: pt.x, y: pt.y };
    imageOrigin.current = { ...position };
  };
  const moveDrag = (pt) => {
    if (!isDragging) return;
    wasDragging.current = true;
    const dx = pt.x - dragOrigin.current.x;
    const dy = pt.y - dragOrigin.current.y;
    setPosition({ x: imageOrigin.current.x + dx, y: imageOrigin.current.y + dy });
  };
  const endDrag = () => setIsDragging(false);

  // Mouse
  const handleMouseDown = (e) => { if (isZoomed) e.stopPropagation(); startDrag({ x: e.clientX, y: e.clientY }); };
  const handleMouseMove = (e) => { if (isZoomed) e.stopPropagation(); moveDrag({ x: e.clientX, y: e.clientY }); };
  const handleMouseUp = () => endDrag();

  // Touch helpers
  const getTouches = (e) => Array.from(e.touches || []);
  const dist2 = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  const centerOf = (a, b, rect) => ({ x: ((a.clientX + b.clientX) / 2) - rect.left, y: ((a.clientY + b.clientY) / 2) - rect.top });

  const handleTouchStart = (e) => {
    if (isZoomed || (e.touches && e.touches.length > 1)) e.stopPropagation();

    const ts = getTouches(e);
    if (ts.length >= 2) {
      pinchingRef.current = true;
      const rect = containerRef.current.getBoundingClientRect();
      pinchStart.current = {
        dist: dist2(ts[0], ts[1]),
        scale0: scale,
        pos0: { ...position },
        center: centerOf(ts[0], ts[1], rect),
      };
      setIsDragging(false);
      return;
    }
    if (ts.length === 1 && isZoomed) {
      startDrag({ x: ts[0].clientX, y: ts[0].clientY });
    }
  };

  const handleTouchMove = (e) => {
    if (isZoomed || pinchingRef.current || isDragging) e.stopPropagation();

    const ts = getTouches(e);
    if (pinchingRef.current && ts.length >= 2) {
      e.preventDefault();
      e.stopPropagation();
      const rect = containerRef.current.getBoundingClientRect();
      const d = dist2(ts[0], ts[1]);
      const next = clamp((pinchStart.current.scale0 * d) / Math.max(pinchStart.current.dist, 1), ZOOM_MIN, ZOOM_MAX);
      const focal = centerOf(ts[0], ts[1], rect);
      const nextPos = zoomAround(focal, next, pinchStart.current.scale0, pinchStart.current.pos0);
      setScale(next);
      setPosition(nextPos);
      return;
    }
    if (isDragging && ts.length === 1) {
      e.stopPropagation();
      moveDrag({ x: ts[0].clientX, y: ts[0].clientY });
    }
  };

  const handleTouchEnd = (e) => {
    if (isZoomed || pinchingRef.current || isDragging) e.stopPropagation();

    const ts = getTouches(e);
    if (pinchingRef.current && ts.length < 2) {
      pinchingRef.current = false;
      if (scale <= 1.02) { setScale(1); setPosition({ x: 0, y: 0 }); }
    }
    if (isDragging && ts.length === 0) {
      endDrag();
    }
  };

  // 點擊/雙擊縮放（可停用）
  const handleClick = (e) => {
    if (disableTapZoom) return;
    e.stopPropagation();
    if (wasDragging.current) { wasDragging.current = false; return; }

    clickCount.current += 1;
    if (clickCount.current === 1) {
      const container = containerRef.current;
      if (!container || isZoomed) {
        clickTimer.current = setTimeout(() => { clickCount.current = 0; }, 280);
        return;
      }
      const rect = container.getBoundingClientRect();
      const clickX = (e.clientX ?? 0) - rect.left;
      const clickY = (e.clientY ?? 0) - rect.top;
      const nextScale = clamp(ZOOM_STEP, ZOOM_MIN, ZOOM_MAX);
      const nextPos = zoomAround({ x: clickX, y: clickY }, nextScale, 1, { x: 0, y: 0 });
      setScale(nextScale);
      setPosition(nextPos);
      clickTimer.current = setTimeout(() => { clickCount.current = 0; }, 280);
    } else if (clickCount.current === 2) {
      clearTimeout(clickTimer.current);
      clickCount.current = 0;
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  };

  if (!image || (!image.imageId && !image.imageUrl)) {
    return <div className="text-sm text-red-400 bg-neutral-800 p-2 rounded">⚠️ 無法顯示圖片：缺少 imageId 或 imageUrl。</div>;
  }

  const imageUrl = image.imageUrl || `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${image.imageId}/public`;
  const combinedTransform = `translate(${position.x}px, ${position.y}px) scale(${scale})`;

  return (
    <div
      ref={containerRef}
      className={`relative w-full flex justify-center items-center overflow-hidden ${isZoomed ? "cursor-grab" : (disableTapZoom ? "cursor-default" : "cursor-zoom-in")}`}
      style={{
        height: "calc(var(--app-vh, 1vh) * 100)",
        maxHeight: "calc(var(--app-vh, 1vh) * 100)",
        paddingTop: "max(env(safe-area-inset-top), 0px)",
        paddingBottom: "max(env(safe-area-inset-bottom), 0px)",
        WebkitOverflowScrolling: "touch",
        touchAction: isZoomed ? "none" : "manipulation", // ✅ 放大時禁用原生手勢，防止外層收到
      }}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {showClose && (
        <button
          onClick={(e) => { e.stopPropagation(); onClose?.(); }}
          aria-label="關閉"
          className="absolute right-3 top-3 z-30 rounded-full bg-black/60 p-2 text-white backdrop-blur hover:bg-black/70 active:scale-95"
        >
          <X size={20} />
        </button>
      )}

      {/* 愛心 */}
      <div className="absolute bottom-2 right-2 bg-black/60 text-white px-3 py-1 rounded-full flex items-center space-x-1 z-30">
        <button
          onClick={(e) => { e.stopPropagation(); onToggleLike?.(image._id); if (!isLiked) { setClicked(true); setTimeout(() => setClicked(false), 400); } }}
          title="愛心"
          disabled={!currentUser}
        >
          <Heart
            fill={isLiked || clicked ? "#f472b6" : "transparent"}
            color={isLiked || clicked ? "#f472b6" : "#ccc"}
            strokeWidth={2.5}
            className="w-6 h-6 hover:scale-110 transition duration-200"
          />
        </button>
        <span className="text-sm">{image.likes?.length || 0}</span>
      </div>

      {/* 圖片 */}
      <div
        className={`relative ${isZoomed ? "z-20" : ""}`}
        style={{ transform: combinedTransform, transition: (isDragging || pinchingRef.current) ? "none" : "transform 0.25s ease" }}
      >
        <img
          src={imageUrl}
          alt={image.title || "圖片"}
          className="rounded select-none object-contain"
          style={{ maxHeight: "calc(var(--app-vh, 1vh) * 100)", maxWidth: "100%" }}
          draggable={false}
        />
      </div>

      {/* 雙擊提示（當允許點擊縮放且已放大） */}
      <AnimatePresence>
        {!disableTapZoom && isZoomed && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.4 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm px-3 py-1 rounded z-40 shadow-md"
          >
            雙擊圖片可還原
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
