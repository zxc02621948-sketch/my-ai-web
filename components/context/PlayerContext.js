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
  const [playlist, setPlaylist] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);

  // ✅ 播放器擁有者（用於顯示釘選按鈕等功能）
  const [playerOwner, setPlayerOwner] = useState(null); // { userId, username }

  // ✅ 頁面擁有者的播放器造型（用於顯示特定造型）
  const [pageOwnerSkin, setPageOwnerSkin] = useState(null); // { activePlayerSkin, playerSkinSettings, premiumPlayerSkin }

  const audioRef = useRef(null);
  const currentTimeRef = useRef(0);
  const lastUpdateTimeRef = useRef(0);
  const retryCountRef = useRef(0);
  const isTransitioningRef = useRef(false); // ✅ 追蹤是否正在切換歌曲

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

  const onEnded = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    currentTimeRef.current = 0;
  }, []);

  // ✅ 創建 Audio - 只在組件掛載時創建一次
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

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
      audio.src = "";
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, []); // ✅ 只在組件掛載時執行一次
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

    // ✅ 檢查是否正在轉換中
    if (isTransitioningRef.current) {
      console.warn("⚠️ [PlayerContext.play] 正在轉換中，跳過");
      return false;
    }

    // ✅ 停止所有其他音頻和視頻元素（避免聲音混在一起）
    try {
      const audioElements = document.querySelectorAll("audio");
      audioElements.forEach((audio) => {
        try {
          if (!audio.paused) {
            audio.pause();
            audio.currentTime = 0;
          }
        } catch {}
      });
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
    if (audioRef.current) {
      try {
        if (audioRef.current.readyState >= 2) {
          await audioRef.current.play();
          setIsPlaying(true);
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
    }

    return false;
  };

  // ✅ 暫停播放 - 只使用本地音頻播放器
  const pause = () => {
    // ✅ 暫停本地音頻
    if (audioRef.current && !audioRef.current.paused) {
      try {
        audioRef.current.pause();
      } catch (error) {
        console.warn("暫停失敗:", error);
      }
    }

    // ✅ 停止所有其他音頻和視頻元素
    try {
      const audioElements = document.querySelectorAll("audio");
      audioElements.forEach((audio, index) => {
        try {
          if (!audio.paused) {
            audio.pause();
            audio.currentTime = 0; // 重置播放位置
            // console.log(`🔧 強制停止音頻元素 ${index}`);
          }
        } catch (error) {
          console.warn(`🔧 停止音頻元素 ${index} 失敗:`, error.message);
        }
      });

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
            // console.log(`🔧 強制停止視頻元素 ${index}`);
          }
        } catch (error) {
          console.warn(`🔧 停止視頻元素 ${index} 失敗:`, error.message);
        }
      });
    } catch (error) {
      console.warn("🔧 強制停止失敗:", error);
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

  // ✅ 下一首音樂
  const next = async () => {
    if (playlist.length === 0) {
      return;
    }

    // ✅ 記錄開始時間
    const startTime = performance.now();
    window.__NEXT_START_TIME__ = startTime;

    const nextIndex = (activeIndex + 1) % playlist.length;
    const nextItem = playlist[nextIndex];

    // ✅ 檢查是否循環
    const isLooping = nextIndex === 0 && activeIndex === playlist.length - 1;

    // console.log("🔧 PlayerContext 切換到下一首", { nextIndex, nextItem });

    // ✅ 檢查是否有其他播放器正在播放
    const audioElements = document.querySelectorAll("audio");
    const videoElements = document.querySelectorAll("video");
    const playingAudio = Array.from(audioElements).filter(
      (audio) => !audio.paused,
    );
    const playingVideo = Array.from(videoElements).filter(
      (video) => !video.paused && video.dataset.videoPreview !== "true",
    );

    // ✅ 停止所有其他播放器（如果需要）
    // (已移除 YouTube iframe 相關邏輯)

    // ✅ 標記為轉換中
    isTransitioningRef.current = true;

    try {
      // ✅ 停止當前播放

      // ✅ 暫停本地音頻
      if (audioRef.current && !audioRef.current.paused) {
        try {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        } catch (error) {
          console.warn("🔧 暫停失敗:", error);
        }
      }

      // ✅ 停止所有其他音頻和視頻元素
      try {
        const audioElements = document.querySelectorAll("audio");
        audioElements.forEach((audio, index) => {
          try {
            if (!audio.paused) {
              audio.pause();
              audio.currentTime = 0;
              // console.log(`🔧 強制停止音頻元素 ${index}`);
            }
          } catch (error) {
            console.warn(`🔧 停止音頻元素 ${index} 失敗:`, error.message);
          }
        });

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
              // console.log(`🔧 強制停止視頻元素 ${index}`);
            }
          } catch (error) {
            console.warn(`🔧 停止視頻元素 ${index} 失敗:`, error.message);
          }
        });
      } catch (error) {
        console.warn("🔧 強制停止失敗:", error);
      }

      // ✅ 等待短暫時間確保播放器停止
      await new Promise((resolve) => setTimeout(resolve, 150));

      // ✅ 更新索引（提早）
      setActiveIndex(nextIndex);
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
    } finally {
      // ✅ 清除轉換標記
      setTimeout(() => {
        isTransitioningRef.current = false;
      }, 1000);
    }
  };

  // ✅ 上一首音樂
  const previous = async () => {
    if (playlist.length === 0) {
      return;
    }

    const prevIndex = activeIndex === 0 ? playlist.length - 1 : activeIndex - 1;
    const prevItem = playlist[prevIndex];

    // ✅ 標記為轉換中
    isTransitioningRef.current = true;

    try {
      // ✅ 停止當前播放

      // ✅ 暫停本地音頻
      if (audioRef.current && !audioRef.current.paused) {
        try {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        } catch (error) {
          console.warn("🔧 暫停失敗:", error);
        }
      }

      // ✅ 停止所有其他音頻和視頻元素
      try {
        const audioElements = document.querySelectorAll("audio");
        audioElements.forEach((audio, index) => {
          try {
            if (!audio.paused) {
              audio.pause();
              audio.currentTime = 0;
              // console.log(`🔧 強制停止音頻元素 ${index}`);
            }
          } catch (error) {
            console.warn(`🔧 停止音頻元素 ${index} 失敗:`, error.message);
          }
        });

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
              // console.log(`🔧 強制停止視頻元素 ${index}`);
            }
          } catch (error) {
            console.warn(`🔧 停止視頻元素 ${index} 失敗:`, error.message);
          }
        });
      } catch (error) {
        console.warn("🔧 強制停止失敗:", error);
      }

      // ✅ 等待短暫時間確保播放器停止
      await new Promise((resolve) => setTimeout(resolve, 150));

      // ✅ 更新索引
      setActiveIndex(prevIndex);

      // ✅ 設置新的音樂源
      setSrcWithAudio(prevItem.url);
      setOriginUrl(prevItem.url);
      setTrackTitle(prevItem.title);

      // ✅ 觸發自定義事件更新 UI
      window.dispatchEvent(
        new CustomEvent("playerPrevious", { detail: { prevIndex, prevItem } }),
      );
    } finally {
      // ✅ 清除轉換標記
      setTimeout(() => {
        isTransitioningRef.current = false;
      }, 1000);
    }
  };

  // ✅ setSrc 的包裝函數
  const setSrcWithAudio = (newSrc) => {
    // ✅ 重置進度和時長狀態
    setCurrentTime(0);
    setDuration(0);

    setSrc(newSrc);

    // ✅ 更新音頻元素的 src
    if (audioRef.current) {
      try {
        // ✅ 重置進度報告標記和開始時間
        audioRef.current.dataset.progressReported = "";
        audioRef.current.dataset.startTime = "";
        audioRef.current.src = newSrc || "";
        audioRef.current.currentTime = 0;
      } catch (error) {
        console.warn("🔧 設置音頻源失敗", error);
      }
    }
  };

  // ✅ 使用 ref 保存 next 函數引用，避免閉包問題
  const nextRef = useRef(next);
  useEffect(() => {
    nextRef.current = next;
  }, [next]);

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

  const contextValue = {
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
    playerOwner,
    setPlayerOwner,
    pageOwnerSkin,
    setPageOwnerSkin,
  };

  return (
    <PlayerContext.Provider value={contextValue}>
      {children}
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
