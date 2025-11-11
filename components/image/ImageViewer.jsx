// components/image/ImageViewer.jsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, X } from "lucide-react";
import AdminModerationBar from "@/components/image/AdminModerationBar";
import { updateLikeCacheAndBroadcast } from "@/lib/likeSync";

/**
 * Props:
 * - image: {_id, title, imageId?, imageUrl?, likes?: string[], user?: {_id}, category?, rating?}
 * - currentUser: {_id, isAdmin?}
 * - showClose?: boolean
 * - onClose?: () => void
 * - disableTapZoom?: boolean
 * - onToggleLike?: (imageId) => void
 */
export default function ImageViewer({
  image,
  currentUser,
  showClose = true,
  onClose,
  disableTapZoom = false,
  onToggleLike,
  onZoomChange,
}) {
  const containerRef = useRef(null);
  const imgRef = useRef(null);

  const [isZoomed, setIsZoomed] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [startPointer, setStartPointer] = useState({ x: 0, y: 0 });
  const [clicked, setClicked] = useState(false);
  const pinchingRef = useRef(false);

  // Prevent gallery-level left/right navigation while typing in inputs/textarea/contenteditable
  useEffect(() => {
    const isTypingElement = (el) => {
      if (!el) return false;
      const tag = el.tagName?.toUpperCase?.();
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (el.isContentEditable) return true;
      const role = el.getAttribute?.("role");
      if (role === "textbox" || role === "combobox" || role === "searchbox") return true;
      return false;
    };
    const onKeyDown = (e) => {
      if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && isTypingElement(document.activeElement)) {
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, []);

  const isLiked = !!(currentUser?._id && Array.isArray(image?.likes) && image.likes.includes(currentUser._id));

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  const getClampedPos = useCallback((pos, s) => {
    // Keep the image roughly centered within container when zoomed
    const el = containerRef.current;
    if (!el) return pos;
    const rect = el.getBoundingClientRect();
    // Allow panning roughly one viewport width/height when zoomed
    const limit = Math.max(0, (s - 1) * 0.5);
    const limX = rect.width * limit;
    const limY = rect.height * limit;
    return { x: clamp(pos.x, -limX, limX), y: clamp(pos.y, -limY, limY) };
  }, []);

  const computeBaseSize = useCallback(() => {
    setPosition({ x: 0, y: 0 });
    setScale(1);
    setIsZoomed(false);
  }, []);

  useEffect(() => {
    onZoomChange?.(scale);
  }, [scale, onZoomChange]);

  // ✅ 忽略來自工具列/互動元素的點擊，避免觸發縮放
  const shouldIgnoreClick = (e) => {
    const t = e?.target;
    if (!t) return false;
    // 任一帶有 data-stop-nav 的祖先
    if (t.closest?.("[data-stop-nav]")) return true;
    // 常見互動元素
    if (t.closest?.("button, a, input, textarea, select, label, [role='button'], [role='menu'], [role='tab']")) {
      return true;
    }
    return false;
  };

  const handleClick = useCallback((e) => {
    if (disableTapZoom) return;
    if (isDragging || pinchingRef.current) return;
    if (shouldIgnoreClick(e)) return; // ⬅️ 新增
    setIsZoomed((z) => !z);
    setScale((z) => (z > 1 ? 1 : 2));
    setPosition({ x: 0, y: 0 });
  }, [disableTapZoom, isDragging]);

  const handleMouseDown = useCallback((e) => {
    if (!isZoomed) return;
    setIsDragging(true);
    setStartPointer({ x: e.clientX, y: e.clientY });
    setStartPos(position);
  }, [isZoomed, position]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    const dx = e.clientX - startPointer.x;
    const dy = e.clientY - startPointer.y;
    setPosition((p) => getClampedPos({ x: startPos.x + dx, y: startPos.y + dy }, scale));
  }, [isDragging, startPointer, startPos, scale, getClampedPos]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Basic pinch zoom
  const startDistanceRef = useRef(0);
  const startScaleRef = useRef(1);

  const getTouches = (evt) => (evt.touches ? Array.from(evt.touches) : []);
  const distance = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

  const handleTouchStart = useCallback((e) => {
    const t = getTouches(e);
    if (t.length === 2) {
      pinchingRef.current = true;
      startDistanceRef.current = distance(t[0], t[1]);
      startScaleRef.current = scale;
    } else if (t.length === 1 && isZoomed) {
      setIsDragging(true);
      setStartPointer({ x: t[0].clientX, y: t[0].clientY });
      setStartPos(position);
    }
  }, [isZoomed, position, scale]);

  const handleTouchMove = useCallback((e) => {
    const t = getTouches(e);
    if (t.length === 2 && pinchingRef.current) {
      const d = distance(t[0], t[1]);
      const ratio = d / Math.max(1, startDistanceRef.current);
      const nextScale = clamp(startScaleRef.current * ratio, 1, 4);
      setScale(nextScale);
      setIsZoomed(nextScale > 1.01);
    } else if (t.length === 1 && isDragging) {
      const dx = t[0].clientX - startPointer.x;
      const dy = t[0].clientY - startPointer.y;
      setPosition((p) => getClampedPos({ x: startPos.x + dx, y: startPos.y + dy }, scale));
    }
  }, [isDragging, startPointer, startPos, scale, getClampedPos]);

  const handleTouchEnd = useCallback(() => {
    pinchingRef.current = false;
    setIsDragging(false);
  }, []);

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
        touchAction: isZoomed ? "none" : "manipulation",
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
          data-stop-nav
          onPointerDown={(e)=>e.stopPropagation()}
          onTouchStart={(e)=>e.stopPropagation()}
          onMouseDown={(e)=>e.stopPropagation()}
        >
          <X size={20} />
        </button>
      )}

      {/* 愛心 */}
      <div
        className="absolute bottom-2 right-2 bg-black/60 text-white px-3 py-1 rounded-full flex items-center space-x-1 z-30"
        data-stop-nav
      >
        <button
          type="button"
          data-stop-nav
          onClick={(e) => {
            e.stopPropagation();
            const meId = currentUser?._id;
            if (meId && image?._id) {
              const already = Array.isArray(image.likes) ? image.likes.includes(meId) : false;
              const nextLiked = !already;
              const updated = {
                ...image,
                likes: nextLiked
                  ? [ ...(image.likes || []), meId ]
                  : (image.likes || []).filter((id) => id !== meId),
              };
              updateLikeCacheAndBroadcast(updated);
            }
            onToggleLike?.(image._id);
            if (!isLiked) { setClicked(true); setTimeout(() => setClicked(false), 400); }
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
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
        style={{
          transform: combinedTransform,
          transition: (isDragging || pinchingRef.current) ? "none" : "transform 0.25s ease",
        }}
      >
        <img
          ref={imgRef}
          src={imageUrl}
          alt={image.title || "圖片"}
          className="rounded select-none object-contain"
          style={{ maxHeight: "calc(var(--app-vh, 1vh) * 100)", maxWidth: "100%" }}
          draggable={false}
          onLoad={() => {
            computeBaseSize();
            setPosition((p) => getClampedPos(p, scale));
          }}
        />
      </div>

      <AnimatePresence>
        {!disableTapZoom && isZoomed && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.4 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm px-3 py-1 rounded z-40 shadow-md"
            data-stop-nav
          >
            雙擊圖片可還原
          </motion.div>
        )}
      </AnimatePresence>

      {/* 管理員工具列（包一層 data-stop-nav，並阻止事件冒泡） */}
      {currentUser?.isAdmin && image && (
        <div
          className="absolute left-3 bottom-3 z-30 max-w-[92%]"
          data-stop-nav
          onClick={(e)=>e.stopPropagation()}
          onPointerDown={(e)=>e.stopPropagation()}
          onMouseDown={(e)=>e.stopPropagation()}
          onTouchStart={(e)=>e.stopPropagation()}
        >
          <AdminModerationBar
            image={image}
            onDone={() => { try { location.reload(); } catch (e) {} }}
          />
        </div>
      )}
    </div>
  );
}
