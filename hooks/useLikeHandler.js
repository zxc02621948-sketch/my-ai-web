import { useCallback } from "react";
import axios from "axios";

export default function useLikeHandler({
  setUploadedImages,
  setLikedImages,
  selectedImage,
  setSelectedImage,
  currentUser
}) {
  const handleToggleLike = useCallback(async (imageId, shouldLike) => {
    try {
      const res = await axios.put(
        `/api/like-image?id=${imageId}`,
        { shouldLike },
        { withCredentials: true }
      );
      const updatedImage = res.data;
      const updateList = (list) =>
        list.map((img) =>
          String(img?._id) === String(updatedImage?._id)
            ? { ...img, likes: updatedImage.likes }
            : img
        );
      setUploadedImages?.((prev) => updateList(prev));
      setLikedImages?.((prev) => updateList(prev));
      if (String(selectedImage?._id) === String(updatedImage?._id)) {
        setSelectedImage({ ...selectedImage, likes: [...updatedImage.likes] });
      }
      // 即時廣播目前登入者的 pointsBalance（若後端有提供）
      const balance = updatedImage?.currentUserPointsBalance;
      const uid = currentUser?._id || currentUser?.id;
      if (typeof balance === "number" && uid) {
        window.dispatchEvent(
          new CustomEvent("points-updated", {
            detail: { userId: String(uid), pointsBalance: Number(balance) },
          })
        );
      }
    } catch (err) {
      console.error("點愛心失敗", err);
      throw err;
    }
  }, [selectedImage, setUploadedImages, setLikedImages, setSelectedImage, currentUser]);

  const onLikeUpdate = useCallback((updated) => {
    if (!updated || !updated._id) return;
    // Update uploadedImages
    setUploadedImages?.(prev => prev.map(img => 
      String(img?._id) === String(updated?._id) ? updated : img
    ));
    
    // Update likedImages
    setLikedImages?.(prev => prev.map(img => 
      String(img?._id) === String(updated?._id) ? updated : img
    ));
    
    // Only update selectedImage if the modal is currently open (selectedImage is not null)
    // AND the updated image matches the currently selected image
    if (selectedImage && String(selectedImage._id) === String(updated._id)) {
      setSelectedImage(updated);
    }
  }, [selectedImage, setUploadedImages, setLikedImages, setSelectedImage]);

  return { handleToggleLike, onLikeUpdate };
}
