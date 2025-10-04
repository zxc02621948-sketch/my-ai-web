"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

const PlayerContext = createContext(null);

export function PlayerProvider({ children, defaultShareMode = "global", defaultMiniPlayerEnabled = true, defaultSeekable = false, tabBehavior = "pause_resume" }) {
  const audioRef = useRef(null);
  const [src, setSrc] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [originUrl, setOriginUrl] = useState("");
  const [trackTitle, setTrackTitle] = useState("");
  const [miniPlayerEnabled, setMiniPlayerEnabled] = useState(!!defaultMiniPlayerEnabled);
  const [seekable, setSeekable] = useState(!!defaultSeekable);
  const [shareMode, setShareMode] = useState(defaultShareMode); // "global" | "page"
  const pausedByTabRef = useRef(false);
  // 外部播放橋接（例如 YouTube 內嵌播放器），提供 play/pause/volume/next/prev 控制
  const externalControlsRef = useRef(null);
  // 橋接重置 nonce：當需要強制重新掛載橋接時遞增
  const [bridgeNonce, setBridgeNonce] = useState(0);
  // 於切歌後希望橋接就緒即自動播放
  const [autoPlayAfterBridge, setAutoPlayAfterBridge] = useState(false);
  // 全域播放清單（由頁面註冊供迷你播放器/全域橋接使用）
  const [playlist, setPlaylist] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);

  // 初始化 Audio
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;
    audio.preload = "metadata";
    audio.crossOrigin = "anonymous";
    audio.volume = volume;

    const onLoaded = () => {
      setDuration(Number(audio.duration || 0));
    };
    const onTime = () => {
      setCurrentTime(Number(audio.currentTime || 0));
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);

    // 分頁切換行為
    const onVisibility = () => {
      if (!audioRef.current) return;
      const hidden = document.hidden;
      if (tabBehavior === "pause_resume") {
        if (hidden) {
          if (!audio.paused) {
            pausedByTabRef.current = true;
            audio.pause();
          }
        } else {
          if (pausedByTabRef.current && src) {
            pausedByTabRef.current = false;
            // 嘗試恢復播放（需使用者互動才保證成功）
            audio.play().catch(() => {});
          }
        }
      } else if (tabBehavior === "pause_only") {
        // 分頁隱藏時自動暫停；回到分頁不自動恢復
        if (hidden) {
          if (!audio.paused) {
            pausedByTabRef.current = true;
            audio.pause();
          }
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      audio.pause();
      audio.src = "";
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, [tabBehavior]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const api = useMemo(() => {
    const deriveTitle = (u) => {
      try {
        const url = new URL(String(u || ""));
        const host = url.hostname || "";
        const isYT = /youtube\.com|youtu\.be/.test(host);
        if (isYT) {
          // 避免顯示成 "watch"，優先取 videoId 或主機名稱
          const vid = url.searchParams.get("v") || url.pathname.split("/").filter(Boolean).pop() || "YouTube";
          return String(vid);
        }
        const last = url.pathname.split("/").filter(Boolean).pop() || host;
        return decodeURIComponent(last);
      } catch {
        return String(u || "");
      }
    };
    return {
      setSource: (url) => {
        const s = String(url || "");
        setSrc(s);
        if (audioRef.current) {
          // 檢查是否為 YouTube URL，如果是則使用代理 API
          let finalUrl = s;
          try {
            const u = new URL(s);
            const isYouTube = /youtube\.com|youtu\.be/.test(u.hostname);
            if (isYouTube) {
              finalUrl = `/api/audio-proxy?url=${encodeURIComponent(s)}`;
            }
          } catch {
            // 如果 URL 解析失敗，使用原始 URL
          }
          
          audioRef.current.src = finalUrl;
          // 重新載入以更新 metadata
          audioRef.current.load();
        }
      },
      setOriginUrl: (u) => {
        setOriginUrl(String(u || ""));
      },
      setTrackTitle: (t) => {
        setTrackTitle(String(t || ""));
      },
      // 註冊外部播放控制（例如 YouTube 內嵌播放器）
      setExternalControls: (controls) => {
        // controls: { play: ()=>void|Promise, pause: ()=>void, setVolume?: (v0to1:number)=>void, next?: ()=>void, prev?: ()=>void }
        externalControlsRef.current = controls || null;
      },
      // 外部播放狀態回報（用於同步 isPlaying 顯示）
      setExternalPlaying: (val) => {
        setIsPlaying(!!val);
      },
      // 外部進度回報（用於同步 currentTime/duration 顯示）
      setExternalProgress: (payload) => {
        try {
          if (payload && typeof payload === "object") {
            const ct = Number(payload.currentTime ?? payload.ct ?? 0);
            const du = Number(payload.duration ?? payload.du ?? duration);
            setCurrentTime(isFinite(ct) ? ct : 0);
            if (isFinite(du) && du > 0) setDuration(du);
          } else {
            const ct = Number(payload ?? 0);
            setCurrentTime(isFinite(ct) ? ct : 0);
          }
        } catch {}
      },
      // 手動要求重置外部橋接（觸發重新掛載）
      resetExternalBridge: () => {
        setBridgeNonce((n) => n + 1);
      },
      // 註冊/更新全域播放清單與索引（供外部橋接與迷你播放器使用）
      setPlaylist: (list) => {
        try {
          const arr = Array.isArray(list) ? list.filter(Boolean) : [];
          setPlaylist(arr);
          // 若目前索引超出範圍，回到 0
          setActiveIndex((i) => (arr.length ? Math.max(0, Math.min(i, arr.length - 1)) : 0));
        } catch {}
      },
      setActiveIndex: (i) => {
        const idx = Math.max(0, Math.min(Number(i) || 0, Math.max(0, playlist.length - 1)));
        setActiveIndex(idx);
      },
      play: async () => {
        // 若有外部控制，優先呼叫外部的 play，並確保本地 Audio 停止避免雙重播放
        if (externalControlsRef.current) {
          try {
            if (audioRef.current && !audioRef.current.paused) {
              try { audioRef.current.pause(); } catch {}
            }
            await Promise.resolve(externalControlsRef.current.play?.());
            setIsPlaying(true);
            return true;
          } catch {
            // 外部播放失敗則回退到 Audio
          }
        }

        // 無外部控制時，若來源為 YouTube，使用代理 API 避免 CORS 問題
        const rawUrl = String(originUrl || src || "").trim();
        let isYouTube = false;
        try {
          const u = new URL(rawUrl);
          isYouTube = /youtube\.com|youtu\.be/.test(u.hostname);
        } catch {}

        if (isYouTube) {
          // 對於 YouTube URL，直接使用 YouTube 播放器，不使用代理
          try { audioRef.current?.pause?.(); } catch {}
          setBridgeNonce((n) => n + 1);
          const started = Date.now();
          while (Date.now() - started < 4000) {
            if (externalControlsRef.current && typeof externalControlsRef.current.play === "function") {
              try {
                await Promise.resolve(externalControlsRef.current.play());
                setIsPlaying(true);
                return true;
              } catch {}
            }
            await new Promise((r) => setTimeout(r, 100));
          }
          return false;
        }

        // 其他一般音訊來源：直接使用本地 Audio
        if (!audioRef.current || !src) return false;
        try {
          await audioRef.current.play();
          setIsPlaying(true);
          return true;
        } catch (e) {
          // 傳回 false 讓 UI 可以顯示播放失敗原因（非直接音檔、CORS、混合內容等）
          return false;
        }
      },
      pause: () => {
        // 同時暫停外部播放器與本地 Audio，避免殘留聲音
        if (externalControlsRef.current) {
          try { externalControlsRef.current.pause?.(); } catch {}
        }
        if (audioRef.current) {
          try { audioRef.current.pause(); } catch {}
        }
        setIsPlaying(false);
      },
      next: async () => {
        // 內建清單切換（循環）
        if (playlist.length) {
          const ni = (activeIndex + 1) % playlist.length;
          setActiveIndex(ni);
          const item = playlist[ni];
          const url = String(item?.url || item);
          if (url) {
            setOriginUrl(url);
            setTrackTitle(item?.title || deriveTitle(url));
            // 切歌時先重置進度，避免沿用上一首的時間與總長度
            try { setCurrentTime(0); setDuration(0); } catch {}
            // 清除舊外部控制以避免誤觸舊實例的播放，並要求新橋接就緒後自動播放
            try { externalControlsRef.current = null; } catch {}
            setAutoPlayAfterBridge(true);
            setBridgeNonce((n) => n + 1);
            // 輕量輪詢等待新外部控制註冊後立即播放（確保使用者互動觸發）
            const started = Date.now();
            while (Date.now() - started < 4000) {
              if (externalControlsRef.current && typeof externalControlsRef.current.play === "function") {
                try { await Promise.resolve(externalControlsRef.current.play()); setIsPlaying(true); return; } catch {}
              }
              await new Promise((r) => setTimeout(r, 100));
            }
          }
        }
      },
      previous: async () => {
        // 內建清單切換（循環）
        if (playlist.length) {
          const pi = (activeIndex - 1 + playlist.length) % playlist.length;
          setActiveIndex(pi);
          const item = playlist[pi];
          const url = String(item?.url || item);
          if (url) {
            setOriginUrl(url);
            setTrackTitle(item?.title || deriveTitle(url));
            // 切歌時先重置進度，避免沿用上一首的時間與總長度
            try { setCurrentTime(0); setDuration(0); } catch {}
            // 清除舊外部控制以避免誤觸舊實例的播放，並要求新橋接就緒後自動播放
            try { externalControlsRef.current = null; } catch {}
            setAutoPlayAfterBridge(true);
            setBridgeNonce((n) => n + 1);
            const started = Date.now();
            while (Date.now() - started < 4000) {
              if (externalControlsRef.current && typeof externalControlsRef.current.play === "function") {
                try { await Promise.resolve(externalControlsRef.current.play()); setIsPlaying(true); return; } catch {}
              }
              await new Promise((r) => setTimeout(r, 100));
            }
          }
        }
      },
      setVolume: (v) => {
        const nv = Math.max(0, Math.min(1, Number(v)));
        setVolume(nv);
        // 同步外部播放器音量（以 0~1 正規化）
        if (externalControlsRef.current && externalControlsRef.current.setVolume) {
          try { externalControlsRef.current.setVolume(nv); } catch {}
        }
      },
      // 進度不可拖動，提供只讀 setter 以防未來切換
      setSeekable: (val) => setSeekable(!!val),
      setMiniPlayerEnabled: (val) => {
        const enabled = !!val;
        setMiniPlayerEnabled(enabled);
        // 當關閉迷你播放器時，強制停止所有播放來源避免「看不到但持續播放」
        if (!enabled) {
          try { externalControlsRef.current?.pause?.(); } catch {}
          try { audioRef.current?.pause(); } catch {}
          setIsPlaying(false);
        }
      },
      setShareMode: (mode) => setShareMode(mode === "page" ? "page" : "global"),
      // 允許拖動進度：支援本地 Audio；若外部播放器提供 seekTo 則委派
      seekTo: (seconds) => {
        try {
          const t = Math.max(0, Math.min(Number(seconds) || 0, Number(duration || 0)));
          if (externalControlsRef.current && typeof externalControlsRef.current.seekTo === "function") {
            try { externalControlsRef.current.seekTo(t); } catch {}
          }
          if (audioRef.current) {
            try { audioRef.current.currentTime = t; } catch {}
          }
          setCurrentTime(t);
        } catch {}
      },
    };
  }, [src, originUrl, playlist, activeIndex, duration]);

  const value = {
    // 狀態
    src,
    isPlaying,
    currentTime,
    duration,
    volume,
    originUrl,
    trackTitle,
    miniPlayerEnabled,
    seekable,
    shareMode,
    bridgeNonce,
    playlist,
    activeIndex,
    autoPlayAfterBridge,
    setAutoPlayAfterBridge,
    // 事件 API
    ...api,
  };

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  return useContext(PlayerContext);
}