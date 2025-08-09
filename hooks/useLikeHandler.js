import { useCallback } from "react";
import axios from "axios";
import { getTokenFromCookie } from "@/lib/cookie";

export default function useLikeHandler({
  setUploadedImages,
  setLikedImages,
  selectedImage,
  setSelectedImage,
  currentUser
}) {
  const handleToggleLike = useCallback(async (imageId, shouldLike) => {
    try {
      const token = getTokenFromCookie();
      const res = await axios.put(
        `/api/like-image?id=${imageId}`,
        { shouldLike },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const updatedImage = res.data;
      const updateList = (list) =>
        list.map((img) =>
          img._id === updatedImage._id ? { ...img, likes: updatedImage.likes } : img
        );
      setUploadedImages?.((prev) => updateList(prev));
      setLikedImages?.((prev) => updateList(prev));
      if (selectedImage?._id === updatedImage._id) {
        setSelectedImage({ ...selectedImage, likes: [...updatedImage.likes] });
      }
    } catch (err) {
      console.error("點愛心失敗", err);
    }
  }, [selectedImage, setUploadedImages, setLikedImages, setSelectedImage]);

  const onLikeUpdate = useCallback((updated) => {
    setUploadedImages?.((prev) =>
      prev.map((img) => (img._id === updated._id ? updated : img))
    );
    setLikedImages?.((prev) =>
      prev.map((img) => (img._id === updated._id ? updated : img))
    );
    if (selectedImage?._id === updated._id) {
      setSelectedImage(updated);
    }
  }, [selectedImage, setUploadedImages, setLikedImages, setSelectedImage]);

  return { handleToggleLike, onLikeUpdate };
}
