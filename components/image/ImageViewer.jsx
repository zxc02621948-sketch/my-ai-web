"use client";

import { Heart, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * 純圖片檢視（不含遮罩）
 * - 手機：填滿可視高（使用 --app-vh 修正），object-contain
 * - 支援雙指捏合放大（pinch）與拖曳平移
 * - 可選：單指點擊/雙擊放大（透過 disableTapZoom 關閉）
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
  disableTapZoom = false,      // ✅ 新增：關閉單指點擊/雙擊放大
  onZoomChange,                // ✅ 新增：回報縮放倍率（給外層停用滑頁）
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

  // ====== 縮放/拖曳狀態 ======
  const containerRef = useRef(null);

  const [scale, setScale] = useState(1); // 1 ~ 3
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const wasDragging = useRef(false);

  // 拖曳起點
  const dragOrigin = useRef({ x: 0, y: 0 });
  const imageOrigin = useRef({ x: 0, y: 0 });

  // 點擊/雙擊
  const clickCount = useRef(0);
  const clickTimer = useRef(null);

  // Pinch（雙指）暫存
  const pinchingRef = useRef(false);
  const pinchStart = useRef({
    dist: 0,
    scale0: 1,
    pos0: { x: 0, y: 0 },
    center: { x: 0, y: 0 }, // container 內座標
  });

  const ZOOM_MIN = 1;
  const ZOOM_MAX = 3;
  const ZOOM_STEP = 1.5; // 單指點擊放大倍率（若啟用）
  const isZoomed = scale > 1.001;

  // 對外回報縮放倍率
  useEffect(() => {
    onZoomChange?.(scale);
  }, [scale, onZoomChange]);

  useEffect(() => {
    if (isLiked) {
      setClicked(true);
      const t = setTimeout(() => setClicked(false), 400);
      return () => clearTimeout(t);
    } else {
      setClicked(false);
    }
  }, [isLiked]);

  // ====== 工具 ======
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  // 以某個焦點（container 內座標）為樞紐縮放時的位移修正
  // 與目前 transform 順序 "translate -> scale" 相容
  function zoomAround(focal, nextScale, prevScale, prevPos) {
    const k = nextScale / prevScale;
    return {
      x: prevPos.x * k + focal.x * (1 - k),
      y: prevPos.y * k + focal.y * (1 - k),
    };
  }

  // ====== 拖曳（放大時才有效）======
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

  // ====== 滑鼠拖曳 ======
  const handleMouseDown = (e) => startDrag({ x: e.clientX, y: e.clientY });
  const handleMouseMove = (e) => moveDrag({ x: e.clientX, y: e.clientY });
  const handleMouseUp = () => endDrag();

  // ====== 觸控：拖曳 + Pinch ======
  const getTouches = (e) => Array.from(e.touches || []);
  const dist2 = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  const centerOf = (a, b, rect) => ({
    x: ((a.clientX + b.clientX) / 2) - rect.left,
    y: ((a.clientY + b.clientY) / 2) - rect.top,
  });

  const handleTouchStart = (e) => {
    if (!containerRef.current) return;
    const ts = getTouches(e);

    if (ts.length >= 2) {
      // 開始雙指縮放
      pinchingRef.current = true;
      const rect = containerRef.current.getBoundingClientRect();
      pinchStart.current = {
        dist: dist2(ts[0], ts[1]),
        scale0: scale,
        pos0: { ...position },
        center: centerOf(ts[0], ts[1], rect),
      };
      setIsDragging(false); // 交給 pinch
      return;
    }

    // 單指：若已放大 → 準備拖曳
    if (ts.length === 1) {
      startDrag({ x: ts[0].clientX, y: ts[0].clientY });
    }
  };

  const handleTouchMove = (e) => {
    const ts = getTouches(e);
    if (pinchingRef.current && ts.length >= 2) {
      e.preventDefault(); // 防止瀏覽器原生縮放/滑動
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
      moveDrag({ x: ts[0].clientX, y: ts[0].clientY });
    }
  };

  const handleTouchEnd = (e) => {
    const ts = getTouches(e);
    if (pinchingRef.current && ts.length < 2) {
      pinchingRef.current = false;
      // 若幾乎等於 1，就重置到完全未放大
      if (scale <= 1.02) {
        setScale(1);
        setPosition({ x: 0, y: 0 });
      }
    }
    if (isDragging && ts.length === 0) {
      endDrag();
    }
  };

  // ====== 點擊/雙擊縮放（可停用） ======
  const handleClick = (e) => {
    if (disableTapZoom) return; // ✅ 手機情境：完全關閉點擊放大
    e.stopPropagation();
    if (wasDragging.current) { wasDragging.current = false; return; }

    clickCount.current += 1;
    if (clickCount.current === 1) {
      // 單擊：放大到固定倍率，並以點擊位置為樞紐
      const container = containerRef.current;
      if (!container || isZoomed) {
        // 已放大則單擊不做事，等雙擊還原
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
      // 雙擊：還原
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  };

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

  // 組合 transform（translate -> scale）
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
        <button onClick={(e) => { e.stopPropagation(); onToggleLike?.(image._id); if (!isLiked) { setClicked(true); setTimeout(() => setClicked(false), 400); }}} title="愛心" disabled={!currentUser}>
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
        style={{ transform: combinedTransform, transition: isDragging || pinchingRef.current ? "none" : "transform 0.25s ease" }}
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
