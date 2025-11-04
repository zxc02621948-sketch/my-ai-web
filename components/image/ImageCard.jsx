"use client";

import { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import NewBadge from "@/components/image/NewBadge";
import FireEffect from "@/components/image/FireEffect";
import VideoPreview from "@/components/video/VideoPreview";
import MusicPreview from "@/components/music/MusicPreview";
import { updateLikeCacheAndBroadcast } from "@/lib/likeSync"; 

// ⬇️ 從 ObjectId 推回建立時間（備援）
function getCreatedMsFromObjectId(id) {
  if (typeof id === "string" && id.length === 24) {
    const sec = parseInt(id.slice(0, 8), 16);
    if (!Number.isNaN(sec)) return sec * 1000;
  }
  return Date.now();
}

export default function ImageCard({
  img,
  viewMode,            // "default" = 常駐標題；"compact" = hover 顯示
  onClick,
  currentUser,
  isLiked,
  onToggleLike,
  onLocalLikeChange,
  onLikeUpdate,
  onImageLoad,         // 圖片載入完成回調
}) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const canLike = !!currentUser;
  const [isLikedLocal, setIsLikedLocal] = useState(isLiked);
  const [likeCountLocal, setLikeCountLocal] = useState(
    Array.isArray(img?.likes) ? img.likes.length : (img?.likesCount || 0)
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [renderKey, setRenderKey] = useState(0);

  // ✅ 以父層資料為基準初始化/回補
  useEffect(() => {
    setIsLikedLocal(isLiked);
    setLikeCountLocal(
      Array.isArray(img?.likes) ? img.likes.length : (img?.likesCount || 0)
    );
  }, [isLiked, img?.likes, img?.likesCount, img?._id]);

  // ✅ 監聽全域同步事件（來自 ImageViewer 或其他 ImageCard）
  useEffect(() => {
    const onLiked = (e) => {
      const updated = e.detail;
      if (!updated || updated._id !== img?._id) return;

      // 依事件內容對齊
      const likesArr = Array.isArray(updated.likes) ? updated.likes : [];
      const meLiked = currentUser?._id ? likesArr.includes(currentUser._id) : false;

      setIsLikedLocal(meLiked);
      setLikeCountLocal(likesArr.length);
      // 通知父層（若需要）
      onLikeUpdate?.(updated);
    };

    window.addEventListener("image-liked", onLiked);
    return () => window.removeEventListener("image-liked", onLiked);
  }, [img?._id, currentUser?._id, onLikeUpdate]);

  const handleLikeClick = async (e) => {
    e.stopPropagation();
    if (!canLike || !onToggleLike || isProcessing) return;

    const prevLiked = isLikedLocal;
    const prevCount = likeCountLocal;
    const newLiked = !prevLiked;

    // ✅ 樂觀更新（本卡先亮）
    setIsLikedLocal(newLiked);
    setLikeCountLocal((prev) => prev + (newLiked ? 1 : -1));
    setIsProcessing(true);

    // 構造廣播資料（以目前 img.likes 為基底）
    const updatedImage = {
      ...img,
      likes: newLiked
        ? [...(img.likes || []), currentUser._id]
        : (img.likes || []).filter((id) => id !== currentUser._id),
    };

    try {
      // 告知父層 + 🔊 廣播給其他視圖（大圖/其他縮圖）
      onLocalLikeChange?.(img?._id, newLiked);
      onLikeUpdate?.(updatedImage);
      updateLikeCacheAndBroadcast(updatedImage);

      // 呼叫原本 API
      await onToggleLike(img?._id, newLiked);

      // 讓 Heart 重跑動畫（照你原有寫法）
      setRenderKey((prev) => prev + 1);
    } catch (err) {
      console.error("❌ 愛心點擊錯誤", err);
      // ⛔ 失敗回滾 + 廣播還原
      setIsLikedLocal(prevLiked);
      setLikeCountLocal(prevCount);

      const rollbackImage = {
        ...img,
        likes: prevLiked
          ? [...(img.likes || []), currentUser._id]
          : (img.likes || []).filter((id) => id !== currentUser._id),
      };
      onLikeUpdate?.(rollbackImage);
      updateLikeCacheAndBroadcast(rollbackImage);

      alert("愛心更新失敗");
    } finally {
      // 防連點（保留你原本 1 秒解鎖）
      setTimeout(() => setIsProcessing(false), 1000);
    }
  };

  const handleCardClick = () => {
    if (onClick) {
      onClick(img);
    } else {
      window.dispatchEvent(
        new CustomEvent("openImageModal", {
          detail: { imageId: img?._id, image: img },
        })
      );
    }
  };

  const imageUrl =
    img?.imageUrl ||
    (img?.imageId
      ? `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${img.imageId}/${img?.variant || "public"}`
      : "/default-image.svg");

  // ⬇️ NEW 判斷（< 10 小時）
  const createdMs = img?.createdAt ? new Date(img.createdAt).getTime() : getCreatedMsFromObjectId(img?._id);
  const isNew = (Date.now() - createdMs) / 36e5 < 10;

  return (
    <div
      className="mb-4 cursor-pointer group relative"
      onClick={handleCardClick}
      role="button"
      title={img?.title || "圖片"}
      aria-label={img?.title || "圖片"}
    >
      {/* NEW 徽章（左上角）- 音樂類型不顯示，因為 MusicPreview 會自己顯示 */}
      {isNew && img?.type !== 'music' && (
        <div className="absolute left-2 top-2 z-20 pointer-events-none">
          <NewBadge animated />
        </div>
      )}

      {/* 權力券火焰效果（左下角） */}
      {img?.powerUsed && img?.powerExpiry && new Date(img.powerExpiry) > new Date() && (
        <FireEffect 
          powerExpiry={img.powerExpiry}
          powerType={img.powerType}
        />
      )}

      {/* 愛心與數量（固定在卡片右上角）- 只在圖片時顯示 */}
      {img?.type !== 'video' && img?.type !== 'music' && (
        <div 
          className={`absolute top-2 right-2 z-10 bg-black/60 rounded-full px-2 py-1 flex items-center space-x-1 ${
            canLike ? "hover:scale-110 cursor-pointer" : "opacity-70"
          }`}
          onClick={handleLikeClick}
        >
          <Heart
            key={renderKey}
            fill={isLikedLocal ? "#f472b6" : "transparent"}
            color={isLikedLocal ? "#f472b6" : likeCountLocal > 0 ? "#f472b6" : "#ccc"}
            strokeWidth={2.5}
            className="w-4 h-4 transition duration-200 pointer-events-none"
          />
          <span className="text-white text-xs pointer-events-none">{likeCountLocal}</span>
        </div>
      )}

      {/* 縮圖容器 */}
      <div className="overflow-hidden rounded-lg relative bg-zinc-900">
        {/* ✅ 載入佔位符 */}
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-zinc-700 border-t-purple-500 rounded-full animate-spin"></div>
          </div>
        )}
        
        {/* ✅ 根據類型顯示圖片、影片或音樂 */}
        {img?.type === 'video' ? (
          /* 使用 VideoPreview 組件顯示影片 */
          <VideoPreview
            video={img}
            onClick={onClick}
            currentUser={currentUser}
            isLiked={isLiked}
            onToggleLike={onToggleLike}
            onLikeUpdate={onLikeUpdate}
            className="w-full h-auto object-cover transition-all duration-300 transform group-hover:scale-105 group-hover:shadow-lg"
          />
        ) : img?.type === 'music' ? (
          /* 使用 MusicPreview 組件顯示音樂 */
          <MusicPreview
            music={img}
            onClick={onClick}
            className="w-full h-auto object-cover transition-all duration-300 transform group-hover:scale-105 group-hover:shadow-lg"
          />
        ) : (
          /* 圖片 */
          <img
            src={imageUrl}
            alt={img?.title || "圖片"}
            loading="lazy"
            decoding="async"
            className={`w-full h-auto object-cover transition-all duration-300 transform group-hover:scale-105 group-hover:shadow-lg ${
              imageLoaded ? "opacity-100" : "opacity-0"
            }`}
            onLoad={() => {
              setImageLoaded(true);
              onImageLoad?.();
            }}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = "/default-image.svg";
              setImageLoaded(true);
            }}
          />
        )}

        {/* hover 顯示模式 */}
        {viewMode !== "default" && (
          <div className="absolute bottom-0 left-0 w-full px-3 py-2 bg-white/85 text-black text-sm text-center opacity-0 group-hover:opacity-100 transition-all duration-300">
            {img?.title || "未命名圖片"}
          </div>
        )}
      </div>

      {/* 常駐標題模式 */}
      {viewMode === "default" && (
        <div className="mt-3 mb-1 px-1 text-white text-sm text-center truncate">
          {img?.title || "未命名圖片"}
        </div>
      )}

    </div>
  );
}
