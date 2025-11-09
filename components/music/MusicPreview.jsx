"use client";

import React, { useRef, useEffect, useState, useMemo } from "react";
import { GENRE_MAP, GENRE_ICONS } from "@/constants/musicCategories";
import NewBadge from "@/components/image/NewBadge";
import { audioManager } from "@/utils/audioManager";
import { usePlayer } from "@/components/context/PlayerContext";

const MusicPreview = ({ music, className = "", onClick }) => {
  const audioRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [displayDuration, setDisplayDuration] = useState(music.duration || 0); // 顯示的時長
  const [playStartTime, setPlayStartTime] = useState(null);
  const playEndTime = useRef(null);
  const hasInitializedRef = useRef(false);
  const audioDuration = useRef(null);
  const targetVolumeRef = useRef(1); // 目標音量（從 localStorage 讀取）
  const playStartTimeRef = useRef(null); // 記錄播放開始時間（用於計算進度）
  const audioPlayStartTimeRef = useRef(null); // 記錄音頻播放開始的 currentTime
  const lastPlayTimeRef = useRef(0); // 記錄上次播放的累積時間（用於計算位置）
  const player = usePlayer(); // 獲取播放器 Context
  const wasPlayerPlayingRef = useRef(false); // 記錄播放器被暫停前是否在播放
  const restoreTimerRef = useRef(null); // 恢復播放器的 debounce timer
  const timeUpdateHandlerRef = useRef(null);
  const isStartingRef = useRef(false);
  const isPlayingRef = useRef(false);

  const detachTimeUpdate = () => {
    const audio = audioRef.current;
    if (timeUpdateHandlerRef.current && audio) {
      audio.removeEventListener("timeupdate", timeUpdateHandlerRef.current);
      timeUpdateHandlerRef.current = null;
    }
  };

  const stopPreview = ({ restore = true } = {}) => {
    const audio = audioRef.current;

    detachTimeUpdate();

    if (restoreTimerRef.current) {
      clearTimeout(restoreTimerRef.current);
      restoreTimerRef.current = null;
    }

    if (audio) {
      try {
        audio.pause();
      } catch (error) {
        console.warn("🎵 [Preview] stopPreview: audio.pause 失敗", error);
      }
      audio.muted = true;
      audio.volume = targetVolumeRef.current;
      audio.removeAttribute?.("data-music-preview");
      audioManager.release(audio);
    }

    playEndTime.current = null;
    audioPlayStartTimeRef.current = null;
    playStartTimeRef.current = null;
    lastPlayTimeRef.current = 0;
    hasInitializedRef.current = false;
    setPlayStartTime(null);

    if (restore && wasPlayerPlayingRef.current && player?.play) {
      restoreTimerRef.current = window.setTimeout(() => {
        const currentPriority = window.audioManager?.priority || 0;
        if (currentPriority > 1) {
          restoreTimerRef.current = null;
          return;
        }
        if (player?.src || player?.originUrl) {
          player.play();
        }
        wasPlayerPlayingRef.current = false;
        restoreTimerRef.current = null;
      }, 100);
    } else {
      wasPlayerPlayingRef.current = false;
    }

    if (isPlayingRef.current || isPlaying) {
      setIsPlaying(false);
    }
    isPlayingRef.current = false;
    isStartingRef.current = false;
  };

  const attachTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio || timeUpdateHandlerRef.current) {
      return;
    }

    const handler = () => {
      const startTime = audioPlayStartTimeRef.current;
      const endTime = playEndTime.current;

      if (startTime == null || endTime == null) {
        return;
      }

      const currentTime = audio.currentTime;
      const targetVolume = targetVolumeRef.current;
      const fadeDuration = 1.0;

      let calculatedVolume = targetVolume;

      const fadeInEndTime = startTime + fadeDuration;
      if (currentTime < fadeInEndTime) {
        const fadeProgress = Math.max(
          0,
          Math.min(1, (currentTime - startTime) / fadeDuration),
        );
        calculatedVolume = targetVolume * fadeProgress;
      } else if (currentTime > endTime - fadeDuration) {
        const fadeOutStartTime = endTime - fadeDuration;
        const fadeProgress = Math.max(
          0,
          Math.min(1, (currentTime - fadeOutStartTime) / fadeDuration),
        );
        calculatedVolume = targetVolume * (1 - fadeProgress);
      }

      audio.volume = Math.max(0, Math.min(1, calculatedVolume));

      if (currentTime >= endTime) {
        console.log("🎵 [MusicPreview] 預覽結束（timeupdate）");
        stopPreview({ restore: true });
      } else {
        lastPlayTimeRef.current = currentTime - startTime;
      }
    };

    timeUpdateHandlerRef.current = handler;
    audio.addEventListener("timeupdate", handler);
  };

  const waitForReadyState = (audio) => {
    if (audio.readyState >= 2) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        audio.removeEventListener("canplaythrough", handleReady);
        audio.removeEventListener("loadedmetadata", handleReady);
        audio.removeEventListener("error", handleError);
      };

      const handleReady = () => {
        cleanup();
        resolve();
      };

      const handleError = (event) => {
        cleanup();
        reject(event);
      };

      audio.addEventListener("canplaythrough", handleReady, { once: true });
      audio.addEventListener("loadedmetadata", handleReady, { once: true });
      audio.addEventListener("error", handleError, { once: true });

      try {
        audio.load?.();
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  };

  const computePreviewWindow = (durationSeconds) => {
    const duration = Math.max(durationSeconds || 60, 8);
    const minStartPercent = 0.3;
    const maxStartPercent = 0.7;
    const randomStartPercent =
      minStartPercent + Math.random() * (maxStartPercent - minStartPercent);
    const start = duration * randomStartPercent;
    const end = Math.min(start + 8, duration);
    return { start, end };
  };

  const startPreview = async () => {
    const audio = audioRef.current;
    if (!audio || isStartingRef.current) {
      return;
    }

    if (isPlayingRef.current || isPlaying) {
      stopPreview({ restore: false });
    }

    isStartingRef.current = true;

    try {

      try {
        await waitForReadyState(audio);
      } catch (error) {
        console.warn("🎵 [Preview] waitForReadyState 發生錯誤", error);
      }

      const effectiveDuration =
        audioDuration.current ||
        (audio.duration && isFinite(audio.duration)
          ? audio.duration
          : music.duration || 60);

      const { start, end } = computePreviewWindow(effectiveDuration);

      playEndTime.current = end;
      audioPlayStartTimeRef.current = start;
      playStartTimeRef.current = Date.now();
      lastPlayTimeRef.current = 0;
      setPlayStartTime(start);

      try {
        audio.currentTime = start;
      } catch (error) {
        console.warn("🎵 [Preview] startPreview: 設置 currentTime 失敗", error);
      }

      audio.volume = 0;
      audio.muted = false;
      audio.dataset.musicPreview = "true";

      const canPlay = audioManager.requestPlay(audio, 2);
      if (!canPlay) {
        console.log("🎵 [Preview] ❌ 優先度不夠，取消播放");
        stopPreview({ restore: true });
        return;
      }

      try {
        await audio.play();
      } catch (error) {
        if (error.name === "AbortError" || error.name === "NotAllowedError") {
          console.warn("🎵 [Preview] startPreview: 播放被瀏覽器拒絕", error);
        } else {
          console.error("音頻播放錯誤:", error);
        }
        stopPreview({ restore: false });
        return;
      }

      hasInitializedRef.current = true;
      attachTimeUpdate();
      isPlayingRef.current = true;
      setIsPlaying(true);
    } finally {
      isStartingRef.current = false;
    }
  };

  useEffect(() => {
    // 檢測是否為行動裝置
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    return () => {
      stopPreview({ restore: false });
    };
  }, []);

  // ✅ 監聽播放器播放狀態變化，記錄播放/暫停
  useEffect(() => {
    // 監聽播放器狀態變化事件（用戶操作）
    const handlePlayerStateChanged = (event) => {
      const { isPlaying, action } = event.detail || {};
      // 只記錄用戶主動操作（play/pause action），不記錄 AudioManager 的暫停
      if (action === "play" || action === "pause") {
        const oldValue = wasPlayerPlayingRef.current;
        wasPlayerPlayingRef.current = isPlaying;
        console.log(`🎵 [Preview] 播放器狀態變化（用戶操作 ${action}）: ${oldValue} -> ${isPlaying}`);
      }
    };

    window.addEventListener("playerStateChanged", handlePlayerStateChanged);
    
    return () => {
      window.removeEventListener("playerStateChanged", handlePlayerStateChanged);
    };
  }, []);

  useEffect(() => {
    // 初始化音頻音量和靜音狀態
    const audio = audioRef.current;
    if (!audio) return;

    try {
      const saved = localStorage.getItem("playerVolume");
      if (saved) {
        const vol = parseFloat(saved);
        if (!isNaN(vol) && vol >= 0 && vol <= 1) {
          audio.volume = vol;
          targetVolumeRef.current = vol; // 保存目標音量
        }
      }
    } catch (e) {
      console.warn("初始化音量失敗:", e);
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (audio.duration && isFinite(audio.duration)) {
        const durationSeconds = Math.round(audio.duration);
        audioDuration.current = audio.duration;
        if (!music.duration || music.duration === 0) {
          setDisplayDuration(durationSeconds);
        }
      } else if (music.duration) {
        audioDuration.current = music.duration;
        setDisplayDuration(music.duration);
      }
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [music.duration]);
  
  // 當 music 變化時，重置顯示時長並停止當前播放
  useEffect(() => {
    setDisplayDuration(music.duration || 0);
    stopPreview({ restore: false });
  }, [music._id, music.duration]);


  // ✅ AudioManager 會自動處理單一音源，不需要手動監聽全局事件

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // ❌ 移除 pause 事件監聽器，避免在預覽播放時被錯誤觸發
  // 預覽的停止應該由 isPlaying 狀態控制，不需要監聽 pause 事件
  // 監聽 pause 事件可能會在預覽播放時被錯誤觸發，導致預覽被停止
  

  const handleMouseEnter = () => {
    if (!isMobile) {
      const musicId = music?._id?.substring(0, 8) || 'unknown';
      console.log(`🎵 [Preview] Hover Enter [${musicId}]`);
      setIsHovered(true);
      if (restoreTimerRef.current) {
        clearTimeout(restoreTimerRef.current);
        restoreTimerRef.current = null;
        console.log(`🎵 [Preview] Hover: 取消恢復 timer（有新預覽）`);
      }
    }
  };

  const handleMouseLeave = () => {
    if (!isMobile) {
      const musicId = music?._id?.substring(0, 8) || 'unknown';
      console.log(`🎵 [Preview] Hover Leave [${musicId}], isPlaying: ${isPlaying}`);
      setIsHovered(false);
      if (isPlayingRef.current || isPlaying) {
        stopPreview({ restore: true });
      }
    }
  };

  const handlePlayButtonClick = async (e) => {
    e.stopPropagation();

    if (isStartingRef.current) {
      return;
    }

    if (isPlayingRef.current || isPlaying) {
      stopPreview({ restore: true });
      return;
    }

    if (restoreTimerRef.current) {
      clearTimeout(restoreTimerRef.current);
      restoreTimerRef.current = null;
      console.log(`🎵 [Preview] Click: 取消恢復 timer（有新預覽）`);
    }

    const musicId = music?._id?.substring(0, 8) || 'unknown';
    console.log(`🎵 [Preview] Click: 開始預覽 [${musicId}]`);

    try {
      if (typeof document !== "undefined") {
        const allPreviews = document.querySelectorAll("audio[data-music-preview=\"true\"]");
        allPreviews.forEach((audioElement) => {
          if (audioElement && audioElement !== audioRef.current && !audioElement.paused) {
            try {
              audioElement.pause();
              audioElement.currentTime = 0;
              if (audioManager && typeof audioManager.release === "function") {
                audioManager.release(audioElement);
              }
            } catch (err) {
              console.warn("停止其他預覽失敗:", err);
            }
          }
        });
      }
    } catch (err) {
      console.warn("處理預覽切換時出錯:", err);
    }

    await startPreview();
  };

  const handleClick = () => {
    stopPreview({ restore: false });
    if (onClick) onClick();
  };

  // ✅ 計算曲風符號位置（散佈在卡片邊緣）
  const genrePositions = useMemo(() => {
    // 如果沒有 genre 或 genre 是空陣列，使用默認符號（通用音樂符號）
    let genres = [];
    if (
      music.genre &&
      Array.isArray(music.genre) &&
      music.genre.length > 0
    ) {
      // 有曲風資料，使用實際曲風
      genres = music.genre.slice(0, 8);
    } else {
      // 沒有曲風資料，顯示 3-4 個通用音樂符號，散佈在邊緣
      // 這樣即使沒有曲風也能看到符號效果
      genres = ["other", "other", "other", "other"];
    }

    // 最多顯示 8 個符號
    genres = genres.slice(0, 8);

    // ✅ 使用圓圈分布：符號均勻分布在圓周上
    // 半徑設定：距離卡片中心 35%（避開中間播放按鈕和底部資訊）
    const radius = 35; // 百分比，從中心到符號的距離
    
    // 處理符號顯示（包括沒有曲風的情況）
    return genres.map((genre, idx) => {
      const icon = GENRE_ICONS[genre] || "🎵";
      
      // 計算每個符號在圓圈上的角度（均勻分布）
      // 從上方開始（-90度），順時針分布
      const totalCount = genres.length;
      const angleStep = (360 / totalCount) * (Math.PI / 180); // 轉換為弧度
      const angle = -90 * (Math.PI / 180) + idx * angleStep; // 從上方開始
      
      // 計算符號在圓圈上的位置（相對於卡片中心）
      // 使用極坐標轉換為直角坐標
      const offsetX = radius * Math.cos(angle);
      const offsetY = radius * Math.sin(angle);
      
      // 轉換為 left/top 百分比（中心是 50%）
      // 加上向下偏移，讓整個圓圈往下移約 4%（僅影響固定位置，不影響旋轉中心）
      const verticalOffset = 4; // 往下偏移 4%（相對於原本往上移了 2%）
      const left = 50 + offsetX;
      const top = 50 + offsetY + verticalOffset; // 固定位置（有垂直偏移）
      const topForRotation = 50 + offsetY; // 播放時的位置（無垂直偏移，圍繞正中心旋轉）
      
      return {
        genre,
        icon,
        left: `${left}%`,
        top: `${top}%`, // 固定位置使用
        topForRotation: `${topForRotation}%`, // 播放時使用（無垂直偏移）
        transform: "translate(-50%, -50%)",
        // 保存相對於中心的位置，用於旋轉動畫
        offsetX,
        offsetY, // 保持相對於卡片中心的位置
        // 保存角度和半徑，用於播放動畫
        angle,
        radius,
      };
    });
  }, [music.genre]);

  // ✅ NEW 標籤判斷（< 10 小時）
  const getCreatedMsFromObjectId = (id) => {
    if (typeof id === "string" && id.length === 24) {
      const sec = parseInt(id.slice(0, 8), 16);
      if (!Number.isNaN(sec)) return sec * 1000;
    }
    return Date.now();
  };
  
  const createdMs = music?.createdAt ? new Date(music.createdAt).getTime() : getCreatedMsFromObjectId(music?._id);
  const isNew = (Date.now() - createdMs) / 36e5 < 10;

  return (
    <div 
      className={`aspect-square bg-zinc-700 relative overflow-hidden cursor-pointer ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {/* NEW 徽章（左上角，往下移避免被時長擋住） */}
      {isNew && (
        <div className="absolute left-2 top-10 z-20 pointer-events-none">
          <NewBadge animated />
        </div>
      )}

      {/* 背景圖片或音樂封面 */}
      <div 
        className={`w-full h-full flex items-center justify-center relative overflow-hidden ${
          music.coverImageUrl 
            ? "" 
            : "bg-gradient-to-br from-purple-600 via-pink-600 to-blue-600"
        }`}
        style={{
          ...(music.coverImageUrl ? {
            backgroundImage: `url(${music.coverImageUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          } : {}),
          filter: isHovered
            ? "brightness(1.1) saturate(1.2)"
            : "brightness(1) saturate(1)",
          transform: isHovered ? "scale(1.02)" : "scale(1)",
        }}
      >
        {/* 播放時的音波特效（在中間區域） */}
        {isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center z-0">
            <div className="flex items-center gap-1">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-white/30 rounded-full animate-pulse"
                  style={{
                    height: `${20 + Math.random() * 40}px`,
                    animationDelay: `${i * 0.1}s`,
                    animationDuration: "0.8s",
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ✅ 全局 CSS 動畫定義 */}
        {isPlaying && (
          <style>
            {`
              @keyframes floatIcon {
                0%, 100% {
                  transform: translateY(0px) scale(1);
                }
                50% {
                  transform: translateY(-10px) scale(1.1);
                }
              }
            `}
          </style>
        )}

        {/* ✅ 曲風符號（播放時圍繞中心旋轉並飄動，停止時回到初始位置） */}
        {/* 如果有封面圖片，不顯示曲風符號 */}
        {!music.coverImageUrl && genrePositions.map((item, idx) => {
          // 播放時的動畫參數
          const rotationDuration = 12 + idx * 1.5;

          // 非播放時：顯示初始位置，使用 transition 平滑過渡
          if (!isPlaying) {
            return (
              <div
                key={`${item.genre}-${idx}`}
                className="absolute z-20 text-3xl sm:text-4xl drop-shadow-2xl transition-all duration-300 pointer-events-none"
                style={{
                  top: item.top,
                  left: item.left,
                  transform: `${item.transform} ${
                    isHovered ? "scale(1.15)" : "scale(1)"
                  }`,
                  opacity: isHovered ? 1 : 0.75,
                  filter: isHovered
                    ? "drop-shadow(0 0 8px rgba(255,255,255,0.5))"
                    : "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
                }}
                title={GENRE_MAP[item.genre] || item.genre}
              >
                {item.icon}
              </div>
            );
          }

          // 播放時：從原本圓圈位置圍繞卡片中心旋轉（圓心固定不動）
          // 每個符號獨立圍繞卡片中心旋轉，不使用會旋轉的 wrapper
          return (
            <React.Fragment key={`${item.genre}-${idx}`}>
              {/* 旋轉+飄動動畫 */}
              <style>
                {`
                  @keyframes rotateAroundCenter${idx} {
                    from {
                      transform: rotate(0deg);
                    }
                    to {
                      transform: rotate(360deg);
                    }
                  }
                  @keyframes floatIcon${idx} {
                    0%, 100% {
                      transform: translateY(0px) scale(1);
                    }
                    50% {
                      transform: translateY(-10px) scale(1.1);
                    }
                  }
                `}
              </style>
              {/* 符號：直接固定在圓圈初始位置，圍繞卡片中心旋轉 */}
              {/* 動畫中計算每個時刻符號在圓圈上的位置，同時自轉 */}
              <style>
                {`
                  @keyframes rotateAroundFixedCenter${idx} {
                    ${(() => {
                      // 計算動畫關鍵幀：符號沿著圓圈移動（公轉）
                      const steps = 64; // 增加到64個關鍵點，讓動畫更平滑，減少頓感
                      let keyframes = "";
                      for (let i = 0; i <= steps; i++) {
                        const progress = i / steps;
                        // 符號在圓圈上的新角度（從初始角度開始，旋轉 progress * 360度）
                        const currentAngle = item.angle + (progress * 2 * Math.PI);
                        const currentOffsetX = item.radius * Math.cos(currentAngle);
                        const currentOffsetY = item.radius * Math.sin(currentAngle);
                        const percent = (i / steps) * 100;
                        // 計算新的位置（相對於卡片中心）
                        const newLeft = 50 + currentOffsetX;
                        const newTop = 50 + currentOffsetY;
                        // 飄動效果：使用正弦波讓飄動更平滑
                        const floatProgress = progress * 4; // 飄動週期
                        const floatY = Math.sin(floatProgress * Math.PI) * -10; // -10 到 0 之間平滑變化
                        const scale = 1 + Math.sin(floatProgress * Math.PI) * 0.1; // 1 到 1.1 之間平滑變化
                        // 自轉：符號自己旋轉（速度更快，每圈公轉自轉2圈）
                        const selfRotate = progress * 720; // 自轉720度（2圈）
                        keyframes += `
                          ${percent}% {
                            left: ${newLeft}%;
                            top: ${newTop}%;
                            transform: translate(-50%, -50%) rotate(${selfRotate}deg) translateY(${floatY}px) scale(${scale});
                          }
                        `;
                      }
                      return keyframes;
                    })()}
                  }
                `}
              </style>
              <div
                className="absolute z-20 text-3xl sm:text-4xl drop-shadow-2xl pointer-events-none transition-all duration-300"
                style={{
                  left: item.left, // 播放時從圓圈位置開始
                  top: item.topForRotation,
                  transform: "translate(-50%, -50%)",
                  animation: `rotateAroundFixedCenter${idx} ${rotationDuration}s linear infinite`,
                  animationDelay: `${idx * 0.1}s`,
                  opacity: 1,
                  filter: "drop-shadow(0 0 8px rgba(255,255,255,0.5))",
                  willChange: "left, top, transform",
                  backfaceVisibility: "hidden",
                  WebkitFontSmoothing: "antialiased",
                }}
                title={GENRE_MAP[item.genre] || item.genre}
              >
                {item.icon}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* 音頻元素（隱藏） */}
      <audio 
        ref={audioRef} 
        src={music.musicUrl} 
        preload="none"
      />

      {/* 播放按鈕覆蓋層（在中間區域，z-index 高於符號） */}
      {/* 懸停預聽時隱藏按鈕 */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center z-30">
          <button
            onClick={handlePlayButtonClick}
            className={`bg-black bg-opacity-60 hover:bg-opacity-80 rounded-full p-4 transition-all duration-300 ${
              isHovered ? "bg-opacity-40 scale-110" : "bg-opacity-60 scale-100"
            }`}
          >
            <svg
              className="w-8 h-8 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        </div>
      )}

      {/* 預覽控制按鈕（右上角） */}
      <button
        onClick={handlePlayButtonClick}
        className={`absolute top-3 right-3 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black/40 ${
          isPlaying ? "bg-emerald-500/90 text-white hover:bg-emerald-500" : "bg-black/70 text-white hover:bg-black/80"
        }`}
      >
        {isPlaying ? (
          <>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/70 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
            </span>
            播放中
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
            預覽
          </>
        )}
      </button>

      {/* 音樂時長標籤（左上角） */}
      {displayDuration > 0 && (
        <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm text-white text-xs px-2 py-1 rounded z-30">
          {(() => {
            // 格式化時長：將秒數轉換為「幾分幾秒」
            const minutes = Math.floor(displayDuration / 60);
            const seconds = displayDuration % 60;
            return minutes > 0 ? `${minutes}分${seconds}秒` : `${seconds}秒`;
          })()}
        </div>
      )}

      {/* 音樂資訊覆蓋層 - 只在 hover 時顯示 */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 transition-all duration-300 ${
          isHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        }`}
      >
        <div className="text-white">
          <h3 className="font-semibold text-sm mb-2 line-clamp-2">
            {music.title}
          </h3>
          <div className="flex items-center justify-between text-xs text-gray-300">
            <span>@{music.authorName}</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span>❤️</span>
                <span>{music.likesCount || 0}</span>
              </span>
              <span className="flex items-center gap-1">
                <span>🎵</span>
                <span>{music.plays || 0}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MusicPreview;
