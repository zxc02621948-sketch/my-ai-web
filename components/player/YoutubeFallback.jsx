"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

// react-youtube 僅在瀏覽器可用，避免 SSR 時載入
const ReactYouTube = dynamic(() => import("react-youtube"), { ssr: false });

export default function YoutubeFallback({ videoId, startSeconds = 0, onReady, onStateChange, onProgress }) {
  
  // 動態獲取當前 origin，確保與應用 URL 一致
  const currentOrigin = typeof window !== "undefined" ? window.location.origin : undefined;
    
  const opts = useMemo(() => ({
    height: "0",
    width: "0",
    host: "https://www.youtube.com",
    playerVars: {
      autoplay: 0,
      mute: 0,
      playsinline: 1,
      controls: 1,
      modestbranding: 1,
      rel: 0,
      start: Math.max(0, Number(startSeconds || 0)),
      origin: currentOrigin,
      enablejsapi: 1,
      iv_load_policy: 3,
      cc_load_policy: 0,
      disablekb: 1,
      fs: 0,
      // 🎯 簡化參數，避免複雜設定導致的問題
      html5: 1,
    },
  }), [currentOrigin, startSeconds]);

  if (!videoId) return null;

  return (
    <div style={{ position: "absolute", left: "-9999px", top: "-9999px" }} aria-hidden>
      <ReactYouTube
        videoId={videoId}
        opts={opts}
        onReady={onReady}
        onStateChange={onStateChange}
        onProgress={onProgress}
        onError={(e) => {
          console.error("🔧 YouTube 播放器錯誤:", e.data);
          
          // 錯誤處理和用戶提示
          const errorMessages = {
            2: "無效的視頻 ID",
            5: "HTML5 播放器錯誤",
            100: "視頻不存在或已被刪除",
            101: "視頻不允許嵌入播放",
            150: "視頻不允許嵌入播放 (嵌入限制)",
            503: "YouTube 服務暫時不可用"
          };
          
          const errorMessage = errorMessages[e.data] || `未知錯誤 (${e.data})`;
          console.warn(`🔧 ${errorMessage}`);
          
          // 針對不同錯誤提供具體建議
          if (e.data === 150 || e.data === 101) {
            console.warn("🔧 解決方案：");
            console.warn("   1) 該視頻可能有嵌入限制，請嘗試其他視頻");
            console.warn("   2) 或直接前往 YouTube 觀看：https://youtube.com/watch?v=" + videoId);
            console.warn("   3) 建議選擇允許嵌入的公開視頻");
            
            // 可以考慮觸發一個事件來通知父組件
            if (typeof window !== "undefined") {
              // 顯示用戶友好的錯誤提示
              const errorEvent = new CustomEvent('youtubeError', {
                detail: {
                  errorCode: e.data,
                  videoId: videoId,
                  message: "該視頻不允許嵌入播放，請嘗試其他視頻或直接前往 YouTube 觀看",
                  youtubeUrl: `https://youtube.com/watch?v=${videoId}`
                }
              });
              window.dispatchEvent(errorEvent);
            }
          } else if (e.data === 100) {
            console.warn("🔧 解決方案：視頻可能已被刪除或設為私人，請嘗試其他視頻");
          } else if (e.data === 503) {
            console.warn("🔧 解決方案：這是 YouTube 服務的暫時問題，請稍後重試");
          } else if (e.data === 2) {
            console.warn("🔧 解決方案：請檢查視頻 ID 是否正確");
          }
        }}
      />
    </div>
  );
}