"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import MusicModal from "@/components/music/MusicModal";

export default function MusicDetailClient({ musicId, musicData, currentUser }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleClose = () => {
    // 关闭弹窗时，导航回音乐列表页
    router.push("/music");
  };

  // 如果没有 musicData 或未挂载，不渲染弹窗
  if (!mounted || !musicData) {
    return null;
  }

  return (
    <MusicModal
      music={musicData}
      onClose={handleClose}
      currentUser={currentUser}
      displayMode="gallery"
    />
  );
}

