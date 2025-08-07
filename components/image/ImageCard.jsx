import { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import { flushSync } from "react-dom"; // 💡 新增：強制同步更新

export default function ImageCard({
  img,
  viewMode,
  onClick,
  currentUser,
  isLiked,
  onToggleLike,
  onLocalLikeChange,
}) {
  const canLike = !!currentUser;
  const [isLikedLocal, setIsLikedLocal] = useState(isLiked);
  const [likeCountLocal, setLikeCountLocal] = useState(img.likes?.length || 0);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    setIsLikedLocal(isLiked);
    setLikeCountLocal(img.likes?.length || 0);
  }, [isLiked, img.likes]);

  const handleLikeClick = async (e) => {
    e.stopPropagation();
    if (!canLike || !onToggleLike || isProcessing) return;

    const newLikeState = !isLikedLocal;
    setIsProcessing(true);

    // ✅ 強制同步畫面更新（秒亮愛心）
    flushSync(() => {
      setIsLikedLocal(newLikeState);
      setLikeCountLocal((prev) => prev + (newLikeState ? 1 : -1));
    });

    try {
      await onToggleLike(img._id, newLikeState);
      onLocalLikeChange?.(img._id, newLikeState); // ✅ 正確同步外部資料
    } catch (err) {
      console.error("❌ 愛心更新錯誤", err);
      // 還原畫面
      flushSync(() => {
        setIsLikedLocal((prev) => !prev);
        setLikeCountLocal((prev) => prev + (newLikeState ? -1 : 1));
      });
    } finally {
      setIsProcessing(false);
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
      onClick={onClick}
    >
      <div className="absolute top-2 right-2 z-10 bg-black/60 rounded-full px-2 py-1 flex items-center space-x-1">
        <Heart
          onClick={handleLikeClick}
          fill={isLikedLocal ? "#f472b6" : "transparent"}
          color={isLikedLocal ? "#f472b6" : "#ccc"}
          strokeWidth={2.5}
          className={`w-4 h-4 transition duration-200 ${
            canLike ? "hover:scale-110 cursor-pointer" : "opacity-70"
          }`}
        />
        <span className="text-white text-xs">{likeCountLocal}</span>
      </div>

      <div className="overflow-hidden rounded-lg">
        <img
          src={imageUrl}
          alt={img.title || "圖片"}
          className="w-full max-w-[512px] object-cover transition-all duration-300 transform group-hover:scale-105 group-hover:shadow-lg"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = "/default-image.png";
          }}
        />
        {viewMode === "default" ? (
          <div className="mt-1 text-white text-sm text-center truncate">
            {img.title || "未命名圖片"}
          </div>
        ) : (
          <div className="absolute bottom-0 left-0 w-full px-2 py-1 bg-white/80 text-black text-sm text-center opacity-0 group-hover:opacity-100 transition-all duration-300">
            {img.title || "未命名圖片"}
          </div>
        )}
      </div>
    </div>
  );
}
