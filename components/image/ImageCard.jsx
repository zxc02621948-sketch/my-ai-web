import { Heart } from "lucide-react";

export default function ImageCard({ img, viewMode, onClick, currentUser, isLiked, onToggleLike }) {
  const canLike = !!currentUser;
  const likeCount = img.likes?.length || 0;
  const hasLikes = likeCount > 0;

  // ✅ 圖片 URL fallback 處理
  const imageUrl =
    img.imageUrl ||
    (img.imageId ? `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${img.imageId}/${img.variant || 'public'}` : '/default-image.png');

  return (
    <div
      className="mb-4 break-inside-avoid cursor-pointer group relative"
      onClick={onClick}
    >
      {/* ❤️ 愛心數字與圖示區塊 */}
      <div
        className="absolute top-2 right-2 z-10 bg-black/60 rounded-full px-2 py-1 flex items-center space-x-1"
        onClick={(e) => {
          e.stopPropagation(); // 避免觸發圖片點擊
          if (canLike && onToggleLike) {
            onToggleLike(img._id);
          }
        }}
      >
        <Heart
          fill={isLiked ? "#f472b6" : "transparent"}
          color={hasLikes ? "#f472b6" : "#ccc"}
          strokeWidth={2.5}
          className={`w-4 h-4 transition duration-300 ${
            canLike ? "hover:scale-110 cursor-pointer" : "opacity-70"
          }`}
        />
        <span className="text-white text-xs">{likeCount}</span>
      </div>

      {/* 圖片主體 */}
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
