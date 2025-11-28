// components/image/ImageViewer.jsx
"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, X } from "lucide-react";
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
  const dragDistanceRef = useRef(0); // ✅ 記錄拖曳距離，用於判斷是否為拖曳操作
  const [useOriginalImage, setUseOriginalImage] = useState(false); // ✅ 智能加载：放大时使用原图

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
    if (scale <= 1.0005) {
      setPosition({ x: 0, y: 0 });
      setIsZoomed(false);
    }
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
    console.log("🖱️ handleClick 被觸發:", {
      disableTapZoom,
      isDragging,
      pinching: pinchingRef.current,
      dragDistance: dragDistanceRef.current,
      shouldIgnore: shouldIgnoreClick(e),
      currentScale: scale,
      target: e?.target?.tagName,
    });
    if (disableTapZoom) {
      console.log("❌ 點擊被阻止：disableTapZoom");
      return;
    }
    if (isDragging || pinchingRef.current) {
      console.log("❌ 點擊被阻止：isDragging 或 pinching");
      return;
    }
    // ✅ 如果拖曳距離超過 5px，視為拖曳操作，不觸發縮放
    if (dragDistanceRef.current > 5) {
      console.log("❌ 點擊被阻止：拖曳距離過大", dragDistanceRef.current);
      dragDistanceRef.current = 0; // 重置
      return;
    }
    if (shouldIgnoreClick(e)) {
      console.log("❌ 點擊被阻止：shouldIgnoreClick");
      return;
    }
    const newScale = scale > 1 ? 1 : 2;
    console.log("✅ 執行放大/縮小:", { currentScale: scale, newScale });
    setScale(newScale);
    setIsZoomed(newScale > 1);
    setPosition({ x: 0, y: 0 });
  }, [disableTapZoom, isDragging, scale]);

  const handleMouseDown = useCallback((e) => {
    if (!isZoomed) return;
    setIsDragging(true);
    setStartPointer({ x: e.clientX, y: e.clientY });
    setStartPos(position);
    dragDistanceRef.current = 0; // ✅ 重置拖曳距離
  }, [isZoomed, position]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    const dx = e.clientX - startPointer.x;
    const dy = e.clientY - startPointer.y;
    // ✅ 計算拖曳距離（用於判斷是否為拖曳操作）
    dragDistanceRef.current = Math.hypot(dx, dy);
    setPosition((p) => getClampedPos({ x: startPos.x + dx, y: startPos.y + dy }, scale));
  }, [isDragging, startPointer, startPos, scale, getClampedPos]);

  const handleMouseUp = useCallback((e) => {
    // ✅ 如果拖曳距離超過 5px，則視為拖曳操作，阻止後續的 click 事件
    const wasDragging = dragDistanceRef.current > 5;
    setIsDragging(false);
    
    // ✅ 如果是拖曳操作，阻止 click 事件
    if (wasDragging && e) {
      e.preventDefault();
      e.stopPropagation();
      // ✅ 設置一個短暫的標記，防止 click 事件觸發
      setTimeout(() => {
        dragDistanceRef.current = 0;
      }, 100);
    }
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
      dragDistanceRef.current = 0; // ✅ 重置拖曳距離
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
      // ✅ 計算拖曳距離（用於判斷是否為拖曳操作）
      dragDistanceRef.current = Math.hypot(dx, dy);
      setPosition((p) => getClampedPos({ x: startPos.x + dx, y: startPos.y + dy }, scale));
    }
  }, [isDragging, startPointer, startPos, scale, getClampedPos]);

  const handleTouchEnd = useCallback((e) => {
    // ✅ 如果拖曳距離超過 5px，則視為拖曳操作，阻止後續的 click 事件
    const wasDragging = dragDistanceRef.current > 5;
    pinchingRef.current = false;
    setIsDragging(false);
    
    // ✅ 如果是拖曳操作，阻止 click 事件
    if (wasDragging && e) {
      e.preventDefault();
      e.stopPropagation();
      // ✅ 設置一個短暫的標記，防止 click 事件觸發
      setTimeout(() => {
        dragDistanceRef.current = 0;
      }, 100);
    }
  }, []);

  // ✅ 優先使用高品質 WebP 格式（畫質高、檔案小），回退到原圖
  // ✅ 智能加载策略：根据缩放级别选择图片源
  // - 默认（scale <= 1）：使用 Cloudflare Images WebP（快速加载，文件小）
  // - 放大时（scale > 1）：使用 R2 原图（最高画质，确保清晰）
  useEffect(() => {
    // ✅ 延迟切换，避免在放大过程中立即切换导致图片重新加载
    const timer = setTimeout(() => {
      if (scale > 1 && image?.originalImageUrl && image.originalImageUrl.includes('media.aicreateaworld.com')) {
        setUseOriginalImage(true);
      } else if (scale <= 1) {
        setUseOriginalImage(false);
      }
    }, 100); // 延迟 100ms，确保放大动画完成后再切换
    
    return () => clearTimeout(timer);
  }, [scale, image?.originalImageUrl]);

  const resolvedImageUrl = useMemo(() => {
    // ✅ 智能加载：放大时使用 R2 原图（最高画质）
    // ⚠️ 注意：只在 scale > 1 时才切换，避免在放大过程中触发重新加载
    if (useOriginalImage && scale > 1 && image?.originalImageUrl && image.originalImageUrl.includes('media.aicreateaworld.com')) {
      console.log("✅ ImageViewer 使用 R2 原圖（放大時，最高畫質）:", image.originalImageUrl);
      return image.originalImageUrl;
    }
    
    // ✅ 默认：使用 Cloudflare Images 的 WebP 格式（快速加载，文件小）
    // 目的：同等畫質檔案更小、載入更快
    // 策略：使用 Cloudflare Images 從原圖生成的 WebP（quality=100），確保清晰且文件小
    if (image?.imageId) {
      try {
        const url = new URL(`https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${image.imageId}/public`);
        url.searchParams.set('format', 'webp');
        url.searchParams.set('quality', '100'); // 最高品質，確保放大後不模糊
        // 移除可能導致壓縮的參數
        url.searchParams.delete('width');
        url.searchParams.delete('height');
        url.searchParams.delete('fit');
        console.log("✅ ImageViewer 使用 Cloudflare Images WebP (quality=100，快速加載):", url.toString());
        return url.toString();
      } catch {
        return `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${image.imageId}/public`;
      }
    }
    
    // 回退到 R2 原图（如果没有 imageId）
    if (image?.originalImageUrl && image.originalImageUrl.includes('media.aicreateaworld.com')) {
      console.log("✅ ImageViewer 使用 R2 原圖（回退）:", image.originalImageUrl);
      return image.originalImageUrl;
    }
    
    // 回退到 originalImageUrl（僅當沒有 imageId 時）
    if (image?.originalImageUrl) {
      // 如果是 Cloudflare Images URL，轉換為 WebP 格式
      if (image.originalImageUrl.includes('imagedelivery.net')) {
        try {
          const url = new URL(image.originalImageUrl);
          url.searchParams.set('format', 'webp');
          url.searchParams.set('quality', '100');
          // 移除其他壓縮參數，保留最高品質
          url.searchParams.delete('width');
          url.searchParams.delete('height');
          url.searchParams.delete('fit');
          return url.toString();
        } catch {
          return image.originalImageUrl;
        }
      }
      return image.originalImageUrl;
    }
    
    // 最後回退到 imageUrl（Cloudflare Images 壓縮圖）
    if (image?.imageUrl) {
      if (image.imageUrl.includes('imagedelivery.net')) {
        try {
          const url = new URL(image.imageUrl);
          url.searchParams.set('format', 'webp');
          url.searchParams.set('quality', '100');
          // 移除尺寸限制，保留最高品質
          url.searchParams.delete('width');
          url.searchParams.delete('height');
          url.searchParams.delete('fit');
          return url.toString();
        } catch {
          return image.imageUrl;
        }
      }
      return image.imageUrl;
    }
    
    return null;
  }, [useOriginalImage, scale, image?.originalImageUrl, image?.imageId, image?.imageUrl]);

  const imageUrl = resolvedImageUrl;
  
  if (!image || !imageUrl) {
    return <div className="text-sm text-red-400 bg-neutral-800 p-2 rounded">⚠️ 無法顯示圖片：缺少 imageId 或 imageUrl。</div>;
  }
  const finalLogData = {
    timestamp: new Date().toISOString(),
    imageId: image?._id,
    finalUrl: imageUrl,
    hasOriginalImageUrl: !!image?.originalImageUrl,
    originalImageUrl: image?.originalImageUrl,
    imageUrl: image?.imageUrl,
    imageId: image?.imageId,
  };
  console.log("🖼️ ImageViewer 最終使用的圖片 URL:", finalLogData);
  // 保存到 localStorage
  try {
    const logs = JSON.parse(localStorage.getItem('imageViewerFinalLogs') || '[]');
    logs.push(finalLogData);
    if (logs.length > 10) logs.shift();
    localStorage.setItem('imageViewerFinalLogs', JSON.stringify(logs));
  } catch {}
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
          loading="eager"
          decoding="async"
          onLoad={() => {
            const loadData = {
              timestamp: new Date().toISOString(),
              imageId: image?._id,
              url: imageUrl,
              naturalWidth: imgRef.current?.naturalWidth,
              naturalHeight: imgRef.current?.naturalHeight,
              displayedWidth: imgRef.current?.width,
              displayedHeight: imgRef.current?.height,
            };
            console.log("✅ 圖片載入完成:", loadData);
            // 保存到 localStorage
            try {
              const logs = JSON.parse(localStorage.getItem('imageLoadLogs') || '[]');
              logs.push(loadData);
              if (logs.length > 10) logs.shift();
              localStorage.setItem('imageLoadLogs', JSON.stringify(logs));
            } catch {}
            // ✅ 只在初始加载（scale <= 1）时调用 computeBaseSize，避免在放大时重置
            // ⚠️ 重要：如果当前已经放大（scale > 1），不要重置，只更新位置
            if (scale <= 1) {
              console.log("📐 初始載入，重置縮放狀態");
              computeBaseSize();
            } else {
              console.log("🔍 放大狀態，保持縮放，只更新位置");
              setPosition((p) => getClampedPos(p, scale));
            }
          }}
          onError={(e) => {
            const errorData = {
              timestamp: new Date().toISOString(),
              imageId: image?._id,
              url: imageUrl,
              error: e.toString(),
            };
            console.error("❌ 圖片載入失敗:", errorData);
            // 保存到 localStorage
            try {
              const logs = JSON.parse(localStorage.getItem('imageErrorLogs') || '[]');
              logs.push(errorData);
              if (logs.length > 10) logs.shift();
              localStorage.setItem('imageErrorLogs', JSON.stringify(logs));
            } catch {}
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
