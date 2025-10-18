"use client";

import { createContext, useContext, useState, useRef, useEffect, useCallback, useMemo } from "react";

const PlayerContext = createContext();

export function PlayerProvider({ children, defaultShareMode = "global", defaultMiniPlayerEnabled = true, defaultSeekable = false }) {
  const [src, setSrc] = useState("");
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // ✅ 修复：从 localStorage 读取音量，默认 1.0 (100%)
  const [volume, setVolumeState] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('playerVolume');
        if (saved) {
          const vol = parseFloat(saved);
          if (!isNaN(vol) && vol >= 0 && vol <= 1) {
            return vol;
          }
        }
      } catch (e) {
        console.warn('读取音量失败:', e);
      }
    }
    return 1.0; // 默认 100%（符合 YouTube 默认值）
  });
  // 初始化时就标记为已同步（因为已从 localStorage 加载）
  const [volumeSynced, setVolumeSynced] = useState(true);
  
  // 真正的音量控制函數
  const setVolume = useCallback((newVolume) => {
    // 確保音量值是有效的數字
    if (typeof newVolume !== 'number' || isNaN(newVolume) || !isFinite(newVolume)) {
      console.warn("🔧 無效的音量值:", newVolume);
      return;
    }
    
    // 確保音量值在有效範圍內 (0-1)
    const validVolume = Math.max(0, Math.min(1, newVolume));
    
    // 更新狀態
    setVolumeState(validVolume);
    
    // ✅ 修复：保存到 localStorage
    try {
      localStorage.setItem('playerVolume', validVolume.toString());
    } catch (e) {
      console.warn("🔧 保存音量失敗:", e);
    }
    
    // 標記音量已同步
    setVolumeSynced(true);
    
    // 控制外部播放器音量
    if (externalControlsRef.current && typeof externalControlsRef.current.setVolume === 'function') {
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
  const [miniPlayerEnabled, setMiniPlayerEnabled] = useState(defaultMiniPlayerEnabled);
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
      setDuration(audioRef.current && audioRef.current.duration || 0);
    }
  }, []);

  const onTime = useCallback(() => {
    if (!usingExternalPlayerRef.current && audioRef.current) {
      const newTime = audioRef.current && audioRef.current.currentTime || 0;
      currentTimeRef.current = newTime;
      
      // 完全移除 setCurrentTime 調用，避免無限循環
      // 時間更新將通過其他方式處理（如手動觸發或外部播放器）
    }
  }, []);

  const onPlay = useCallback(() => {
    if (!isTransitioningRef.current) {
      setIsPlaying(true);
    }
  }, []);

  const onPause = useCallback(() => {
    if (!isTransitioningRef.current) {
      setIsPlaying(false);
    }
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
    if (audioRef.current && typeof volume === 'number' && !isNaN(volume) && isFinite(volume)) {
      // 確保音量值在有效範圍內 (0-1)
      const validVolume = Math.max(0, Math.min(1, volume));
      audioRef.current.volume = validVolume;
    }
  }, [volume]);

  // 完全重寫的播放函數
  const play = async () => {
    
    if (!src && !originUrl) {
      console.warn('⚠️ [PlayerContext.play] 無音源，跳過');
      return false;
    }
    
    // 如果正在轉換，等待轉換完成
    if (isTransitioningRef.current) {
      console.warn('⚠️ [PlayerContext.play] 正在轉換中，跳過');
      return false;
    }
    
    // 優先使用外部播放器（YouTube）
    if (externalControlsRef.current && typeof externalControlsRef.current.play === 'function') {
      try {
        
        // ✅ 新增：檢查播放器是否已經 ready
        if (!window.__YT_READY__) {
          console.warn('⚠️ [PlayerContext.play] 播放器尚未準備好，稍後重試');
          // 等待播放器準備好後再嘗試
          setTimeout(() => {
            if (window.__YT_READY__ && externalControlsRef.current?.play) {
              externalControlsRef.current.play();
            }
          }, 500);
          return false;
        }
        
        externalControlsRef.current.play();
        // 等待一下檢查播放是否真的成功
        setTimeout(() => {
          // 這裡可以添加播放狀態檢查
          // console.log("🔧 外部播放器播放調用完成");
        }, 100);
        setIsPlaying(true);
        // console.log("🔧 外部播放器播放成功");
        
        // 觸發自定義事件，通知其他組件播放狀態已改變
        window.dispatchEvent(new CustomEvent('playerStateChanged', { 
          detail: { isPlaying: true, action: 'play' } 
        }));
        
        return true;
      } catch (error) {
        console.error("🔧 外部播放器播放失敗:", error);
      }
    }
    
    // 回退到本地音頻播放器
    if (audioRef.current) {
      try {
        if (audioRef.current.readyState >= 2) {
          await audioRef.current.play();
          setIsPlaying(true);
          // console.log("🔧 本地音頻播放成功");
          
          // 觸發自定義事件，通知其他組件播放狀態已改變
          window.dispatchEvent(new CustomEvent('playerStateChanged', { 
            detail: { isPlaying: true, action: 'play' } 
          }));
          
          return true;
        } else {
          return false;
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          console.warn("🔧 播放被中斷");
        } else {
          console.error("🔧 本地播放失敗:", error);
        }
      }
    }
    
    // console.log("🔧 所有播放器都無法播放");
    return false;
  };

  // 完全重寫的暫停函數
  const pause = () => {
    
    // 優先使用外部播放器（YouTube）
    if (externalControlsRef.current && typeof externalControlsRef.current.pause === 'function') {
      try {
        externalControlsRef.current.pause();
        // 等待一下檢查暫停是否真的成功
        setTimeout(() => {
          // console.log("🔧 外部播放器暫停調用完成");
        }, 100);
        // console.log("🔧 外部播放器暫停成功");
      } catch (error) {
        console.error("🔧 外部播放器暫停失敗:", error);
      }
    }
    
    // 回退到本地音頻播放器
    if (audioRef.current && !audioRef.current.paused) {
      try {
        audioRef.current.pause();
        // console.log("🔧 本地音頻播放器已暫停");
      } catch (error) {
        console.warn("🔧 本地音頻暫停失敗:", error);
      }
    }
    
    // 強制停止所有音頻和視頻元素，包括 YouTube iframe
    try {
      const audioElements = document.querySelectorAll('audio');
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
      
      const videoElements = document.querySelectorAll('video');
      videoElements.forEach((video, index) => {
        try {
          if (!video.paused) {
            video.pause();
            video.currentTime = 0; // 重置播放位置
            // console.log(`🔧 強制停止視頻元素 ${index}`);
          }
        } catch (error) {
          console.warn(`🔧 停止視頻元素 ${index} 失敗:`, error.message);
        }
      });
      
      // 強制停止所有 YouTube iframe
      const youtubeIframes = document.querySelectorAll('iframe[src*="youtube.com"]');
      youtubeIframes.forEach((iframe, index) => {
        try {
          // 嘗試通過 iframe 的 contentWindow 停止播放
          if (iframe.contentWindow) {
            try {
              iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
            } catch (e) {
              // console.log(`🔧 無法通過 postMessage 停止 iframe ${index}`);
            }
          }
          // console.log(`🔧 嘗試停止 YouTube iframe ${index}`);
        } catch (error) {
          console.warn(`🔧 停止 iframe ${index} 失敗:`, error.message);
        }
      });
    } catch (error) {
      console.warn("🔧 強制停止失敗:", error);
    }
    
    // 更新播放狀態
    setIsPlaying(false);
    // console.log("🔧 播放狀態已設為暫停");
    
    // 觸發自定義事件，通知其他組件播放狀態已改變
    window.dispatchEvent(new CustomEvent('playerStateChanged', { 
      detail: { isPlaying: false, action: 'pause' } 
    }));
  };

  const seekTo = (time) => {
    // 優先使用外部播放器（YouTube）
    if (externalControlsRef.current && typeof externalControlsRef.current.seekTo === 'function') {
      try {
        // ✅ 新增：檢查播放器是否已經 ready
        if (!window.__YT_READY__) {
          console.warn('⚠️ [PlayerContext.seekTo] 播放器尚未準備好，跳過');
          return;
        }
        
        externalControlsRef.current && externalControlsRef.current.seekTo(time);
        return;
      } catch (error) {
        console.error("🔧 外部播放器跳轉失敗:", error);
      }
    }
    
    // 回退到本地音頻播放器
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
    if (typeof currentTime === 'number' && isFinite(currentTime) && currentTime >= 0) {
      setCurrentTime(currentTime);
    }
    if (typeof duration === 'number' && isFinite(duration) && duration > 0) {
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
      const newTime = audioRef.current && audioRef.current.currentTime || 0;
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
          const audioElements = document.querySelectorAll('audio');
          const videoElements = document.querySelectorAll('video');
          const youtubeIframes = document.querySelectorAll('iframe[src*="youtube.com"]');
          const playingAudio = Array.from(audioElements).filter(audio => !audio.paused);
          const playingVideo = Array.from(videoElements).filter(video => !video.paused);
          
          // 只在有問題時才輸出詳細日誌
          if (youtubeIframes.length > 1 || playingAudio.length + playingVideo.length > 1) {
          }
    
    // 設置轉換標記，防止雙重播放
    isTransitioningRef.current = true;
    
    try {
      // 強制停止所有播放器
      
      // 停止外部播放器
      if (externalControlsRef.current && typeof externalControlsRef.current.pause === 'function') {
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
        const audioElements = document.querySelectorAll('audio');
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
        
        const videoElements = document.querySelectorAll('video');
        videoElements.forEach((video, index) => {
          try {
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
      
      if (!isBackground) {
        // 前台分頁：移除所有 YouTube iframe
        const youtubeIframes = document.querySelectorAll('iframe[src*="youtube.com"]');
        youtubeIframes.forEach((iframe, index) => {
          try {
            // 先嘗試停止播放
            if (iframe.contentWindow) {
              try {
                iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
                iframe.contentWindow.postMessage('{"event":"command","func":"stopVideo","args":""}', '*');
              } catch (e) {
                // console.log(`🔧 無法通過 postMessage 停止 iframe ${index}`);
              }
            }
            // 然後移除 iframe
            iframe.remove();
          } catch (error) {
            console.warn(`🔧 移除 iframe ${index} 失敗:`, error.message);
          }
        });
        
        // 清除外部播放器引用，強制重新初始化
        externalControlsRef.current = null;
        
        // 等待 iframe 完全移除
        await new Promise(resolve => setTimeout(resolve, 200));
      } else {
        // 後台分頁：不移除 iframe，只停止播放
      }
      
      // 強制停止所有音頻和視頻元素
      const audioVideoElements = document.querySelectorAll('audio, video');
      audioVideoElements.forEach((element, index) => {
        try {
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
      
      // 等待更長時間確保所有播放器都停止
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // 更新索引
      setActiveIndex(nextIndex);
      
      // 先設置自動播放標記
      setAutoPlayAfterBridge(true);
      window.__AUTO_PLAY_TRIGGERED__ = true;
      window.__PERSISTENT_AUTO_PLAY__ = true; // 設置持久標記
      // console.log("🔧 設置自動播放標記");
      
      // 等待狀態更新
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // 設置新的播放內容
      setSrcWithAudio(nextItem.url);
      setOriginUrl(nextItem.url);
      setTrackTitle(nextItem.title);
      
      // 等待新播放器初始化
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // 嘗試不重新創建播放器，只更換視頻源
      // window.__FORCE_RECREATE_PLAYER__ = true;
      
      // 觸發自定義事件，讓播放器頁面同步 UI
      window.dispatchEvent(new CustomEvent('playerNext', { detail: { nextIndex, nextItem } }));
      
    } finally {
      // 延遲清除轉換標記，確保播放器有時間初始化
      setTimeout(() => {
        isTransitioningRef.current = false;
      }, 3000);
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
      if (externalControlsRef.current && typeof externalControlsRef.current.pause === 'function') {
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
        const audioElements = document.querySelectorAll('audio');
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
        
        const videoElements = document.querySelectorAll('video');
        videoElements.forEach((video, index) => {
          try {
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
      
      if (!isBackground) {
        // 前台分頁：移除所有 YouTube iframe
        const youtubeIframes = document.querySelectorAll('iframe[src*="youtube.com"]');
        youtubeIframes.forEach((iframe, index) => {
          try {
            // 先嘗試停止播放
            if (iframe.contentWindow) {
              try {
                iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
                iframe.contentWindow.postMessage('{"event":"command","func":"stopVideo","args":""}', '*');
              } catch (e) {
                // console.log(`🔧 無法通過 postMessage 停止 iframe ${index}`);
              }
            }
            // 然後移除 iframe
            iframe.remove();
          } catch (error) {
            console.warn(`🔧 移除 iframe ${index} 失敗:`, error.message);
          }
        });
        
        // 等待 iframe 完全移除
        await new Promise(resolve => setTimeout(resolve, 200));
      } else {
        // 後台分頁：不移除 iframe，只停止播放
      }
      
      // 強制停止所有音頻和視頻元素
      const audioVideoElements = document.querySelectorAll('audio, video');
      audioVideoElements.forEach((element, index) => {
        try {
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
      
      // 等待一下確保所有播放器都停止
      await new Promise(resolve => setTimeout(resolve, 500));
      
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
      window.dispatchEvent(new CustomEvent('playerPrevious', { detail: { prevIndex, prevItem } }));
      
    } finally {
      // 延遲清除轉換標記，確保播放器有時間初始化
      setTimeout(() => {
        isTransitioningRef.current = false;
      }, 3000);
    }
  };

  // 簡化 setSrc 方法
  const setSrcWithAudio = (newSrc) => {
    setSrc(newSrc);
    
    // 設置音頻源（如果存在本地音頻播放器）
    if (audioRef.current && newSrc) {
      try {
        audioRef.current.src = newSrc;
      } catch (error) {
        console.warn("🔧 設置音頻源失敗:", error);
      }
    }
  };

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
    externalControls: externalControlsRef.current
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