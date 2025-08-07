"use client";

import { Heart, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function ImageViewer({ image, currentUser, isLiked, onToggleLike }) {
  const [clicked, setClicked] = useState(false);
  const [zoomState, setZoomState] = useState({
    zoomed: false,
    position: { x: 0, y: 0 },
  });

  const [isDragging, setIsDragging] = useState(false);
  const [showHint, setShowHint] = useState(false); // ✅ 提示顯示狀態
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
      const timer = setTimeout(() => setClicked(false), 400);
      return () => clearTimeout(timer);
    } else {
      setClicked(false);
    }
  }, [isLiked]);

  useEffect(() => {
    if (zoomState.zoomed) {
      setShowHint(true);
      const timer = setTimeout(() => setShowHint(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [zoomState.zoomed]);

  if (!image || !image.imageId) {
    return (
      <div className="text-sm text-red-400 bg-neutral-800 p-2 rounded">
        ⚠️ 無法顯示圖片：缺少 imageId。
      </div>
    );
  }

  const imageUrl = `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${image.imageId}/public`;

  const handleLike = (e) => {
    e.stopPropagation();
    if (!onToggleLike) return;
    onToggleLike(image._id);

    if (!isLiked) {
      setClicked(true);
      setTimeout(() => setClicked(false), 400);
    }
  };

  const handleZoomOut = () => {
    setZoomState({ zoomed: false, position: { x: 0, y: 0 } });
  };

  const handleMouseDown = (e) => {
    if (!zoomState.zoomed) return;
    setIsDragging(true);
    wasDragging.current = false;
    dragOrigin.current = { x: e.clientX, y: e.clientY };
    imageOrigin.current = { ...zoomState.position };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    wasDragging.current = true;
    const deltaX = e.clientX - dragOrigin.current.x;
    const deltaY = e.clientY - dragOrigin.current.y;
    setZoomState((prev) => ({
      ...prev,
      position: {
        x: imageOrigin.current.x + deltaX,
        y: imageOrigin.current.y + deltaY,
      },
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleClick = (e) => {
    e.stopPropagation();

    if (wasDragging.current) {
      wasDragging.current = false;
      return;
    }

    clickCount.current += 1;

    if (clickCount.current === 1) {
      handleZoomInAt(e);
      clickTimer.current = setTimeout(() => {
        clickCount.current = 0;
      }, 300);
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
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const offsetX = (clickX - centerX) * ZOOM_SCALE;
    const offsetY = (clickY - centerY) * ZOOM_SCALE;

    setZoomState({
      zoomed: true,
      position: { x: -offsetX, y: -offsetY },
    });
  };

  const combinedTransform = zoomState.zoomed
    ? `translate(${zoomState.position.x}px, ${zoomState.position.y}px) scale(${ZOOM_SCALE})`
    : `translate(0, 0) scale(1)`;

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full max-h-[90vh] flex justify-center items-center overflow-hidden ${
        zoomState.zoomed ? "cursor-grab" : "cursor-zoom-in"
      }`}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div
        className={`relative ${zoomState.zoomed ? "z-20" : ""}`}
        style={{
          transform: combinedTransform,
          transition: isDragging ? "none" : "transform 0.3s ease",
        }}
      >
        <img
          src={imageUrl}
          alt={image.title || "圖片"}
          className="rounded select-none max-h-[90vh] max-w-full object-contain"
          draggable={false}
        />
      </div>

      {/* ❤️ 愛心區 */}
      <div className="absolute bottom-2 right-2 bg-black/60 text-white px-3 py-1 rounded-full flex items-center space-x-1 z-30">
        <button onClick={handleLike} title="愛心" disabled={!currentUser}>
          <Heart
            fill={isLiked || clicked ? "#f472b6" : "transparent"}
            color={
              isLiked || clicked
                ? "#f472b6" 
                : image.likes?.length > 0
                ? "#f472b6"
                : "#ccc"
            }
            strokeWidth={2.5}
            className="w-6 h-6 hover:scale-110 transition duration-200"
          />
        </button>
        <span className="text-sm">{image.likes?.length || 0}</span>
      </div>

      {/* ❎ 還原按鈕 */}
      {zoomState.zoomed && (
        <button
          onClick={handleZoomOut}
          className="absolute top-4 right-4 z-30 text-white bg-black/60 hover:bg-black/80 p-2 rounded-full"
          title="還原圖片"
        >
          <X size={20} />
        </button>
      )}

      {/* 💡 提示文字：雙擊可還原 */}
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
