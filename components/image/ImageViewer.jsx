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
  disableTapZoom = false, // 手機用：關閉單指/雙擊放大
  onZoomChange,           // 回報縮放倍率，給外層停用滑頁
}) {
  const containerRef = useRef(null);
  const imgRef = useRef(null);

  // ===== 常數 =====
  const ZOOM_MIN = 1;
  const ZOOM_MAX = 3;
  const ZOOM_STEP = 1.5;

  // 固定像素的鬆綁（避免頭頂/鞋尖卡住）
  const SLACK_X = 48; // px
  const SLACK_Y = 96; // px

  // ✅ 視窗比例的彈性超界（越放大，可移動越多）
  const OVERSCROLL_RATIO_X = 0.12; // 12% 視窗寬
  const OVERSCROLL_RATIO_Y = 0.12; // 12% 視窗高

  // ===== 狀態 =====
  const [scale, setScale] = useState(1); // 1..3
  const [position, setPosition] = useState({ x: 0, y: 0 }); // translate（在 scale 之前）
  const [isDragging, setIsDragging] = useState(false);
  const wasDragging = useRef(false);

  // 捏合（雙指）
  const pinchingRef = useRef(false);
  const pinchStart = useRef({ dist: 0, scale0: 1, pos0: { x: 0, y: 0 }, center: { x: 0, y: 0 } });

  // 拖曳起點
  const dragOrigin = useRef({ x: 0, y: 0 });
  const imageOrigin = useRef({ x: 0, y: 0 });

  // 基礎 contain 尺寸（scale=1 時）
  const baseSizeRef = useRef({ w: 0, h: 0 });

  const isZoomed = scale > 1.001;

  // 外部知會
  useEffect(() => { onZoomChange?.(scale); }, [scale, onZoomChange]);

  // 讚動畫
  const [clicked, setClicked] = useState(false);
  useEffect(() => {
    if (isLiked) {
      setClicked(true);
      const t = setTimeout(() => setClicked(false), 400);
      return () => clearTimeout(t);
    } else setClicked(false);
  }, [isLiked]);

  // 視窗高度修正
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

  // ===== 工具 =====
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  // 以焦點為樞紐縮放（transform: translate -> scale）
  const zoomAround = (focal, nextScale, prevScale, prevPos) => {
    const k = nextScale / prevScale;
    return { x: prevPos.x * k + focal.x * (1 - k), y: prevPos.y * k + focal.y * (1 - k) };
  };

  // 計算 scale=1 時，圖片在容器內以 contain 呈現的寬高
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

  // ✅ 在目前 scale 下，將平移夾限到可視範圍（加入 SLACK + 視窗比例 Overscroll）
  const getClampedPos = useCallback((pos, sc) => {
    const container = containerRef.current;
    const { w: bw, h: bh } = baseSizeRef.current;
    if (!container || !bw || !bh) return pos;

    const cw = container.clientWidth;
    const ch = container.clientHeight;

    // 內容放大後的實際尺寸（畫面座標）
    const contentW = bw * sc;
    const contentH = bh * sc;

    // 內容超出的半寬/半高（畫面座標）
    const halfOverflowX = Math.max(0, (contentW - cw) / 2);
    const halfOverflowY = Math.max(0, (contentH - ch) / 2);

    // 視窗比例超界 + 固定 SLACK（畫面座標）
    const extraX = cw * OVERSCROLL_RATIO_X + SLACK_X;
    const extraY = ch * OVERSCROLL_RATIO_Y + SLACK_Y;

    // 允許的最大位移（畫面座標）
    const maxScreenX = halfOverflowX + extraX;
    const maxScreenY = halfOverflowY + extraY;

    // 換回 pre-scale 座標
    const maxX = maxScreenX / sc;
    const maxY = maxScreenY / sc;

    return { x: clamp(pos.x, -maxX, maxX), y: clamp(pos.y, -maxY, maxY) };
  }, []);

  // 基礎尺寸就緒/改變時，夾限一次（可觸發回彈）
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

  // ===== 拖曳 =====
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
    setPosition(getClampedPos(next, scale)); // 拖曳過程即時夾限
  };
  const endDrag = () => {
    setIsDragging(false);
    setPosition((p) => getClampedPos(p, scale)); // 放手回彈（靠 CSS 過渡）
  };

  // ===== 滑鼠 =====
  const handleMouseDown = (e) => { if (isZoomed) e.stopPropagation(); startDrag({ x: e.clientX, y: e.clientY }); };
  const handleMouseMove = (e) => { if (isZoomed) e.stopPropagation(); moveDrag({ x: e.clientX, y: e.clientY }); };
  const handleMouseUp = () => endDrag();

  // ===== 觸控 =====
  const getTouches = (e) => Array.from(e.touches || []);
  const dist2 = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  const centerOf = (a, b, rect) => ({
    x: ((a.clientX + b.clientX) / 2) - rect.left,
    y: ((a.clientY + b.clientY) / 2) - rect.top,
  });

  const handleTouchStart = (e) => {
    // 一開始就是兩指 → 當下初始化 pinch（第一次就跟手）
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

    // 單指：已放大才拖曳
    const ts = getTouches(e);
    if (ts.length === 1 && isZoomed) {
      e.stopPropagation();
      startDrag({ x: ts[0].clientX, y: ts[0].clientY });
    }
  };

  const handleTouchMove = (e) => {
    if (isZoomed || pinchingRef.current || isDragging) e.stopPropagation();

    const ts = getTouches(e);

    // 單指→雙指的當下：立刻初始化 pinch（抓對焦點）
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

    // 雙指縮放中
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
      const nextPos = getClampedPos(nextPosRaw, nextScale); // 縮放過程也夾限
      setScale(nextScale);
      setPosition(nextPos);
      return;
    }

    // 單指拖曳（已放大）
    if (isDragging && ts.length === 1) {
      e.stopPropagation();
      moveDrag({ x: ts[0].clientX, y: ts[0].clientY });
    }
  };

  const handleTouchEnd = (e) => {
    if (isZoomed || pinchingRef.current || isDragging) e.stopPropagation();

    const ts = getTouches(e);

    // 結束 pinch
    if (pinchingRef.current && ts.length < 2) {
      pinchingRef.current = false;
      if (scale <= 1.02) {
        setScale(1);
        setPosition({ x: 0, y: 0 });
      } else {
        setPosition((p) => getClampedPos(p, scale)); // 放手回彈
      }
    }

    // 結束拖曳
    if (isDragging && ts.length === 0) {
      endDrag();
    }
  };

  // 點擊/雙擊縮放（可停用）
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
        touchAction: isZoomed ? "none" : "manipulation", // 放大時禁用原生手勢
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
            setPosition((p) => getClampedPos(p, scale)); // 載入後夾限，避免首次縮放跳角落
          }}
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
