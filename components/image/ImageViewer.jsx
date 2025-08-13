"use client";

import { Heart, X } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
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
  const containerRef = useRef(null);
  const imgRef = useRef(null);

  // ✅【新增】IME 與輸入時，擋掉左右鍵往外冒泡（避免觸發全域換圖）
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

    const onKeyDownCapture = (e) => {
      const key = e.key;
      if (key !== "ArrowLeft" && key !== "ArrowRight") return;

      // 有修飾鍵就不處理（避免干擾系統/瀏覽器快捷鍵）
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;

      // 焦點在輸入元件 or 使用 IME 組字（229/Process/isComposing）
      const typing = isTypingElement(e.target) || isTypingElement(document.activeElement);
      const composing = e.isComposing || e.key === "Process" || e.keyCode === 229;

      if (typing || composing) {
        // 只阻止冒泡，讓輸入框保有左右移動游標的預設行為
        e.stopPropagation();
        // 不要 preventDefault()
      }
    };

    // 用 capture 階段先攔截，避免事件傳到全域換圖的 listener
    window.addEventListener("keydown", onKeyDownCapture, true);
    return () => window.removeEventListener("keydown", onKeyDownCapture, true);
  }, []);

  const ZOOM_MIN = 1;
  const ZOOM_MAX = 3;
  const ZOOM_STEP = 1.5;
  const SLACK_X = 48;
  const SLACK_Y = 96;
  const OVERSCROLL_RATIO_X = 0.12;
  const OVERSCROLL_RATIO_Y = 0.12;

  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const wasDragging = useRef(false);

  const pinchingRef = useRef(false);
  const pinchStart = useRef({ dist: 0, scale0: 1, pos0: { x: 0, y: 0 }, center: { x: 0, y: 0 } });
  const dragOrigin = useRef({ x: 0, y: 0 });
  const imageOrigin = useRef({ x: 0, y: 0 });
  const baseSizeRef = useRef({ w: 0, h: 0 });

  const isZoomed = scale > 1.001;

  useEffect(() => { onZoomChange?.(scale); }, [scale, onZoomChange]);

  const [clicked, setClicked] = useState(false);
  useEffect(() => {
    if (isLiked) {
      setClicked(true);
      const t = setTimeout(() => setClicked(false), 400);
      return () => clearTimeout(t);
    } else setClicked(false);
  }, [isLiked]);

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

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  const zoomAround = (focal, nextScale, prevScale, prevPos) => {
    const k = nextScale / prevScale;
    return { x: prevPos.x * k + focal.x * (1 - k), y: prevPos.y * k + focal.y * (1 - k) };
  };

  const computeBaseSize = useCallback(() => {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img || !img.naturalWidth || !img.naturalHeight) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const s = Math.min(cw / iw, ch / ih);
    baseSizeRef.current = { w: iw * s, h: ih * s };
  }, []);

  const getClampedPos = useCallback((pos, sc) => {
    const container = containerRef.current;
    const { w: bw, h: bh } = baseSizeRef.current;
    if (!container || !bw || !bh) return pos;

    const cw = container.clientWidth;
    const ch = container.clientHeight;

    const contentW = bw * sc;
    const contentH = bh * sc;

    const halfOverflowX = Math.max(0, (contentW - cw) / 2);
    const halfOverflowY = Math.max(0, (contentH - ch) / 2);

    const extraX = cw * OVERSCROLL_RATIO_X + SLACK_X;
    const extraY = ch * OVERSCROLL_RATIO_Y + SLACK_Y;

    const maxScreenX = halfOverflowX + extraX;
    const maxScreenY = halfOverflowY + extraY;

    const maxX = maxScreenX / sc;
    const maxY = maxScreenY / sc;

    return { x: clamp(pos.x, -maxX, maxX), y: clamp(pos.y, -maxY, maxY) };
  }, []);

  useEffect(() => {
    computeBaseSize();
    setPosition((p) => getClampedPos(p, scale));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computeBaseSize]);

  useEffect(() => {
    const onResize = () => {
      computeBaseSize();
      setPosition((p) => getClampedPos(p, scale));
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [computeBaseSize, getClampedPos, scale]);

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
    const next = { x: imageOrigin.current.x + dx, y: imageOrigin.current.y + dy };
    setPosition(getClampedPos(next, scale));
  };
  const endDrag = () => {
    setIsDragging(false);
    setPosition((p) => getClampedPos(p, scale));
  };

  const handleMouseDown = (e) => { if (isZoomed) e.stopPropagation(); startDrag({ x: e.clientX, y: e.clientY }); };
  const handleMouseMove = (e) => { if (isZoomed) e.stopPropagation(); moveDrag({ x: e.clientX, y: e.clientY }); };
  const handleMouseUp = () => endDrag();

  const getTouches = (e) => Array.from(e.touches || []);
  const dist2 = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  const centerOf = (a, b, rect) => ({
    x: ((a.clientX + b.clientX) / 2) - rect.left,
    y: ((a.clientY + b.clientY) / 2) - rect.top,
  });

  const handleTouchStart = (e) => {
    if (e.touches && e.touches.length >= 2 && containerRef.current) {
      e.preventDefault();
      e.stopPropagation();
      const ts = getTouches(e);
      const rect = containerRef.current.getBoundingClientRect();
      pinchingRef.current = true;
      pinchStart.current = {
        dist: dist2(ts[0], ts[1]),
        scale0: scale,
        pos0: { ...position },
        center: centerOf(ts[0], ts[1], rect),
      };
      setIsDragging(false);
      return;
    }
    const ts = getTouches(e);
    if (ts.length === 1 && isZoomed) {
      e.stopPropagation();
      startDrag({ x: ts[0].clientX, y: ts[0].clientY });
    }
  };

  const handleTouchMove = (e) => {
    if (isZoomed || pinchingRef.current || isDragging) e.stopPropagation();
    const ts = getTouches(e);

    if (!pinchingRef.current && ts.length >= 2 && containerRef.current) {
      e.preventDefault();
      e.stopPropagation();
      const rect = containerRef.current.getBoundingClientRect();
      pinchingRef.current = true;
      pinchStart.current = {
        dist: dist2(ts[0], ts[1]),
        scale0: scale,
        pos0: { ...position },
        center: centerOf(ts[0], ts[1], rect),
      };
      setIsDragging(false);
    }

    if (pinchingRef.current && ts.length >= 2) {
      e.preventDefault();
      e.stopPropagation();
      const rect = containerRef.current.getBoundingClientRect();
      const d = dist2(ts[0], ts[1]);
      const nextScale = clamp(
        (pinchStart.current.scale0 * d) / Math.max(pinchStart.current.dist, 1),
        ZOOM_MIN,
        ZOOM_MAX
      );
      const focal = centerOf(ts[0], ts[1], rect);
      const nextPosRaw = zoomAround(focal, nextScale, pinchStart.current.scale0, pinchStart.current.pos0);
      const nextPos = getClampedPos(nextPosRaw, nextScale);
      setScale(nextScale);
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
      if (scale <= 1.02) {
        setScale(1);
        setPosition({ x: 0, y: 0 });
      } else {
        setPosition((p) => getClampedPos(p, scale));
      }
    }
    if (isDragging && ts.length === 0) {
      endDrag();
    }
  };

  const clickCount = useRef(0);
  const clickTimer = useRef(null);
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
      const nextPosRaw = zoomAround({ x: clickX, y: clickY }, nextScale, 1, { x: 0, y: 0 });
      const nextPos = getClampedPos(nextPosRaw, nextScale);
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
    </div>
  );
}
