import { useState, useEffect } from "react";
import { Heart } from "lucide-react";

export default function ImageCard({
  img,
  viewMode,            // "default" = 常駐標題；"compact" = hover 顯示
  onClick,
  currentUser,
  isLiked,
  onToggleLike,
  onLocalLikeChange,
  onLikeUpdate,
}) {
  const canLike = !!currentUser;
  const [isLikedLocal, setIsLikedLocal] = useState(isLiked);
  const [likeCountLocal, setLikeCountLocal] = useState(img.likes?.length || 0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [renderKey, setRenderKey] = useState(0);

  useEffect(() => {
    setIsLikedLocal(isLiked);
    setLikeCountLocal(img.likes?.length || 0);
  }, [isLiked, img.likes]);

  const handleLikeClick = async (e) => {
    e.stopPropagation();
    if (!canLike || !onToggleLike || isProcessing) return;

    const prevLiked = isLikedLocal;
    const prevCount = likeCountLocal;
    const newLiked = !prevLiked;

    // 樂觀更新
    setIsLikedLocal(newLiked);
    setLikeCountLocal((prev) => prev + (newLiked ? 1 : -1));
    setIsProcessing(true);

    const updatedImage = {
      ...img,
      likes: newLiked
        ? [...(img.likes || []), currentUser._id]
        : (img.likes || []).filter((id) => id !== currentUser._id),
    };

    try {
      onLocalLikeChange?.(img._id, newLiked);
      onLikeUpdate?.(updatedImage);

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("image-liked", { detail: { ...updatedImage } })
        );
      }

      await onToggleLike(img._id, newLiked);
      setRenderKey((prev) => prev + 1);
    } catch (err) {
      console.error("❌ 愛心點擊錯誤", err);
      setIsLikedLocal(prevLiked);
      setLikeCountLocal(prevCount);
      alert("愛心更新失敗");
    } finally {
      setTimeout(() => setIsProcessing(false), 1000);
    }
  };

  const handleCardClick = () => {
    if (onClick) {
      onClick(img);
    } else {
      window.dispatchEvent(
        new CustomEvent("openImageModal", {
          detail: { imageId: img._id, image: img },
        })
      );
    }
  };

  const imageUrl =
    img.imageUrl ||
    (img.imageId
      ? `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${img.imageId}/${img.variant || "public"}`
      : "/default-image.png");

  return (
    <div
      className="mb-4 break-inside-avoid cursor-pointer group relative"
      onClick={handleCardClick}
      role="button"
      title={img.title || "圖片"}
      aria-label={img.title || "圖片"}
    >
      {/* 愛心與數量（固定在卡片右上角） */}
      <div className="absolute top-2 right-2 z-10 bg-black/60 rounded-full px-2 py-1 flex items-center space-x-1">
        <Heart
          key={renderKey}
          onClick={handleLikeClick}
          fill={isLikedLocal ? "#f472b6" : "transparent"}
          color={isLikedLocal ? "#f472b6" : likeCountLocal > 0 ? "#f472b6" : "#ccc"}
          strokeWidth={2.5}
          className={`w-4 h-4 transition duration-200 ${
            canLike ? "hover:scale-110 cursor-pointer" : "opacity-70"
          }`}
        />
        <span className="text-white text-xs">{likeCountLocal}</span>
      </div>

      {/* 縮圖容器（只放圖片與 hover-overlay；不要把常駐標題塞在裡面，避免被縮圖蓋到） */}
      <div className="overflow-hidden rounded-lg relative">
        <img
          src={imageUrl}
          alt={img.title || "圖片"}
          className="w-full max-w-[512px] object-cover transition-all duration-300 transform group-hover:scale-105 group-hover:shadow-lg"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = "/default-image.png";
          }}
        />

        {/* hover 顯示模式：把標題當 overlay 放在圖片上 */}
        {viewMode !== "default" && (
          <div className="absolute bottom-0 left-0 w-full px-3 py-2 bg-white/85 text-black text-sm text-center opacity-0 group-hover:opacity-100 transition-all duration-300">
            {img.title || "未命名圖片"}
          </div>
        )}
      </div>

      {/* 常駐標題模式：把標題放到縮圖容器外面，並與縮圖拉開距離 */}
      {viewMode === "default" && (
        <div className="mt-3 mb-1 px-1 text-white text-sm text-center truncate">
          {img.title || "未命名圖片"}
        </div>
      )}
    </div>
  );
}
