"use client";

import dynamic from "next/dynamic";

// 全域 YouTube 橋接（在所有頁面持續運行，確保播放器狀態同步）
const GlobalYouTubeBridge = dynamic(() => import("@/components/player/GlobalYouTubeBridge"), { ssr: false });

export default function GlobalYouTubeBridgeWrapper() {
  return <GlobalYouTubeBridge />;
}

