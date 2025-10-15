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
    playerVars: {
      autoplay: 0, // 禁用自動播放，避免錯誤 150
      mute: 0, // 不靜音
      playsinline: 1,
      controls: 1,
      modestbranding: 1,
      rel: 0, // 不顯示相關視頻
      start: Math.max(0, Number(startSeconds || 0)),
      origin: currentOrigin,
      enablejsapi: 1,
      iv_load_policy: 3, // 不顯示註釋
      cc_load_policy: 0, // 不顯示字幕
      disablekb: 1, // 禁用鍵盤控制
      fs: 0, // 禁用全屏
      // 音頻質量設置 - 修復聲調問題
      quality: "medium", // 使用中等質量，避免音頻問題
      // 添加更多兼容性設置來避免錯誤 150
      allowfullscreen: 0,
      allowscriptaccess: "always",
      wmode: "transparent",
      // 添加隱私設置
      privacy: 1, // 啟用隱私增強模式
      // 添加更多錯誤處理設置
      error: 0, // 禁用錯誤覆蓋
      // 添加更多設置來避免錯誤 150
      hl: "zh-TW", // 設置語言
      cc_lang_pref: "zh-TW", // 字幕語言偏好
      // 嘗試不同的嵌入設置
      embed: 1, // 強制嵌入模式
      // 添加更多兼容性設置
      widget_referrer: currentOrigin,
      // 添加音頻相關設置來修復聲調問題
      audioQuality: "medium", // 設置音頻質量
      audioMode: "normal", // 設置音頻模式
      audioTrack: "default", // 設置音頻軌道
      // 添加更多設置來避免 503 錯誤
      loadPolicy: 1, // 設置載入策略
      playerapiid: 1, // 啟用播放器 API ID
      // 添加更多穩定性設置
      html5: 1, // 強制使用 HTML5 播放器
    },
  }), [currentOrigin, startSeconds]); // 依賴 currentOrigin 和 startSeconds

  if (!videoId) return null;

  return (
    <div style={{ position: "absolute", left: "-9999px", top: "-9999px" }} aria-hidden>
      <ReactYouTube
        key={videoId} // 確保 videoId 變化時重新創建
        videoId={videoId}
        opts={opts}
        onReady={onReady}
        onStateChange={onStateChange}
        onProgress={onProgress}
        onError={(e) => {
          console.error("🔧 YouTube 播放器錯誤:", e.data);
          if (e.data === 101 || e.data === 150) {
            console.warn("🔧 視頻不允許嵌入播放 (錯誤 150)，這通常表示視頻有嵌入限制");
            console.warn("🔧 建議：1) 檢查視頻是否允許嵌入 2) 嘗試其他視頻 3) 使用原始 YouTube 鏈接");
            console.warn("🔧 解決方案：嘗試使用不同的視頻或檢查視頻的嵌入設置");
            // 當視頻不允許嵌入時，可以嘗試其他播放方式
            // 例如：重定向到 YouTube 原始頁面或使用其他播放器
          } else if (e.data === 2) {
            console.warn("🔧 無效的視頻 ID");
          } else if (e.data === 5) {
            console.warn("🔧 HTML5 播放器錯誤");
          } else if (e.data === 100) {
            console.warn("🔧 視頻不存在或已被刪除");
          } else if (e.data === 101) {
            console.warn("🔧 視頻不允許嵌入播放");
          } else if (e.data === 503) {
            console.warn("🔧 YouTube 服務暫時不可用 (503 錯誤)");
            console.warn("🔧 建議：1) 等待幾分鐘後重試 2) 檢查網絡連接 3) 嘗試其他視頻");
            console.warn("🔧 解決方案：這通常是 YouTube 服務的暫時問題，請稍後重試");
          }
        }}
      />
    </div>
  );
}