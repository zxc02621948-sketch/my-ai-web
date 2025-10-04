"use client";

import { useMemo, useRef, useEffect } from "react";
import { usePlayer } from "@/components/context/PlayerContext";
import YoutubeFallback from "@/components/player/YoutubeFallback";

export default function GlobalYouTubeBridge() {
  const player = usePlayer();
  const ytRef = useRef(null);
  const progressTimerRef = useRef(null);

  const videoId = useMemo(() => {
    const u = String(player?.originUrl || player?.src || "").trim();
    if (!u) return "";
    try {
      const url = new URL(u);
      const isYT = /youtube\.com|youtu\.be/.test(url.hostname);
      if (!isYT) return "";
      return url.searchParams.get("v") || url.pathname.split("/").filter(Boolean).pop() || "";
    } catch {
      return "";
    }
  }, [player?.originUrl, player?.src]);

  if (!videoId) return null;

  return (
    <YoutubeFallback
      key={`${videoId}:${player?.bridgeNonce || 0}`}
      videoId={videoId}
      onReady={(e) => {
        try {
          const p = e?.target;
          ytRef.current = p;
          player?.setExternalControls?.({
            play: () => p.playVideo?.(),
            pause: () => p.pauseVideo?.(),
            setVolume: (v0to1) => {
              try { p.unMute?.(); p.setVolume?.(Math.round(v0to1 * 100)); } catch {}
            },
          });
          const st = p?.getPlayerState?.();
          player?.setExternalPlaying?.(st === 1);
          // 初始化一次進度
          try {
            const ct = Number(p?.getCurrentTime?.() || 0);
            const du = Number(p?.getDuration?.() || 0);
            player?.setExternalProgress?.({ currentTime: ct, duration: du });
          } catch {}
          // 若切歌後要求自動播放，橋接就緒即開始播放並清除旗標
          try {
            if (player?.autoPlayAfterBridge) {
              p.playVideo?.();
              player?.setAutoPlayAfterBridge?.(false);
            }
          } catch {}
          // 同步 YouTube 當前音量到 PlayerContext，讓迷你播放器滑桿與實際音量一致
          try {
            const muted = typeof p?.isMuted === 'function' ? !!p.isMuted() : false;
            const volPercent = typeof p?.getVolume === 'function' ? Number(p.getVolume()) : 100;
            const vol0to1 = muted ? 0 : Math.max(0, Math.min(1, volPercent / 100));
            const current = Number(player?.volume ?? 0.8);
            if (!Number.isNaN(vol0to1) && Math.abs(current - vol0to1) > 0.01) {
              player?.setVolume?.(vol0to1);
            }
          } catch {}
        } catch {}
      }}
      onStateChange={(evt) => {
        try {
          const code = evt?.data;
          const playing = code === 1;
          player?.setExternalPlaying?.(playing);
          // 播放中：啟動進度輪詢
          if (playing) {
            if (!progressTimerRef.current) {
              progressTimerRef.current = setInterval(() => {
                try {
                  const p = ytRef.current;
                  const ct = Number(p?.getCurrentTime?.() || 0);
                  const du = Number(p?.getDuration?.() || 0);
                  player?.setExternalProgress?.({ currentTime: ct, duration: du });
                } catch {}
              }, 500);
            }
          } else {
            // 非播放狀態：關閉輪詢
            if (progressTimerRef.current) {
              try { clearInterval(progressTimerRef.current); } catch {}
              progressTimerRef.current = null;
            }
            // 影片結束（code===0）時嘗試切到下一首（若外部已提供 next 控制）
            if (code === 0) {
              try { player?.next?.(); } catch {}
            }
          }
        } catch {}
      }}
    />
  );
}