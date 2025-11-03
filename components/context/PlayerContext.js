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

  // ✅ 修复：从 localStorage 读取音量，默认 1.0 (100%)
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
        console.warn("读取音量失败:", e);
      }
    }
    return 1.0; // 默认 100%（符合 YouTube 默认值）
  });
  // 初始化时就标记为已同步（因为已从 localStorage 加载）
  const [volumeSynced, setVolumeSynced] = useState(true);

  // 真正的音量控制函數
  const setVolume = useCallback((newVolume) => {
    // 確保音量值是有效的數字
    if (
      typeof newVolume !== "number" ||
      isNaN(newVolume) ||
      !isFinite(newVolume)
    ) {
      console.warn("🔧 無效的音量值:", newVolume);
      return;
    }

    // 確保音量值在有效範圍內 (0-1)
    const validVolume = Math.max(0, Math.min(1, newVolume));

    // 更新狀態
    setVolumeState(validVolume);

    // ✅ 修复：保存到 localStorage
    try {
      localStorage.setItem("playerVolume", validVolume.toString());
    } catch (e) {
      console.warn("🔧 保存音量失敗:", e);
    }

    // 標記音量已同步
    setVolumeSynced(true);

    // 控制外部播放器音量
    if (
      externalControlsRef.current &&
      typeof externalControlsRef.current.setVolume === "function"
    ) {
      try {
        externalControlsRef.current.setVolume(validVolume);
      } catch (error) {
        console.warn("🔧 外部播放器音量設置失敗:", error.message);
      }
    }

    // 控制本地音頻播放器音量
    if (audioRef.current) {
      try {
        audioRef.current.volume = validVolume;
      } catch (error) {
        console.warn("🔧 本地音頻播放器音量設置失敗:", error.message);
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
  const [autoPlayAfterBridge, setAutoPlayAfterBridge] = useState(false);
  const [playlist, setPlaylist] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);

  // 播放器擁有者資訊（用於釘選功能）
  const [playerOwner, setPlayerOwner] = useState(null); // { userId, username }

  // 頁面主人的播放器造型信息（用於在別人頁面顯示他們的造型）
  const [pageOwnerSkin, setPageOwnerSkin] = useState(null); // { activePlayerSkin, playerSkinSettings, premiumPlayerSkin }

  const audioRef = useRef(null);
  const externalControlsRef = useRef(null);
  const usingExternalPlayerRef = useRef(false);
  const currentTimeRef = useRef(0);
  const lastUpdateTimeRef = useRef(0);
  const retryCountRef = useRef(0);
  const isTransitioningRef = useRef(false); // 新增：防止轉換期間的雙重播放

  // 清理 ready 旗標的 useEffect
  useEffect(() => {
    return () => {
      // 組件卸載時清理 ready 旗標
      if (window.__YT_READY__) {
        delete window.__YT_READY__;
        // console.log("🔧 PlayerContext 清理 ready 旗標");
      }
    };
  }, []);

  // 使用 useCallback 創建穩定的事件處理器
  const onLoaded = useCallback(() => {
    if (audioRef.current) {
      setDuration((audioRef.current && audioRef.current.duration) || 0);
    }
  }, []);

  const onTime = useCallback(() => {
    if (!usingExternalPlayerRef.current && audioRef.current) {
      const newTime = (audioRef.current && audioRef.current.currentTime) || 0;
      currentTimeRef.current = newTime;

      // 追蹤音樂播放進度，實際播放時長達到總時長的 10% 時計數
      const audio = audioRef.current;
      const duration = audio.duration;
      if (duration > 0 && newTime > 0) {
        const startTime = parseFloat(audio.dataset.startTime || "0");
        // 計算實際播放的時長（當前位置 - 開始位置）
        const playedDuration = Math.max(0, newTime - startTime);
        // 計算實際播放的百分比
        const playedPercent = (playedDuration / duration) * 100;
        // 檢查是否為音樂 URL（格式：/api/music/stream/${id}）
        if (src && src.includes("/api/music/stream/")) {
          const musicId = src.match(/\/api\/music\/stream\/([^/?]+)/)?.[1];
          if (musicId) {
            // 如果實際播放時長達到總時長的 10% 以上，就計數
            // 這樣無論從哪裡開始播放，只要播放了足夠長的內容就計數
            if (playedPercent >= 10 && !audio.dataset.progressReported) {
              audio.dataset.progressReported = "true";
              // 調用進度追蹤 API
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
                // 忽略錯誤，不影響播放體驗
              });
            }
          }
        }
      }

      // 完全移除 setCurrentTime 調用，避免無限循環
      // 時間更新將通過其他方式處理（如手動觸發或外部播放器）
    }
  }, [src]);

  const onPlay = useCallback(() => {
    // 若使用外部播放器（YouTube），避免本地 audio 事件覆蓋狀態
    if (usingExternalPlayerRef.current) return;
    setIsPlaying(true);

    // 記錄播放開始時的絕對位置（秒）
    if (audioRef.current) {
      const startTime = audioRef.current.currentTime;
      // 記錄開始播放時的絕對時間位置
      audioRef.current.dataset.startTime = startTime.toString();
    }
  }, []);

  const onPause = useCallback(() => {
    // 若使用外部播放器（YouTube），避免本地 audio 事件覆蓋狀態
    if (usingExternalPlayerRef.current) return;
    setIsPlaying(false);
  }, []);

  const onEnded = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    currentTimeRef.current = 0;
  }, []);

  // 初始化 Audio - 移除會導致無限循環的依賴
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    // ✅ 初始化音量
    try {
      const saved = localStorage.getItem("playerVolume");
      if (saved) {
        const vol = parseFloat(saved);
        if (!isNaN(vol) && vol >= 0 && vol <= 1) {
          audio.volume = vol;
        }
      }
    } catch (e) {
      console.warn("初始化音量失敗:", e);
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
  }, []); // 只在組件掛載時執行一次

  useEffect(() => {
    if (
      audioRef.current &&
      typeof volume === "number" &&
      !isNaN(volume) &&
      isFinite(volume)
    ) {
      // 確保音量值在有效範圍內 (0-1)
      const validVolume = Math.max(0, Math.min(1, volume));
      audioRef.current.volume = validVolume;
    }
  }, [volume]);

  // 完全重寫的播放函數（僅使用本地播放器）
  const play = async () => {
    if (!src && !originUrl) {
      console.warn("⚠️ [PlayerContext.play] 無音源，跳過");
      return false;
    }

    // 如果正在轉換，等待轉換完成
    if (isTransitioningRef.current) {
      console.warn("⚠️ [PlayerContext.play] 正在轉換中，跳過");
      return false;
    }

    // 在任何播放動作前，先確保沒有殘留的本地/其他媒體在播放
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
          if (video.dataset.videoPreview === "true") return; // 跳過縮圖預覽
          if (!video.paused) {
            video.pause();
            video.currentTime = 0;
          }
        } catch {}
      });
    } catch {}

    // 僅使用本地音頻播放器
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
          console.warn("🔧 播放被中斷");
        } else {
          console.error("🔧 本地播放失敗:", error);
        }
      }
    }

    return false;
  };

  // 完全重寫的暫停函數（僅使用本地播放器）
  const pause = () => {
    // 僅使用本地音頻播放器
    if (audioRef.current && !audioRef.current.paused) {
      try {
        audioRef.current.pause();
      } catch (error) {
        console.warn("🔧 本地音頻暫停失敗:", error);
      }
    }

    // 強制停止所有音頻和視頻元素
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

    // 更新播放狀態
    setIsPlaying(false);
    // console.log("🔧 播放狀態已設為暫停");

    // 觸發自定義事件，通知其他組件播放狀態已改變
    window.dispatchEvent(
      new CustomEvent("playerStateChanged", {
        detail: { isPlaying: false, action: "pause" },
      }),
    );
  };

  const seekTo = (time) => {
    // 僅使用本地音頻播放器
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const setExternalControls = useCallback((controls) => {
    externalControlsRef.current = controls;
    usingExternalPlayerRef.current = !!controls;
  }, []);

  const setExternalProgress = useCallback((currentTime, duration) => {
    // 確保值是有效數字
    if (
      typeof currentTime === "number" &&
      isFinite(currentTime) &&
      currentTime >= 0
    ) {
      setCurrentTime(currentTime);
    }
    if (typeof duration === "number" && isFinite(duration) && duration > 0) {
      setDuration(duration);
    }
  }, []);

  const setExternalPlaying = useCallback((playing) => {
    // 如果是開始播放，總是更新狀態（即使在轉換中）
    // 如果是暫停，只在非轉換時更新
    if (playing || !isTransitioningRef.current) {
      setIsPlaying(playing);
    }
  }, []);

  // 手動更新時間的方法
  const updateCurrentTime = useCallback(() => {
    if (audioRef.current && !usingExternalPlayerRef.current) {
      const newTime = (audioRef.current && audioRef.current.currentTime) || 0;
      currentTimeRef.current = newTime;
      setCurrentTime(newTime);
    }
  }, []);

  // 完全重寫的下一首函數
  const next = async () => {
    if (playlist.length === 0) {
      return;
    }

    // 開始計時
    const startTime = performance.now();
    window.__NEXT_START_TIME__ = startTime;

    const nextIndex = (activeIndex + 1) % playlist.length;
    const nextItem = playlist[nextIndex];

    // ✅ 監測循環播放
    const isLooping = nextIndex === 0 && activeIndex === playlist.length - 1;

    // console.log("🔧 PlayerContext 下一首:", { nextIndex, nextItem });

    // 檢查當前播放的聲音數量
    const audioElements = document.querySelectorAll("audio");
    const videoElements = document.querySelectorAll("video");
    const youtubeIframes = document.querySelectorAll(
      'iframe[src*="youtube.com"]',
    );
    const playingAudio = Array.from(audioElements).filter(
      (audio) => !audio.paused,
    );
    const playingVideo = Array.from(videoElements).filter(
      (video) => !video.paused && video.dataset.videoPreview !== "true",
    );

    // 只在有問題時才輸出詳細日誌
    if (
      youtubeIframes.length > 1 ||
      playingAudio.length + playingVideo.length > 1
    ) {
    }

    // 設置轉換標記，防止雙重播放
    isTransitioningRef.current = true;

    try {
      // 強制停止所有播放器

      // 停止外部播放器
      if (
        externalControlsRef.current &&
        typeof externalControlsRef.current.pause === "function"
      ) {
        try {
          externalControlsRef.current.pause();
        } catch (error) {
          console.warn("🔧 外部播放器暫停失敗:", error);
        }
      }

      // 停止本地音頻播放器
      if (audioRef.current && !audioRef.current.paused) {
        try {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        } catch (error) {
          console.warn("🔧 本地音頻暫停失敗:", error);
        }
      }

      // 強制停止所有可能的音頻源
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

        // 檢查是否在後台分頁
        const isBackground = document.hidden;

        // 不再移除 YouTube iframe 與 DOM 媒體元素，改由橋接層管理
      } catch (error) {
        console.warn("🔧 強制停止失敗:", error);
      }

      // 等待短暫時間確保播放器停止
      await new Promise((resolve) => setTimeout(resolve, 150));

      // 更新索引（提早）
      setActiveIndex(nextIndex);
      // 立即廣播切歌事件，避免後續步驟例外導致事件未發出
      try {
        window.dispatchEvent(
          new CustomEvent("playerNext", { detail: { nextIndex, nextItem } }),
        );
      } catch {}

      // 先設置自動播放標記
      setAutoPlayAfterBridge(true);
      window.__AUTO_PLAY_TRIGGERED__ = true;
      window.__PERSISTENT_AUTO_PLAY__ = true; // 設置持久標記
      // console.log("🔧 設置自動播放標記");

      // 等待狀態更新
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 若發生循環（回到第一首），強制重建 YouTube 播放器，避免第二輪卡死
      try {
        if (isLooping) {
          window.__FORCE_RECREATE_PLAYER__ = true;
        }
      } catch {}

      // 設置新的播放內容
      setSrcWithAudio(nextItem.url);
      setOriginUrl(nextItem.url);
      setTrackTitle(nextItem.title);

      // 等待新播放器初始化
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 嘗試不重新創建播放器，只更換視頻源
      // window.__FORCE_RECREATE_PLAYER__ = true;

      // 事件已於前面廣播，這裡避免重複
    } finally {
      // 更快清除轉換標記，降低卡住風險
      setTimeout(() => {
        isTransitioningRef.current = false;
      }, 1000);
    }
  };

  // 完全重寫的上一首函數
  const previous = async () => {
    if (playlist.length === 0) {
      return;
    }

    const prevIndex = activeIndex === 0 ? playlist.length - 1 : activeIndex - 1;
    const prevItem = playlist[prevIndex];

    // 設置轉換標記，防止雙重播放
    isTransitioningRef.current = true;

    try {
      // 強制停止所有播放器

      // 停止外部播放器
      if (
        externalControlsRef.current &&
        typeof externalControlsRef.current.pause === "function"
      ) {
        try {
          externalControlsRef.current.pause();
        } catch (error) {
          console.warn("🔧 外部播放器暫停失敗:", error);
        }
      }

      // 停止本地音頻播放器
      if (audioRef.current && !audioRef.current.paused) {
        try {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        } catch (error) {
          console.warn("🔧 本地音頻暫停失敗:", error);
        }
      }

      // 強制停止所有可能的音頻源
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

        // 檢查是否在後台分頁
        const isBackground = document.hidden;

        // 不再移除 YouTube iframe，由橋接層管理

        // 強制停止所有音頻和視頻元素
        const audioVideoElements = document.querySelectorAll("audio, video");
        audioVideoElements.forEach((element, index) => {
          try {
            // 跳過影片縮圖的 video 元素
            if (
              element.tagName === "VIDEO" &&
              element.dataset.videoPreview === "true"
            ) {
              return;
            }

            if (!element.paused) {
              element.pause();
              element.currentTime = 0;
            }
            element.remove();
          } catch (error) {
            console.warn(`🔧 移除媒體元素 ${index} 失敗:`, error.message);
          }
        });
      } catch (error) {
        console.warn("🔧 強制停止失敗:", error);
      }

      // 等待短暫時間確保播放器停止
      await new Promise((resolve) => setTimeout(resolve, 150));

      // 更新索引
      setActiveIndex(prevIndex);

      // 設置新的播放內容
      setSrcWithAudio(prevItem.url);
      setOriginUrl(prevItem.url);
      setTrackTitle(prevItem.title);

      // 設置自動播放標記
      setAutoPlayAfterBridge(true);
      window.__AUTO_PLAY_TRIGGERED__ = true;
      // console.log("🔧 設置自動播放標記");

      // 觸發自定義事件，讓播放器頁面同步 UI
      window.dispatchEvent(
        new CustomEvent("playerPrevious", { detail: { prevIndex, prevItem } }),
      );
    } finally {
      // 更快清除轉換標記，降低卡住風險
      setTimeout(() => {
        isTransitioningRef.current = false;
      }, 1000);
    }
  };

  // 簡化 setSrc 方法
  const setSrcWithAudio = (newSrc) => {
    // 先重置進度，避免沿用上一首的滿格進度
    setCurrentTime(0);
    setDuration(0);

    setSrc(newSrc);

    // 設置音頻源（如果存在本地音頻播放器）
    if (audioRef.current) {
      try {
        // 重置進度報告標誌和開始位置，允許新音樂重新追蹤進度
        audioRef.current.dataset.progressReported = "";
        audioRef.current.dataset.startTime = "";
        audioRef.current.src = newSrc || "";
        audioRef.current.currentTime = 0;
      } catch (error) {
        console.warn("🔧 設置音頻源失敗:", error);
      }
    }
  };

  // 以 ref 持有最新的 next，避免事件監聽器閉包使用到過期狀態
  const nextRef = useRef(next);
  useEffect(() => {
    nextRef.current = next;
  }, [next]);

  // 監聽 skipToNext 事件（添加防抖，避免重複觸發）
  useEffect(() => {
    let skipTimeout = null;

    const handleSkipToNext = () => {
      // 防抖：避免短時間內重複觸發
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
      }, 300); // 稍微縮短等待，加快自測反應
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
    setExternalControls,
    setExternalProgress,
    setExternalPlaying,
    autoPlayAfterBridge,
    setAutoPlayAfterBridge,
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
    externalControls: externalControlsRef.current,
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
