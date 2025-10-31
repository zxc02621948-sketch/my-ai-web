"use client";

import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { usePlayer } from "@/components/context/PlayerContext";
import MiniPlayer from "./MiniPlayer";
import GlobalYouTubeBridge from "@/components/player/GlobalYouTubeBridge";

export default function ConditionalPlayer() {
  const pathname = usePathname();
  const player = usePlayer();
  const [isPinned, setIsPinned] = useState(false);
  
  // 只監聽事件，不做 API 調用（由 MiniPlayer 負責）
  useEffect(() => {
    const handlePinnedChange = (e) => {
      const pinned = !!e?.detail?.isPinned;
      setIsPinned(pinned);
      // 全域同步 MiniPlayer 顯示開關，避免各頁面需各自處理
      player?.setMiniPlayerEnabled?.(pinned);
    };
    
    window.addEventListener('pinnedPlayerChanged', handlePinnedChange);
    
    return () => {
      window.removeEventListener('pinnedPlayerChanged', handlePinnedChange);
    };
  }, [player]);
  
  // 检查当前路径是否匹配用户页面
  const isUserPage = pathname.startsWith("/user/") && pathname !== "/user/following";
  
  // 显示逻辑：
  // 1. 如果钉选了，在任何页面都显示
  // 2. 如果没有钉选，只在用户页面显示
  const shouldShowPlayer = isPinned || isUserPage;
  
  // ✅ 總是渲染 MiniPlayer，讓它自己決定是否顯示
  // MiniPlayer 內部會根據 miniPlayerEnabled 和 isPinned 狀態來控制顯示
  return (
    <>
      <MiniPlayer />
      <GlobalYouTubeBridge />
    </>
  );
}
