"use client";

import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { audioManager } from "@/utils/audioManager";

const PlayerContext = createContext();

export function PlayerProvider({
  children,
  defaultShareMode = "global",
  defaultMiniPlayerEnabled = true,
  defaultSeekable = false,
}) {
  const [src, setSrc] = useState("");

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // ✅ 記錄播放器在被打斷前的播放狀態（用於高優先級音源關閉後恢復）
  const wasPlayingBeforeInterruptionRef = useRef(false);

  // ✅ 從 localStorage 讀取音量，預設為 1.0 (100%)
  const [volume, setVolumeState] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("playerVolume");
        if (saved) {
          const vol = parseFloat(saved);
          if (!isNaN(vol) && vol >= 0 && vol <= 1) {
            return vol;
          }
        }
      } catch (e) {
        console.warn("讀取音量失敗:", e);
      }
    }
    return 1.0; // 預設 100%
  });
  // ✅ 追蹤音量是否已同步到播放器
  const [volumeSynced, setVolumeSynced] = useState(true);

  // ✅ 音量設置函數
  const setVolume = useCallback((newVolume) => {
    // ✅ 驗證輸入是否為有效數字
    if (
      typeof newVolume !== "number" ||
      isNaN(newVolume) ||
      !isFinite(newVolume)
    ) {
      console.warn("無效的音量值", newVolume);
      return;
    }

    // ✅ 確保音量值在有效範圍內 (0-1)
    const validVolume = Math.max(0, Math.min(1, newVolume));

    // ✅ 更新狀態
    setVolumeState(validVolume);

    // ✅ 保存到 localStorage
    try {
      localStorage.setItem("playerVolume", validVolume.toString());
    } catch (e) {
      console.warn("保存音量失敗:", e);
    }

    // ✅ 標記為已同步
    setVolumeSynced(true);

    // ✅ 更新本地音頻播放器音量
    if (audioRef.current) {
      try {
        audioRef.current.volume = validVolume;
      } catch (error) {
        console.warn("設置本地音頻音量失敗:", error.message);
      }
    }
  }, []);
  const [originUrl, setOriginUrlState] = useState("");
  const setOriginUrl = useCallback((newUrl) => {
    setOriginUrlState(newUrl);
  }, []);
  const [trackTitle, setTrackTitle] = useState("");
  const [shareMode, setShareMode] = useState(defaultShareMode);
  const [miniPlayerEnabled, setMiniPlayerEnabled] = useState(
    defaultMiniPlayerEnabled,
  );
  const [seekable, setSeekable] = useState(defaultSeekable);
  const [playlistState, setPlaylistState] = useState([]);
  const [activeIndexState, setActiveIndexState] = useState(0);
  const [shuffleAllowedState, setShuffleAllowedState] = useState(false);
  const [shuffleEnabledState, setShuffleEnabledState] = useState(false);
  const playlist = playlistState;
  const activeIndex = activeIndexState;
  const shuffleAllowed = shuffleAllowedState;
  const shuffleEnabled = shuffleEnabledState;

  // ✅ 播放器擁有者（用於顯示釘選按鈕等功能）
  const [playerOwnerState, setPlayerOwnerState] = useState(null); // { userId, username, allowShuffle? }
  const playerOwner = playerOwnerState;

  const audioRef = useRef(null);
  const currentTimeRef = useRef(0);
  const lastUpdateTimeRef = useRef(0);
  const retryCountRef = useRef(0);
  const isTransitioningRef = useRef(false); // ✅ 追蹤是否正在切換歌曲
  const playlistRef = useRef(playlist); // ✅ 保存播放清單引用
  const activeIndexRef = useRef(activeIndex); // ✅ 保存當前索引引用
  const shuffleQueueRef = useRef([]);
  const shuffleHistoryRef = useRef([]);
  const shuffleAllowedRef = useRef(shuffleAllowed);
  const shuffleEnabledRef = useRef(shuffleEnabled);
  const pinnedOwnerRef = useRef(null);
  const wasPlayingBeforeHiddenRef = useRef(false); // ✅ 追蹤頁面隱藏前是否在播放
  const wasPausedByAudioManagerRef = useRef(false); // ✅ 追蹤是否被 AudioManager 暫停（不應自動恢復）
  const playbackAttemptRef = useRef(null);

  const cancelPlaybackAttempt = useCallback(() => {
    const attempt = playbackAttemptRef.current;
    if (attempt && typeof attempt.cancel === "function") {
      attempt.cancel();
    }
    playbackAttemptRef.current = null;
  }, []);

  const regenerateShuffleQueue = useCallback((currentIdx) => {
    const list = playlistRef.current || [];
    if (!Array.isArray(list) || list.length <= 1) {
      shuffleQueueRef.current = [];
      return;
    }

    const indices = [];
    for (let i = 0; i < list.length; i += 1) {
      if (i !== currentIdx) {
        indices.push(i);
      }
    }

    for (let i = indices.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    shuffleQueueRef.current = indices;
  }, []);

  const resetShuffleState = useCallback(
    (currentIdx) => {
      shuffleHistoryRef.current = [];
      if (shuffleEnabledRef.current) {
        regenerateShuffleQueue(
          typeof currentIdx === "number" ? currentIdx : activeIndexRef.current,
        );
      } else {
        shuffleQueueRef.current = [];
      }
    },
    [regenerateShuffleQueue],
  );

  const setShuffleAllowed = useCallback((value) => {
    const normalized = !!value;
    setShuffleAllowedState(normalized);
    shuffleAllowedRef.current = normalized;
    if (!normalized) {
      setShuffleEnabledState(false);
      shuffleEnabledRef.current = false;
      shuffleQueueRef.current = [];
      shuffleHistoryRef.current = [];
    }
  }, []);

  const setShuffleEnabled = useCallback(
    (value) => {
      const normalized = !!value;
      if (normalized && !shuffleAllowedRef.current) {
        setShuffleEnabledState(false);
        shuffleEnabledRef.current = false;
        return false;
      }

      setShuffleEnabledState((prev) => {
        if (prev === normalized) {
          return prev;
        }
        shuffleEnabledRef.current = normalized;
        if (normalized) {
          resetShuffleState(activeIndexRef.current);
        } else {
          shuffleQueueRef.current = [];
          shuffleHistoryRef.current = [];
        }
        return normalized;
      });

      return normalized;
    },
    [resetShuffleState],
  );

  const setPlaylist = useCallback(
    (nextPlaylist) => {
      const normalized = Array.isArray(nextPlaylist)
        ? nextPlaylist.map((item) => ({
            title: item?.title ? String(item.title) : "",
            url: item?.url ? String(item.url) : "",
          }))
        : [];

      setPlaylistState(normalized);
      playlistRef.current = normalized;

      const listLength = normalized.length;
      if (listLength === 0) {
        setActiveIndexState(0);
        activeIndexRef.current = 0;
        shuffleQueueRef.current = [];
        shuffleHistoryRef.current = [];
        setIsPlaying(false);
        if (audioRef.current) {
          try {
            audioRef.current.pause();
          } catch {}
        }
        return;
      }

      if (activeIndexRef.current >= listLength) {
        setActiveIndexState(0);
        activeIndexRef.current = 0;
      }

      resetShuffleState(activeIndexRef.current);
    },
    [resetShuffleState],
  );

  const setActiveIndex = useCallback(
    (index, options = {}) => {
      const list = playlistRef.current || [];
      const listLength = list.length;

      if (listLength === 0) {
        setActiveIndexState(0);
        activeIndexRef.current = 0;
        return;
      }

      const safeIndex = Math.max(0, Math.min(Number(index) || 0, listLength - 1));
      setActiveIndexState(safeIndex);
      activeIndexRef.current = safeIndex;

      if (!options.skipShuffleReset) {
        resetShuffleState(safeIndex);
      }
    },
    [resetShuffleState],
  );

  const setPlayerOwner = useCallback(
    (owner) => {
      setPlayerOwnerState((prevOwner) => {
        if (!owner) {
          if (shuffleAllowedRef.current) {
            setShuffleAllowed(false);
          }
          return null;
        }

        const normalized = { ...owner };

        if (typeof normalized.allowShuffle !== "boolean") {
          if (
            prevOwner &&
            prevOwner.userId &&
            prevOwner.userId === normalized.userId
          ) {
            normalized.allowShuffle =
              typeof prevOwner.allowShuffle === "boolean"
                ? prevOwner.allowShuffle
                : false;
          } else {
            normalized.allowShuffle = false;
            if (shuffleAllowedRef.current) {
              setShuffleAllowed(false);
            }
            return normalized;
          }
        }

        const pinned = pinnedOwnerRef.current;
        if (pinned && pinned.userId === normalized.userId) {
          if (typeof pinned.allowShuffle === "boolean") {
            normalized.allowShuffle = pinned.allowShuffle;
          }
        }

        const normalizedAllow = !!normalized.allowShuffle;
        normalized.allowShuffle = normalizedAllow;

        const hasPrev = (() => {
          if (!prevOwner) {
            return false;
          }
          const prevKeys = Object.keys(prevOwner);
          const nextKeys = Object.keys(normalized);
          if (prevKeys.length !== nextKeys.length) {
            return false;
          }
          for (const key of nextKeys) {
            if (prevOwner[key] !== normalized[key]) {
              return false;
            }
          }
          return true;
        })();

        if (hasPrev) {
          if (shuffleAllowedRef.current !== normalizedAllow) {
            setShuffleAllowed(normalizedAllow);
          }
          return prevOwner;
        }

        if (shuffleAllowedRef.current !== normalizedAllow) {
          setShuffleAllowed(normalizedAllow);
        }

        return normalized;
      });
    },
    [setShuffleAllowed],
  );

  const setPinnedOwnerInfo = useCallback((info) => {
    if (info && info.userId) {
      pinnedOwnerRef.current = {
        userId: info.userId,
        allowShuffle: typeof info.allowShuffle === "boolean" ? info.allowShuffle : null,
        shuffleEnabled: typeof info.shuffleEnabled === "boolean" ? info.shuffleEnabled : null,
      };
    } else {
      pinnedOwnerRef.current = null;
    }
  }, []);

  // ✅ 頁面擁有者的播放器造型（用於顯示特定造型）
  const [pageOwnerSkin, setPageOwnerSkin] = useState(null); // { activePlayerSkin, playerSkinSettings, premiumPlayerSkin }

  // ✅ ready 標記清理 useEffect
  useEffect(() => {
    return () => {
      // ✅ 清理 ready 標記
      // (不再需要清理 YouTube 相關標記)
    };
  }, []);

  // ✅ 使用 useCallback 避免無限循環
  const onLoaded = useCallback(() => {
    if (audioRef.current) {
      setDuration((audioRef.current && audioRef.current.duration) || 0);
    }
  }, []);

  const onTime = useCallback(() => {
    if (audioRef.current) {
      const newTime = (audioRef.current && audioRef.current.currentTime) || 0;
      currentTimeRef.current = newTime;

      // ✅ 追蹤播放進度並在達到 10% 時記錄播放次數
      const audio = audioRef.current;
      const duration = audio.duration;
      if (duration > 0 && newTime > 0) {
        const startTime = parseFloat(audio.dataset.startTime || "0");
        // ✅ 計算實際播放時長 - 從開始播放位置計算
        const playedDuration = Math.max(0, newTime - startTime);
        // ✅ 計算播放百分比
        const playedPercent = (playedDuration / duration) * 100;
        // ✅ 如果 URL 是音樂流媒體 URL (例如 /api/music/stream/${id})
        if (src && src.includes("/api/music/stream/")) {
          const musicId = src.match(/\/api\/music\/stream\/([^/?]+)/)?.[1];
          if (musicId) {
            // ✅ 當播放進度達到 10% 時，記錄播放次數
            // ✅ 使用 dataset 標記避免重複報告
            if (playedPercent >= 10 && !audio.dataset.progressReported) {
              audio.dataset.progressReported = "true";
              // ✅ 調用 API 記錄播放進度
              fetch(`/api/music/${musicId}/track-progress`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  progress: newTime,
                  duration: duration,
                  startTime: startTime,
                  playedDuration: playedDuration,
                }),
              }).catch(() => {
                // ✅ 忽略網絡錯誤
              });
            }
          }
        }
      }

      // ✅ 更新 setCurrentTime（如果需要）
      // ✅ 這裡可以添加節流邏輯，避免過度更新 UI
    }
  }, [src]);

  const onPlay = useCallback(() => {
    // ✅ 只處理本地音頻播放器
    setIsPlaying(true);

    // ✅ 記錄開始播放時間
    if (audioRef.current) {
      const startTime = audioRef.current.currentTime;
      // ✅ 保存開始播放位置到 dataset
      audioRef.current.dataset.startTime = startTime.toString();
    }
  }, []);

  const onPause = useCallback(() => {
    // ✅ 只處理本地音頻播放器
    setIsPlaying(false);
  }, []);

  // ✅ 預先聲明 nextRef，將在 next 函數定義後設置
  const nextRef = useRef(null);

  // ✅ 更新 playlistRef 和 activeIndexRef
  useEffect(() => {
    playlistRef.current = playlist;
    activeIndexRef.current = activeIndex;
  }, [playlist, activeIndex]);

  useEffect(() => {
    shuffleAllowedRef.current = shuffleAllowed;
  }, [shuffleAllowed]);

  useEffect(() => {
    shuffleEnabledRef.current = shuffleEnabled;
  }, [shuffleEnabled]);

  const onEnded = useCallback(() => {
    const currentPlaylist = playlistRef.current;
    const currentIndex = activeIndexRef.current;
    console.log('🎵 [onEnded] 播放完畢，playlist.length:', currentPlaylist.length, 'activeIndex:', currentIndex);
    setIsPlaying(false);
    setCurrentTime(0);
    currentTimeRef.current = 0;

    // ✅ 如果有播放清單且有多首歌曲，自動播放下一首
    if (currentPlaylist.length > 1) {
      console.log('🎵 [onEnded] 準備播放下一首');
      // 使用 setTimeout 確保在 ended 事件處理完成後再切換
      setTimeout(() => {
        if (nextRef.current) {
          console.log('🎵 [onEnded] 調用 next()');
          nextRef.current();
        } else {
          console.warn('⚠️ [onEnded] nextRef.current 為 null');
        }
      }, 100);
    } else {
    }
  }, []); // ✅ 移除依賴項，使用 ref 獲取最新值

  // ✅ 創建 Audio - 只在組件掛載時創建一次
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // ✅ 從 localStorage 恢復音量
    try {
      const saved = localStorage.getItem("playerVolume");
      if (saved) {
        const vol = parseFloat(saved);
        if (!isNaN(vol) && vol >= 0 && vol <= 1) {
          audio.volume = vol;
        }
      }
    } catch (e) {
      console.warn("讀取音量失敗:", e);
    }

    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, [audioRef.current]); // audio 元素就緒後掛載事件

  useEffect(() => {
    return () => {
      cancelPlaybackAttempt();
    };
  }, [cancelPlaybackAttempt]);
  useEffect(() => {
    if (
      audioRef.current &&
      typeof volume === "number" &&
      !isNaN(volume) &&
      isFinite(volume)
    ) {
      // ✅ 確保音量值在有效範圍內 (0-1)
      const validVolume = Math.max(0, Math.min(1, volume));
      audioRef.current.volume = validVolume;
    }
  }, [volume]);

  // ✅ 播放音樂 - 只使用本地音頻播放器
  const play = async () => {
    if (!src && !originUrl) {
      console.warn("⚠️ [PlayerContext.play] 沒有設置音樂來源");
      return false;
    }

    cancelPlaybackAttempt();

    // ✅ 檢查是否正在轉換中
    if (isTransitioningRef.current) {
      console.warn("⚠️ [PlayerContext.play] 正在轉換中，跳過");
      return false;
    }

    if (!audioRef.current) {
      return false;
    }

    // ✅ 清除 AudioManager 暫停標記（允許播放）
    wasPausedByAudioManagerRef.current = false;

    // ✅ 請求播放權限（優先度 1 - 最低）
    // AudioManager 會自動暫停低優先度的音頻，但不會暫停高優先度的音頻（音樂 Modal、預覽）
    const canPlay = audioManager.requestPlay(audioRef.current, 1);
    
    // 如果優先度不夠（例如音樂 Modal 或預覽正在播放），不允許播放
    if (!canPlay) {
      console.warn("⚠️ [PlayerContext.play] 優先度不夠，無法播放");
      return false;
    }

    // ✅ 停止所有視頻元素（視頻不受 AudioManager 管理）
    try {
      const videoElements = document.querySelectorAll("video");
      videoElements.forEach((video) => {
        try {
          if (video.dataset.videoPreview === "true") return; // 跳過預覽
          if (!video.paused) {
            video.pause();
            video.currentTime = 0;
          }
        } catch {}
      });
    } catch {}

    // ✅ 播放本地音頻
    try {
      if (audioRef.current.readyState >= 2) {
        await audioRef.current.play();
        setIsPlaying(true);
        
        // ✅ 記錄播放器在被打斷前的播放狀態
        wasPlayingBeforeInterruptionRef.current = true;
        
        // ✅ 觸發自定義事件，通知其他組件播放狀態已改變
        window.dispatchEvent(
          new CustomEvent("playerStateChanged", {
            detail: { isPlaying: true, action: "play" },
          }),
        );
        
        return true;
      } else {
        return false;
      }
    } catch (error) {
      if (error.name === "AbortError") {
        console.warn("播放被中止");
      } else {
        console.error("播放失敗:", error);
      }
    }

    return false;
  };

  // ✅ 暫停播放 - 只使用本地音頻播放器
  const pause = () => {
    console.log("🎵 [PlayerContext] pause() 被調用");

    cancelPlaybackAttempt();
    
    // ✅ 更新播放狀態
    setIsPlaying(false);
    console.log("🎵 [PlayerContext] setIsPlaying(false) 已調用");
    
    // ✅ 記錄播放器被用戶暫停（而非被 AudioManager 打斷）
    wasPlayingBeforeInterruptionRef.current = false;
    
    // ✅ 暫停本地音頻
    if (audioRef.current && !audioRef.current.paused) {
      try {
        audioRef.current.pause();
        console.log("🎵 [PlayerContext] ✅ 播放器音頻元素已暫停");
      } catch (error) {
        console.warn("🎵 [PlayerContext] ❌ 暫停失敗:", error);
      }
    } else {
      console.log("🎵 [PlayerContext] 播放器音頻元素未在播放或不存在");
    }

    // ✅ 釋放播放權限（優先度 1）
    if (audioRef.current) {
      audioManager.release(audioRef.current);
    }

    // ✅ 停止所有視頻元素（視頻不受 AudioManager 管理）
    try {
      const videoElements = document.querySelectorAll("video");
      videoElements.forEach((video, index) => {
        try {
          // 跳過影片縮圖的 video 元素
          if (video.dataset.videoPreview === "true") {
            return;
          }

          if (!video.paused) {
            video.pause();
            video.currentTime = 0; // 重置播放位置
          }
        } catch (error) {
          console.warn(`🔧 停止視頻元素 ${index} 失敗:`, error.message);
        }
      });
    } catch (error) {
      console.warn("🔧 停止視頻失敗:", error);
    }

    // ✅ 更新播放狀態
    setIsPlaying(false);
    // console.log("🔧 播放狀態已設為暫停");

    // ✅ 觸發自定義事件，通知其他組件播放狀態已改變
    window.dispatchEvent(
      new CustomEvent("playerStateChanged", {
        detail: { isPlaying: false, action: "pause" },
      }),
    );
  };

  const seekTo = (time) => {
    // ✅ 只使用本地音頻播放器
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  // ✅ 更新當前播放時間
  const updateCurrentTime = useCallback(() => {
    if (audioRef.current) {
      const newTime = (audioRef.current && audioRef.current.currentTime) || 0;
      currentTimeRef.current = newTime;
      setCurrentTime(newTime);
    }
  }, []);

  const playCurrentWithRetry = useCallback(
    ({
      reason = "auto",
      initialDelay = 0,
      maxAttempts = 5,
      retryDelay = 180,
    } = {}) => {
      const audio = audioRef.current;
      if (!audio) {
        cancelPlaybackAttempt();
        return;
      }

      cancelPlaybackAttempt();

      let attemptTimeoutId = null;
      let cancelled = false;
      let handleCanPlay = null;

      const cancel = () => {
        if (cancelled) {
          return;
        }
        cancelled = true;
        if (attemptTimeoutId) {
          clearTimeout(attemptTimeoutId);
          attemptTimeoutId = null;
        }
        if (handleCanPlay) {
          audio.removeEventListener("canplay", handleCanPlay);
          audio.removeEventListener("canplaythrough", handleCanPlay);
        }
      };

      const attemptContext = { cancel };
      playbackAttemptRef.current = attemptContext;

      const cleanup = () => {
        cancel();
        if (playbackAttemptRef.current === attemptContext) {
          playbackAttemptRef.current = null;
        }
      };

      const attemptPlay = async (attempt) => {
        if (cancelled) {
          return;
        }

        if (!audioRef.current || audioRef.current !== audio) {
          cleanup();
          return;
        }

        const allowed = audioManager.requestPlay(audio, 1);
        if (!allowed) {
          console.warn(`⚠️ [${reason}] 優先度不夠，無法播放`);
          cleanup();
          return;
        }

        try {
          const playPromise = audio.play();
          if (playPromise && typeof playPromise.then === "function") {
            await playPromise;
          }
        } catch (error) {
          if (attempt >= maxAttempts) {
            console.warn(`⚠️ [${reason}] play() 失敗`, error);
            cleanup();
            return;
          }
          attemptTimeoutId = window.setTimeout(
            () => attemptPlay(attempt + 1),
            retryDelay,
          );
          return;
        }

        if (audio.paused) {
          if (attempt >= maxAttempts) {
            console.warn(`⚠️ [${reason}] 播放未開始 (paused)`);
            cleanup();
            return;
          }
          attemptTimeoutId = window.setTimeout(
            () => attemptPlay(attempt + 1),
            retryDelay,
          );
          return;
        }

        setIsPlaying(true);
        wasPlayingBeforeInterruptionRef.current = true;
        cleanup();
      };

      handleCanPlay = () => {
        if (cancelled) {
          return;
        }
        attemptPlay(0);
      };

      const start = () => {
        if (cancelled) {
          return;
        }

        if (!audioRef.current || audioRef.current !== audio) {
          cleanup();
          return;
        }

        if (audio.readyState >= 2) {
          attemptPlay(0);
        } else {
          audio.addEventListener("canplay", handleCanPlay, { once: true });
          audio.addEventListener("canplaythrough", handleCanPlay, { once: true });
        }
      };

      if (initialDelay > 0) {
        attemptTimeoutId = window.setTimeout(start, initialDelay);
      } else {
        start();
      }
    },
    [cancelPlaybackAttempt, setIsPlaying],
  );

  // ✅ 下一首音樂
  const next = async () => {
    const list = playlistRef.current || [];
    if (list.length === 0) {
      return;
    }

    cancelPlaybackAttempt();

    const computeNextIndex = () => {
      if (!shuffleEnabledRef.current || list.length === 1) {
        const idx = (activeIndexRef.current + 1) % list.length;
        return {
          index: idx,
          isLooping: idx === 0 && activeIndexRef.current === list.length - 1,
        };
      }

      if (shuffleQueueRef.current.length === 0) {
        regenerateShuffleQueue(activeIndexRef.current);
      }

      if (shuffleQueueRef.current.length === 0) {
        const idx = (activeIndexRef.current + 1) % list.length;
        return {
          index: idx,
          isLooping: idx === 0 && activeIndexRef.current === list.length - 1,
        };
      }

      const nextIdx = shuffleQueueRef.current.shift();
      shuffleHistoryRef.current.push(activeIndexRef.current);
      return { index: nextIdx, isLooping: false };
    };

    const { index: nextIndex, isLooping } = computeNextIndex();
    const nextItem = list[nextIndex];

    if (!nextItem) {
      return;
    }

    // ✅ 記錄開始時間
    const startTime = performance.now();
    window.__NEXT_START_TIME__ = startTime;

    // console.log("🔧 PlayerContext 切換到下一首", { nextIndex, nextItem });

    // ✅ AudioManager 會自動處理單一音源，不需要手動檢查

    // ✅ 標記為轉換中
    isTransitioningRef.current = true;

    try {
      // ✅ 停止當前播放
      // ✅ 釋放播放權限（優先度 1）
      if (audioRef.current) {
        audioManager.release(audioRef.current);
        try {
          if (!audioRef.current.paused) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
          }
        } catch (error) {
          console.warn("🔧 暫停失敗:", error);
        }
      }

      // ✅ AudioManager 會自動處理單一音源，不需要手動停止其他音頻
      // ✅ 停止所有視頻元素（視頻不受 AudioManager 管理）
      try {
        const videoElements = document.querySelectorAll("video");
        videoElements.forEach((video, index) => {
          try {
            // 跳過影片縮圖的 video 元素
            if (video.dataset.videoPreview === "true") {
              return;
            }

            if (!video.paused) {
              video.pause();
              video.currentTime = 0;
            }
          } catch (error) {
            console.warn(`🔧 停止視頻元素 ${index} 失敗:`, error.message);
          }
        });
      } catch (error) {
        console.warn("🔧 停止視頻失敗:", error);
      }

      // ✅ 等待短暫時間確保播放器停止
      await new Promise((resolve) => setTimeout(resolve, 150));

      // ✅ 更新索引（提早）
      setActiveIndex(nextIndex, { skipShuffleReset: true });
      // ✅ 立即廣播切歌事件，避免後續步驟例外導致事件未發出
      try {
        window.dispatchEvent(
          new CustomEvent("playerNext", { detail: { nextIndex, nextItem } }),
        );
      } catch {}

      // ✅ 設置新的音樂源
      setSrcWithAudio(nextItem.url);
      setOriginUrl(nextItem.url);
      setTrackTitle(nextItem.title);
      
      // ✅ 清除轉換標記（在播放前清除，避免 play() 被跳過）
      isTransitioningRef.current = false;
      
      // ✅ 清除 AudioManager 暫停標記（用戶主動切歌）
      wasPausedByAudioManagerRef.current = false;
      
      playCurrentWithRetry({ reason: "next" });
    } finally {
      // ✅ 不再需要延遲清除轉換標記，因為已經在上面的代碼中清除了
    }
  };

  // ✅ 上一首音樂
  const previous = async () => {
    const list = playlistRef.current || [];
    if (list.length === 0) {
      return;
    }

    cancelPlaybackAttempt();

    const computePreviousIndex = () => {
      if (!shuffleEnabledRef.current || list.length === 1) {
        return activeIndexRef.current === 0
          ? list.length - 1
          : activeIndexRef.current - 1;
      }

      if (shuffleHistoryRef.current.length > 0) {
        const prevIdx = shuffleHistoryRef.current.pop();
        shuffleQueueRef.current.unshift(activeIndexRef.current);
        return prevIdx;
      }

      return activeIndexRef.current === 0
        ? list.length - 1
        : activeIndexRef.current - 1;
    };

    const prevIndex = computePreviousIndex();
    const prevItem = list[prevIndex];

    if (!prevItem) {
      return;
    }

    // ✅ 標記為轉換中
    isTransitioningRef.current = true;

    try {
      // ✅ 停止當前播放
      // ✅ 釋放播放權限（優先度 1）
      if (audioRef.current) {
        audioManager.release(audioRef.current);
        try {
          if (!audioRef.current.paused) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
          }
        } catch (error) {
          console.warn("🔧 暫停失敗:", error);
        }
      }

      // ✅ AudioManager 會自動處理單一音源，不需要手動停止其他音頻
      // ✅ 停止所有視頻元素（視頻不受 AudioManager 管理）
      try {
        const videoElements = document.querySelectorAll("video");
        videoElements.forEach((video, index) => {
          try {
            // 跳過影片縮圖的 video 元素
            if (video.dataset.videoPreview === "true") {
              return;
            }

            if (!video.paused) {
              video.pause();
              video.currentTime = 0;
            }
          } catch (error) {
            console.warn(`🔧 停止視頻元素 ${index} 失敗:`, error.message);
          }
        });
      } catch (error) {
        console.warn("🔧 停止視頻失敗:", error);
      }

      // ✅ 等待短暫時間確保播放器停止
      await new Promise((resolve) => setTimeout(resolve, 150));

      // ✅ 更新索引
      setActiveIndex(prevIndex, { skipShuffleReset: true });

      // ✅ 設置新的音樂源
      setSrcWithAudio(prevItem.url);
      setOriginUrl(prevItem.url);
      setTrackTitle(prevItem.title);

      // ✅ 清除 AudioManager 暫停標記（用戶主動切歌）
      wasPausedByAudioManagerRef.current = false;

      // ✅ 觸發自定義事件更新 UI
      window.dispatchEvent(
        new CustomEvent("playerPrevious", { detail: { prevIndex, prevItem } }),
      );

      playCurrentWithRetry({ reason: "previous" });
    } finally {
      // ✅ 清除轉換標記
      setTimeout(() => {
        isTransitioningRef.current = false;
      }, 1000);
    }
  };

  // ✅ setSrc 的包裝函數
  const setSrcWithAudio = (newSrc) => {
    const audio = audioRef.current;

    const resolveSrc = (value) => {
      if (typeof window === "undefined") {
        return value || "";
      }
      if (!value) {
        return "";
      }
      try {
        return new URL(value, window.location.origin).href;
      } catch {
        return value;
      }
    };

    const resolvedNewSrc = resolveSrc(newSrc);
    const currentHref =
      audio && (audio.currentSrc || audio.src)
        ? audio.currentSrc || audio.src
        : "";
    const isSameSource =
      !!audio && !!resolvedNewSrc && resolvedNewSrc === currentHref;

    if (!isSameSource) {
      setCurrentTime(0);
      setDuration(0);
    }

    setSrc(newSrc);

    if (!audio) {
      return;
    }

    try {
      audio.dataset.progressReported = "";
      audio.dataset.startTime = "";

      if (isSameSource) {
        // 保留現有音源，無需重新載入
        return;
      }

      if (!audio.paused) {
        audio.pause();
      }
      audio.currentTime = 0;
      audio.src = newSrc || "";
      audio.load();

      // 設置新的音源
    } catch (error) {
      console.warn("🔧 設置音頻源失敗", error);
    }
  };

  // ✅ 更新 nextRef 引用，確保使用最新的 next 函數
  useEffect(() => {
    nextRef.current = next;
  }, [next]);

  // ✅ 監聽頁面可見性變化，處理背景播放恢復
  useEffect(() => {
    let restoreTimeout = null;
    
    const handleVisibilityChange = async () => {
      if (!audioRef.current || !src) return;

      if (document.hidden) {
        // 頁面隱藏時，記錄播放狀態（基於實際音頻元素狀態和 isPlaying 狀態）
        wasPlayingBeforeHiddenRef.current = !audioRef.current.paused && isPlaying;
        console.log('👁️ 頁面隱藏，記錄播放狀態:', wasPlayingBeforeHiddenRef.current);
        
        // 清除之前的恢復定時器
        if (restoreTimeout) {
          clearTimeout(restoreTimeout);
          restoreTimeout = null;
        }
      } else {
        // 頁面重新可見時，延遲檢查並恢復播放（避免與其他邏輯衝突）
        restoreTimeout = setTimeout(async () => {
          // ✅ 關鍵檢查：只有當音頻確實被暫停，且之前正在播放，且狀態顯示應該在播放時，才恢復
          const audioPaused = audioRef.current.paused;
          const shouldBePlaying = wasPlayingBeforeHiddenRef.current && isPlaying;
          
          // 如果音頻沒有暫停，說明還在播放，不需要恢復
          if (!audioPaused) {
            console.log('👁️ 頁面重新可見，音頻仍在播放，無需恢復');
            wasPlayingBeforeHiddenRef.current = false; // 清除標記
            return;
          }
          
          // 如果之前沒有在播放，不需要恢復
          if (!wasPlayingBeforeHiddenRef.current) {
            console.log('👁️ 頁面重新可見，之前未在播放');
            return;
          }
          
          // 如果狀態顯示不應該在播放，不需要恢復
          if (!isPlaying) {
            console.log('👁️ 頁面重新可見，播放狀態為暫停');
            wasPlayingBeforeHiddenRef.current = false; // 清除標記
            return;
          }
          
          // ✅ 如果播放器是被 AudioManager 暫停的，不自動恢復播放
          if (wasPausedByAudioManagerRef.current) {
            console.log('👁️ 頁面重新可見，但播放器是被 AudioManager 暫停的，不自動恢復');
            wasPlayingBeforeHiddenRef.current = false; // 清除標記
            return;
          }
          
          // ✅ 只有當所有條件都滿足時才恢復播放
          if (audioRef.current.readyState > 0) {
            console.log('🔄 頁面重新可見，恢復播放（音頻確實被暫停）');
            try {
              // 確保音頻已載入
              if (audioRef.current.readyState >= 2) {
                await audioRef.current.play();
                setIsPlaying(true);
                console.log('✅ 播放已恢復');
              } else {
                // 等待音頻載入完成後播放
                const handleCanPlay = async () => {
                  try {
                    // 再次檢查是否仍然需要恢復播放
                    if (audioRef.current.paused && isPlaying) {
                      await audioRef.current.play();
                      setIsPlaying(true);
                      console.log('✅ 播放已恢復（延遲載入）');
                    }
                  } catch (error) {
                    console.warn('⚠️ 恢復播放失敗:', error);
                  }
                  audioRef.current.removeEventListener('canplay', handleCanPlay);
                };
                audioRef.current.addEventListener('canplay', handleCanPlay);
              }
            } catch (error) {
              console.warn('⚠️ 恢復播放失敗:', error);
              // 如果自動播放失敗，清除標記
              wasPlayingBeforeHiddenRef.current = false;
            }
          }
        }, 200); // ✅ 延遲 200ms 檢查，給其他邏輯時間完成
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (restoreTimeout) {
        clearTimeout(restoreTimeout);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [src, isPlaying]); // ✅ 依賴 src 和 isPlaying，確保狀態正確

  // ✅ 監聽 AudioManager 暫停事件，確保播放器狀態同步
  useEffect(() => {
    const handleAudioManagerPaused = (event) => {
      const { audio } = event.detail || {};
      // 如果被暫停的是播放器的音頻元素，確保狀態同步
      if (audio && audio === audioRef.current) {
        // 音頻元素已經被 AudioManager 暫停，但需要確保 React 狀態也更新
        if (isPlaying && audio.paused) {
          console.log("🎵 [PlayerContext] AudioManager 暫停了播放器，同步狀態");
          setIsPlaying(false);
          // 標記播放器是被 AudioManager 暫停的
          wasPausedByAudioManagerRef.current = true;
          cancelPlaybackAttempt();
          
          // ✅ 不觸發 playerStateChanged 事件（不是用戶操作，不記錄）
        }
      }
    };

    window.addEventListener("audioManagerPaused", handleAudioManagerPaused);

    return () => {
      window.removeEventListener("audioManagerPaused", handleAudioManagerPaused);
    };
  }, [isPlaying, cancelPlaybackAttempt]);

  // ✅ 注意：wasPausedByAudioManagerRef 標記會在用戶手動播放時清除（在 play() 方法中）
  // 當 AudioManager 釋放預覽音頻時，播放器不應自動恢復播放

  // ✅ 監聽 skipToNext 事件，自動切換到下一首
  useEffect(() => {
    let skipTimeout = null;

    const handleSkipToNext = () => {
      // ✅ 防抖處理，避免快速觸發
      if (skipTimeout) {
        clearTimeout(skipTimeout);
      }

      skipTimeout = setTimeout(() => {
        try {
          console.warn(
            "🔧 收到 skipToNext 事件 -> next()，activeIndex=",
            activeIndex,
            "playlistLen=",
            Array.isArray(playlist) ? playlist.length : 0,
          );
          nextRef.current && nextRef.current();
        } finally {
          skipTimeout = null;
        }
      }, 300); // ✅ 300ms 防抖延遲
    };

    window.addEventListener("skipToNext", handleSkipToNext);

    return () => {
      if (skipTimeout) {
        clearTimeout(skipTimeout);
      }
      window.removeEventListener("skipToNext", handleSkipToNext);
    };
  }, [activeIndex, playlist]);

  const contextValue = useMemo(
    () => ({
      src,
      setSrc: setSrcWithAudio,
      isPlaying,
      currentTime,
      duration,
      volume,
      setVolume,
      volumeSynced,
      originUrl,
      setOriginUrl,
      trackTitle,
      setTrackTitle,
      shareMode,
      setShareMode,
      miniPlayerEnabled,
      setMiniPlayerEnabled,
      seekable,
      setSeekable,
      play,
      pause,
      seekTo,
      updateCurrentTime,
      next,
      previous,
      playlist,
      setPlaylist,
      activeIndex,
      setActiveIndex,
      shuffleAllowed,
      setShuffleAllowed,
      shuffleEnabled,
      setShuffleEnabled,
      playerOwner,
      setPlayerOwner,
      setPinnedOwnerInfo,
      pageOwnerSkin,
      setPageOwnerSkin,
      // ✅ 播放器在被打斷前的播放狀態（用於高優先級音源關閉後恢復）
      wasPlayingBeforeInterruption: wasPlayingBeforeInterruptionRef.current,
      audioRef, // ✅ 提供 audioRef 用於檢查播放器的實際狀態
    }),
    [
      src,
      isPlaying,
      currentTime,
      duration,
      volume,
      volumeSynced,
      originUrl,
      trackTitle,
      shareMode,
      miniPlayerEnabled,
      seekable,
      next,
      previous,
      playlist,
      activeIndex,
      shuffleAllowed,
      shuffleEnabled,
      playerOwner,
      pageOwnerSkin,
    ],
  );

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) {
      return;
    }

    const currentTrack =
      Array.isArray(playlist) && playlist.length > 0 && activeIndex >= 0
        ? playlist[activeIndex]
        : null;

    const metadataTitle =
      (currentTrack && (currentTrack.title || currentTrack.trackTitle)) ||
      trackTitle ||
      (currentTrack && currentTrack.url) ||
      "音樂作品";
    const metadataArtist =
      (currentTrack && (currentTrack.artist || currentTrack.authorName)) ||
      playerOwner?.username ||
      "未知創作者";
    const metadataAlbum =
      (currentTrack && currentTrack.album) || playerOwner?.username || "";

    const artwork = [];
    const coverCandidate =
      currentTrack?.coverImageUrl ||
      currentTrack?.cover ||
      currentTrack?.imageUrl ||
      currentTrack?.thumbnailUrl;
    if (coverCandidate) {
      artwork.push({
        src: coverCandidate,
        sizes: "512x512",
        type: "image/png",
      });
    }

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: metadataTitle,
        artist: metadataArtist,
        album: metadataAlbum,
        artwork,
      });
    } catch (error) {
      console.warn("[MediaSession] 設定 metadata 失敗:", error);
    }

    try {
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    } catch (error) {
      // 某些瀏覽器可能不支援 playbackState，忽略即可
    }

    // ✅ Android 鎖屏控件需要 setPositionState 來正確顯示進度和響應控制
    // updatePositionState 必須在 useEffect 內部，以確保能訪問最新的 audioRef
    const updatePositionState = () => {
      const audio = audioRef.current;
      if (!audio) return;
      
      const currentTime = audio.currentTime || 0;
      const duration = audio.duration || 0;
      
      // 只有在有有效時長時才設置位置狀態
      if (duration > 0 && isFinite(duration) && isFinite(currentTime)) {
        try {
          if (navigator.mediaSession.setPositionState) {
            navigator.mediaSession.setPositionState({
              duration: duration,
              playbackRate: audio.playbackRate || 1.0,
              position: currentTime,
            });
          }
        } catch (error) {
          // 某些瀏覽器可能不支援 setPositionState，忽略即可
          console.warn("[MediaSession] 設定 position state 失敗:", error);
        }
      }
    };

    // 初始設置位置狀態
    updatePositionState();

    const handlePlayAction = async () => {
      try {
        await play();
      } catch (error) {
        console.warn("[MediaSession] play handler 失敗:", error);
      }
    };

    const handlePauseAction = () => {
      try {
        pause();
      } catch (error) {
        console.warn("[MediaSession] pause handler 失敗:", error);
      }
    };

    const handleNextAction = () => {
      try {
        if (typeof next === "function") {
          next();
        }
      } catch (error) {
        console.warn("[MediaSession] next handler 失敗:", error);
      }
    };

    const handlePrevAction = () => {
      try {
        if (typeof previous === "function") {
          previous();
        }
      } catch (error) {
        console.warn("[MediaSession] previous handler 失敗:", error);
      }
    };

    try {
      navigator.mediaSession.setActionHandler("play", handlePlayAction);
    } catch (error) {
      console.warn("[MediaSession] 設定 play handler 失敗:", error);
    }

    try {
      navigator.mediaSession.setActionHandler("pause", handlePauseAction);
    } catch (error) {
      console.warn("[MediaSession] 設定 pause handler 失敗:", error);
    }

    try {
      if (Array.isArray(playlist) && playlist.length > 1) {
        navigator.mediaSession.setActionHandler("nexttrack", handleNextAction);
        navigator.mediaSession.setActionHandler(
          "previoustrack",
          handlePrevAction,
        );
      } else {
        navigator.mediaSession.setActionHandler("nexttrack", null);
        navigator.mediaSession.setActionHandler("previoustrack", null);
      }
    } catch (error) {
      console.warn("[MediaSession] 設定 track handler 失敗:", error);
    }

    // ✅ 當播放時間更新時，同步更新 Media Session 的位置狀態（Android 需要）
    const timeUpdateInterval = setInterval(() => {
      if (isPlaying && audioRef.current) {
        updatePositionState();
      }
    }, 1000); // 每秒更新一次

    return () => {
      clearInterval(timeUpdateInterval);
      try {
        navigator.mediaSession.setActionHandler("play", null);
        navigator.mediaSession.setActionHandler("pause", null);
        navigator.mediaSession.setActionHandler("nexttrack", null);
        navigator.mediaSession.setActionHandler("previoustrack", null);
      } catch (error) {
        // 忽略清理錯誤
      }
    };
  }, [
    playlist,
    activeIndex,
    trackTitle,
    playerOwner?.username,
    isPlaying,
    // ✅ 不包含 currentTime 和 duration，避免 useEffect 頻繁重新運行
    // 我們直接在 updatePositionState 中從 audioRef.current 讀取最新值
    play,
    pause,
    next,
    previous,
  ]);

  return (
    <PlayerContext.Provider value={contextValue}>
      {children}
      <audio
        ref={audioRef}
        preload="metadata"
        playsInline
        style={{ display: "none" }}
      />
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error("usePlayer must be used within a PlayerProvider");
  }
  return context;
}
