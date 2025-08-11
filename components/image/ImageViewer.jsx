"use client";

import { Heart, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * 純圖片檢視（不含遮罩）
 * - 手機：填滿可視高（使用 --app-vh 修正），object-contain
 * - 支援點兩下放大、拖曳移動
 * - 右上關閉（由父層決定是否顯示）
 * - 右下愛心（沿用父層傳入的 onToggleLike / isLiked）
 */
export default function ImageViewer({
  image,
  currentUser,
  isLiked,
  onToggleLike,
  showClose = false,
  onClose,
}) {
  const [clicked, setClicked] = useState(false);

  // 小視窗高度修正：--app-vh = window.innerHeight * 1%
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

  // 縮放/拖曳
  const [zoomState, setZoomState] = useState({ zoomed: false, position: { x: 0, y: 0 } });
  const [isDragging, setIsDragging] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const dragOrigin = useRef({ x: 0, y: 0 });
  const imageOrigin = useRef({ x: 0, y: 0 });
  const wasDragging = useRef(false);
  const containerRef = useRef(null);
  const clickCount = useRef(0);
  const clickTimer = useRef(null);
  const ZOOM_SCALE = 1.5;

  useEffect(() => {
    if (isLiked) {
      setClicked(true);
      const t = setTimeout(() => setClicked(false), 400);
      return () => clearTimeout(t);
    } else {
      setClicked(false);
    }
  }, [isLiked]);

  useEffect(() => {
    if (zoomState.zoomed) {
      setShowHint(true);
      const t = setTimeout(() => setShowHint(false), 3000);
      return () => clearTimeout(t);
    }
  }, [zoomState.zoomed]);

  if (!image || (!image.imageId && !image.imageUrl)) {
    return (
      <div className="text-sm text-red-400 bg-neutral-800 p-2 rounded">
        ⚠️ 無法顯示圖片：缺少 imageId 或 imageUrl。
      </div>
    );
    }

  const imageUrl =
    image.imageUrl ||
    `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${image.imageId}/public`;

  const handleLike = (e) => {
    e.stopPropagation();
    onToggleLike?.(image._id);
    if (!isLiked) {
      setClicked(true);
      setTimeout(() => setClicked(false), 400);
    }
  };

  const handleZoomOut = () => setZoomState({ zoomed: false, position: { x: 0, y: 0 } });

  const startDrag = (point) => {
    if (!zoomState.zoomed) return;
    setIsDragging(true);
    wasDragging.current = false;
    dragOrigin.current = { x: point.x, y: point.y };
    imageOrigin.current = { ...zoomState.position };
  };
  const moveDrag = (point) => {
    if (!isDragging) return;
    wasDragging.current = true;
    const dx = point.x - dragOrigin.current.x;
    const dy = point.y - dragOrigin.current.y;
    setZoomState((p) => ({ ...p, position: { x: imageOrigin.current.x + dx, y: imageOrigin.current.y + dy } }));
  };
  const endDrag = () => setIsDragging(false);

  // Mouse
  const handleMouseDown = (e) => startDrag({ x: e.clientX, y: e.clientY });
  const handleMouseMove = (e) => moveDrag({ x: e.clientX, y: e.clientY });
  const handleMouseUp = () => endDrag();

  // Touch
  const handleTouchStart = (e) => e.touches?.[0] && startDrag({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  const handleTouchMove  = (e) => e.touches?.[0] && moveDrag ({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  const handleTouchEnd   = () => endDrag();

  // 點擊縮放
  const handleClick = (e) => {
    e.stopPropagation();
    if (wasDragging.current) { wasDragging.current = false; return; }
    clickCount.current += 1;
    if (clickCount.current === 1) {
      handleZoomInAt(e);
      clickTimer.current = setTimeout(() => { clickCount.current = 0; }, 300);
    } else if (clickCount.current === 2) {
      clearTimeout(clickTimer.current);
      clickCount.current = 0;
      handleZoomOut();
    }
  };

  const handleZoomInAt = (e) => {
    if (zoomState.zoomed) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const clickX = (e.clientX ?? 0) - rect.left;
    const clickY = (e.clientY ?? 0) - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const offsetX = (clickX - cx) * ZOOM_SCALE;
    const offsetY = (clickY - cy) * ZOOM_SCALE;
    setZoomState({ zoomed: true, position: { x: -offsetX, y: -offsetY } });
  };

  const combinedTransform = zoomState.zoomed
    ? `translate(${zoomState.position.x}px, ${zoomState.position.y}px) scale(${ZOOM_SCALE})`
    : `translate(0, 0) scale(1)`;

  return (
    <div
      ref={containerRef}
      className={`relative w-full flex justify-center items-center overflow-hidden ${zoomState.zoomed ? "cursor-grab" : "cursor-zoom-in"}`}
      style={{
        height: "calc(var(--app-vh, 1vh) * 100)",
        maxHeight: "calc(var(--app-vh, 1vh) * 100)",
        paddingTop: "max(env(safe-area-inset-top), 0px)",
        paddingBottom: "max(env(safe-area-inset-bottom), 0px)",
        WebkitOverflowScrolling: "touch",
        touchAction: "manipulation",
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
          onClick={onClose}
          aria-label="關閉"
          className="absolute right-3 top-3 z-30 rounded-full bg-black/60 p-2 text-white backdrop-blur hover:bg-black/70 active:scale-95"
        >
          <X size={20} />
        </button>
      )}

      {/* 愛心 */}
      <div className="absolute bottom-2 right-2 bg-black/60 text-white px-3 py-1 rounded-full flex items-center space-x-1 z-30">
        <button onClick={handleLike} title="愛心" disabled={!currentUser}>
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
        className={`relative ${zoomState.zoomed ? "z-20" : ""}`}
        style={{ transform: combinedTransform, transition: isDragging ? "none" : "transform 0.3s ease" }}
      >
        <img
          src={imageUrl}
          alt={image.title || "圖片"}
          className="rounded select-none object-contain"
          style={{ maxHeight: "calc(var(--app-vh, 1vh) * 100)", maxWidth: "100%" }}
          draggable={false}
        />
      </div>

      {/* 雙擊提示 */}
      <AnimatePresence>
        {zoomState.zoomed && showHint && (
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
