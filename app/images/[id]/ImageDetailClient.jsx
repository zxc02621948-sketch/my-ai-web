"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ImageModal from "@/components/image/ImageModal";

export default function ImageDetailClient({ imageId, imageData, currentUser }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleClose = () => {
    // 关闭弹窗时，导航回图片列表页
    router.push("/images");
  };

  // 确保客户端渲染后再显示弹窗
  if (!mounted || (!imageId && !imageData)) {
    return null;
  }

  return (
    <ImageModal
      imageId={imageId}
      imageData={imageData}
      currentUser={currentUser}
      displayMode="gallery"
      onClose={handleClose}
    />
  );
}

