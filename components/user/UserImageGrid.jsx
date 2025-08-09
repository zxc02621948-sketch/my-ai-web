import React from "react";
import ImageGrid from "@/components/image/ImageGrid";

const UserImageGrid = ({
  images,
  currentUser,
  onToggleLike,
  onSelectImage,
  isLikedByCurrentUser,
  viewMode,
  loadMoreRef,
  isLoading,
  setUploadedImages,
  setLikedImages,
  selectedImage,
  setSelectedImage
}) => {
  return (
    <ImageGrid
      images={images}
      currentUser={currentUser}
      onToggleLike={onToggleLike}
      // ✅ 除錯：點擊圖片時會先打印再執行原本的開圖動作
      onSelectImage={(img) => {
        console.log("✅ 縮圖被點擊：", img);
        onSelectImage?.(img);
      }}
      isLikedByCurrentUser={isLikedByCurrentUser}
      viewMode={viewMode}
      loadMoreRef={loadMoreRef}
      isLoading={isLoading}
      onLikeUpdate={(updated) => {
        // ✅ 同步愛心到上傳列表
        setUploadedImages?.((prev) =>
          prev.map((img) => (img._id === updated._id ? updated : img))
        );
        // ✅ 同步愛心到收藏列表
        setLikedImages?.((prev) =>
          prev.map((img) => (img._id === updated._id ? updated : img))
        );
        // ✅ 同步愛心到大圖
        if (selectedImage?._id === updated._id) {
          setSelectedImage?.(updated);
        }
      }}
    />
  );
};

export default UserImageGrid;
