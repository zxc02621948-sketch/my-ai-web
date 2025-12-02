"use client";

import { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import NewBadge from "@/components/image/NewBadge";
import FireEffect from "@/components/image/FireEffect";
import VideoPreview from "@/components/video/VideoPreview";
import MusicPreview from "@/components/music/MusicPreview";
import { updateLikeCacheAndBroadcast } from "@/lib/likeSync";
import { notify } from "@/components/common/GlobalNotificationManager";
import { trackEvent } from "@/utils/analyticsQueue"; 

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
  isFirstInColumn,     // ✅ 性能優化：是否為列中的第一張圖片（首屏可見）
}) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const canLike = !!currentUser;
  const [isLikedLocal, setIsLikedLocal] = useState(isLiked);
  const [likeCountLocal, setLikeCountLocal] = useState(
    Array.isArray(img?.likes) ? img.likes.length : (img?.likesCount || 0)
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [renderKey, setRenderKey] = useState(0);
  
  // ✅ 性能優化：檢測移動設備（用於優化圖片尺寸）
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(typeof window !== 'undefined' && window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
      
      // ✅ 圖片分析：追蹤點讚事件
      if (img?._id) {
        trackEvent('image', {
          imageId: img._id,
          eventType: 'like',
        });
      }

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

      notify.error("錯誤", "愛心更新失敗");
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

  // ✅ 性能優化：生成響應式圖片 URL（根據設備類型優化）
  // 根據性能報告：
  // - 桌面端：顯示尺寸約為 242x161，原始尺寸是 1152x768
  // - 移動端：顯示尺寸更小，需要更小的圖片尺寸
  // Cloudflare Images 支持通過 variant 或 URL 參數來調整尺寸
  const getOptimizedImageUrl = () => {
    // 根據設備類型選擇圖片尺寸（縮圖不需要太大，優化加載速度）
    // 移動端使用更小的尺寸以節省帶寬
    const targetWidth = isMobile ? 240 : 360;  // 移動端 240px，桌面端 360px（1.5x顯示尺寸）
    const targetHeight = isMobile ? 160 : 240; // 移動端 160px，桌面端 240px
    
    // ✅ 優先使用 imageUrl，然後是 originalImageUrl，最後是 imageId
    const urlToProcess = img?.imageUrl || img?.originalImageUrl;
    
    if (urlToProcess) {
      // 如果已有完整 URL，檢查是否為 Cloudflare Images
      if (urlToProcess.includes('imagedelivery.net')) {
        try {
          const url = new URL(urlToProcess);
          // 嘗試添加尺寸參數（2x 顯示尺寸以支持高 DPI 屏幕）
          if (!url.searchParams.has('width')) {
            url.searchParams.set('width', String(targetWidth));
            url.searchParams.set('height', String(targetHeight));
            url.searchParams.set('fit', 'cover');
            url.searchParams.set('quality', '75'); // 降低質量以加快加載速度
          }
          return url.toString();
        } catch {
          return urlToProcess;
        }
      }
      return urlToProcess;
    }
    
    // ✅ 如果沒有 imageUrl 或 originalImageUrl，嘗試使用 imageId 或 originalImageId
    const imageIdToUse = img?.imageId || img?.originalImageId;
    if (imageIdToUse) {
      // 構建 Cloudflare Images URL
      const baseUrl = `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${imageIdToUse}/${img?.variant || "public"}`;
      try {
        const url = new URL(baseUrl);
        // 嘗試添加尺寸參數
        url.searchParams.set('width', String(targetWidth));
        url.searchParams.set('height', String(targetHeight));
        url.searchParams.set('fit', 'cover');
        url.searchParams.set('quality', '75'); // ✅ 統一使用 75% 質量
        return url.toString();
      } catch {
        return baseUrl;
      }
    }
    
    return "/default-image.svg";
  };

  const imageUrl = getOptimizedImageUrl();

  // ✅ 性能優化：計算圖片顯示尺寸（用於 width/height 屬性以減少 CLS）
  // 根據實際顯示尺寸計算（考慮響應式設計和設備類型）
  // 如果數據庫中有原始尺寸，使用原始尺寸計算比例
  const displayWidth = isMobile ? 180 : 242; // 移動端 180px，桌面端 242px
  const displayHeight = img?.width && img?.height 
    ? Math.round((displayWidth / img.width) * img.height)
    : (isMobile ? 120 : 161); // 移動端默認 120px，桌面端 161px（16:9 比例）

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
      data-image-id={img?._id || img?.id}
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
            showNewBadge={false}
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
            width={displayWidth}
            height={displayHeight}
            loading={isFirstInColumn ? "eager" : "lazy"}
            fetchPriority={isFirstInColumn ? "high" : "auto"}
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
