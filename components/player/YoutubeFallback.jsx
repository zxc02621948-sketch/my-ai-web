"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

// react-youtube 僅在瀏覽器可用，避免 SSR 時載入
const ReactYouTube = dynamic(() => import("react-youtube"), { ssr: false });

export default function YoutubeFallback({ videoId, startSeconds = 0, onReady, onStateChange }) {
  const autoplayWithSound = typeof window !== "undefined"
    ? (localStorage.getItem("player.autoplaySound") !== "false")
    : true;
  const opts = useMemo(() => ({
    height: "0",
    width: "0",
    playerVars: {
      // 預設不自動播放，確保載入但暫停
      autoplay: 0,
      // 依設定決定是否靜音
      mute: autoplayWithSound ? 0 : 1,
      playsinline: 1,
      controls: 1,
      modestbranding: 1,
      rel: 0,
      start: Math.max(0, Number(startSeconds || 0)),
      // 添加 origin 參數來解決 postMessage 錯誤
      origin: typeof window !== "undefined" ? window.location.origin : "http://localhost:3000",
      // 啟用隱私模式
      enablejsapi: 1,
      // 禁用相關視頻
      rel: 0,
      // 禁用註釋
      iv_load_policy: 3,
    },
  }), [startSeconds, autoplayWithSound]);

  if (!videoId) return null;

  return (
    <div style={{ position: "absolute", left: "-9999px", top: "-9999px" }} aria-hidden>
      <ReactYouTube
        videoId={videoId}
        opts={opts}
        onReady={(e) => {
          try {
            const player = e?.target;
            // 僅完成載入不自動播放
            // 若需要，外部按鈕會呼叫 playVideo()
          } catch {}
          onReady?.(e);
        }}
        onStateChange={onStateChange}
      />
    </div>
  );
}