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
}) => {
  return (
    <ImageGrid
      images={images}
      currentUser={currentUser}
      onToggleLike={onToggleLike}
      onSelectImage={onSelectImage}
      isLikedByCurrentUser={isLikedByCurrentUser}
      viewMode={viewMode}
      loadMoreRef={loadMoreRef}
      isLoading={isLoading}
    />
  );
};

export default UserImageGrid;
