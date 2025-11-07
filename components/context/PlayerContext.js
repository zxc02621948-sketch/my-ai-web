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
  const playlistRef = useRef(playlist); // ✅ 保存播放清單引用
  const activeIndexRef = useRef(activeIndex); // ✅ 保存當前索引引用
  const wasPlayingBeforeHiddenRef = useRef(false); // ✅ 追蹤頁面隱藏前是否在播放
  const wasPausedByAudioManagerRef = useRef(false); // ✅ 追蹤是否被 AudioManager 暫停（不應自動恢復）

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
      
      // ✅ 清除轉換標記（在播放前清除，避免 play() 被跳過）
      isTransitioningRef.current = false;
      
      // ✅ 清除 AudioManager 暫停標記（用戶主動切歌）
      wasPausedByAudioManagerRef.current = false;
      
      // ✅ 自動播放下一首
      setTimeout(async () => {
        try {
          // ✅ 請求播放權限（優先度 1 - 最低）
          if (audioRef.current) {
            const canPlay = audioManager.requestPlay(audioRef.current, 1);
            
            // 如果優先度不夠（例如音樂 Modal 或預覽正在播放），不允許播放
            if (!canPlay) {
              console.warn('⚠️ [next] 優先度不夠，無法播放下一首');
              return;
            }
            
            // 等待音頻載入完成
            if (audioRef.current.readyState >= 2) {
              await audioRef.current.play();
              setIsPlaying(true);
              console.log('🎵 [next] 下一首開始播放');
            } else {
              // 如果還沒載入完成，等待載入完成後播放
              const handleCanPlay = async () => {
                try {
                  await audioRef.current.play();
                  setIsPlaying(true);
                  console.log('🎵 [next] 下一首開始播放（延遲載入）');
                } catch (error) {
                  console.warn('⚠️ [next] 自動播放失敗:', error);
                }
                audioRef.current.removeEventListener('canplay', handleCanPlay);
              };
              audioRef.current.addEventListener('canplay', handleCanPlay);
            }
          }
        } catch (error) {
          console.warn('⚠️ [next] 自動播放失敗:', error);
        }
      }, 300);
    } finally {
      // ✅ 不再需要延遲清除轉換標記，因為已經在上面的代碼中清除了
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
      setActiveIndex(prevIndex);

      // ✅ 設置新的音樂源
      setSrcWithAudio(prevItem.url);
      setOriginUrl(prevItem.url);
      setTrackTitle(prevItem.title);

      // ✅ 清除 AudioManager 暫停標記（用戶主動切歌）
      wasPausedByAudioManagerRef.current = false;

      // ✅ 請求播放權限（優先度 1 - 最低）
      if (audioRef.current) {
        const canPlay = audioManager.requestPlay(audioRef.current, 1);
        if (!canPlay) {
          console.warn('⚠️ [previous] 優先度不夠，無法播放上一首');
        }
      }

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
        
        // ✅ 先暫停並重置（確保舊音頻停止）
        if (!audioRef.current.paused) {
          audioRef.current.pause();
        }
        audioRef.current.currentTime = 0;
        
        // ✅ 設置新的 src
        audioRef.current.src = newSrc || "";
        
        // ✅ 強制觸發加載（確保音頻元素重新載入新的 URL）
        audioRef.current.load();
        
        console.log('🎵 [setSrcWithAudio] 設置音頻源:', newSrc || '(空)');
      } catch (error) {
        console.warn("🔧 設置音頻源失敗", error);
      }
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
          
          // ✅ 不觸發 playerStateChanged 事件（不是用戶操作，不記錄）
        }
      }
    };

    window.addEventListener("audioManagerPaused", handleAudioManagerPaused);

    return () => {
      window.removeEventListener("audioManagerPaused", handleAudioManagerPaused);
    };
  }, [isPlaying]);

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
    // ✅ 播放器在被打斷前的播放狀態（用於高優先級音源關閉後恢復）
    wasPlayingBeforeInterruption: wasPlayingBeforeInterruptionRef.current,
    audioRef, // ✅ 提供 audioRef 用於檢查播放器的實際狀態
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
