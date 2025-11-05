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
  const hoverTimeoutRef = useRef(null);
  const [playStartTime, setPlayStartTime] = useState(null);
  const playEndTime = useRef(null);
  const hasInitializedRef = useRef(false);
  const audioDuration = useRef(null);
  const targetVolumeRef = useRef(1); // 目標音量（從 localStorage 讀取）
  const playStartTimeRef = useRef(null); // 記錄播放開始時間（用於計算進度）
  const audioPlayStartTimeRef = useRef(null); // 記錄音頻播放開始的 currentTime
  const lastPlayTimeRef = useRef(0); // 記錄上次播放的累積時間（用於計算位置）
  const player = usePlayer(); // 獲取播放器 Context
  const wasPlayerPlayingRef = useRef(false); // 記錄開始預覽時播放器是否在播放

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

    const handleTimeUpdate = () => {
      if (!playStartTime || !playEndTime.current) return;

      const currentTime = audio.currentTime;
      const targetVolume = targetVolumeRef.current;
      const fadeDuration = 1.0; // 淡入淡出持續時間（秒）

      let calculatedVolume = 0;

      // 計算淡入（開始播放的 1 秒內）
      const fadeInEndTime = playStartTime + fadeDuration;
      if (currentTime < fadeInEndTime) {
        const fadeProgress = Math.max(
          0,
          Math.min(1, (currentTime - playStartTime) / fadeDuration),
        );
        calculatedVolume = targetVolume * fadeProgress;
      }
      // 計算淡出（結束前的 1 秒內）
      else if (currentTime > playEndTime.current - fadeDuration) {
        const fadeOutStartTime = playEndTime.current - fadeDuration;
        const fadeProgress = Math.max(
          0,
          Math.min(1, (currentTime - fadeOutStartTime) / fadeDuration),
        );
        calculatedVolume = targetVolume * (1 - fadeProgress);
      }
      // 中間部分保持目標音量
      else {
        calculatedVolume = targetVolume;
      }

      // 確保音量值在 [0, 1] 範圍內
      const safeVolume = Math.max(0, Math.min(1, calculatedVolume));
      audio.volume = safeVolume;

      // ✅ AudioManager 會自動處理優先度，不需要手動檢查

      // 如果播放超過目標結束時間，暫停播放（不重複）
      if (currentTime >= playEndTime.current) {
        // 計算已播放時間（預覽時長）
        const previewLength = playEndTime.current - playStartTime;
        lastPlayTimeRef.current = previewLength; // 保存已播放時間
        
        // 停止播放
        audio.volume = 0; // 確保音量歸零
        audio.pause();
        setIsPlaying(false);
      } else {
        // 持續更新已播放時間
        const elapsedTime = currentTime - playStartTime;
        lastPlayTimeRef.current = elapsedTime;
      }
    };

    // 獲取音頻實際時長
    const handleLoadedMetadata = () => {
      if (audio.duration && isFinite(audio.duration)) {
        const durationSeconds = Math.round(audio.duration);
        audioDuration.current = audio.duration;
        // 如果資料庫中沒有時長，更新顯示的時長
        if (!music.duration || music.duration === 0) {
          setDisplayDuration(durationSeconds);
        }
      } else if (music.duration) {
        // 如果 audio.duration 不可用，使用 music.duration（秒）
        audioDuration.current = music.duration;
        setDisplayDuration(music.duration);
      }
    };

    if (isPlaying) {
      audio.addEventListener("timeupdate", handleTimeUpdate);
    }
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [isPlaying, playStartTime, music.duration]);
  
  // 監聽強制停止事件
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleForceStop = () => {
      setIsPlaying(false);
      audio.pause();
      audio.currentTime = 0;
      audioManager.release(audio);
      setPlayStartTime(null);
      playEndTime.current = null;
      hasInitializedRef.current = false;
    };

    audio.addEventListener('forceStopPreview', handleForceStop);

    return () => {
      audio.removeEventListener('forceStopPreview', handleForceStop);
    };
  }, []);

  // 當 music 變化時，重置顯示時長並停止當前播放
  useEffect(() => {
    setDisplayDuration(music.duration || 0);
    
    // 如果音樂改變了，立即停止當前播放（允許切換到新音樂）
    const audio = audioRef.current;
    if (audio && isPlaying) {
      audio.pause();
      audio.currentTime = 0;
      audioManager.release(audio);
      setIsPlaying(false);
      setPlayStartTime(null);
      playEndTime.current = null;
      hasInitializedRef.current = false;
      
      // 恢復播放器（如果之前有播放）
      if (wasPlayerPlayingRef.current && player?.play) {
        player.play();
        wasPlayerPlayingRef.current = false;
      }
    }
  }, [music._id, music.duration, isPlaying, player]);


  // ✅ AudioManager 會自動處理單一音源，不需要手動監聽全局事件

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying && !hasInitializedRef.current) {
      // 獲取音頻實際時長（優先使用 audio.duration，其次使用 music.duration）
      const duration =
        audioDuration.current ||
        (audio.duration && isFinite(audio.duration)
          ? audio.duration
          : music.duration || 60); // 默認 60 秒作為後備

      // 基於總長度百分比計算隨機起點（30% ~ 70% 區間）
      const minStartPercent = 0.3; // 最少從 30% 位置開始
      const maxStartPercent = 0.7; // 最多從 70% 位置開始
      const randomStartPercent =
        minStartPercent + Math.random() * (maxStartPercent - minStartPercent);
      const randomStart = duration * randomStartPercent;

      // 播放約 8 秒
      const previewLength = 8;
      const endTime = Math.min(randomStart + previewLength, duration);

      setPlayStartTime(randomStart);
      audioPlayStartTimeRef.current = randomStart; // 保存到 ref，確保在 useEffect 中可以訪問
      playEndTime.current = endTime;
      playStartTimeRef.current = Date.now(); // 記錄播放開始的實際時間
      lastPlayTimeRef.current = 0; // 重置累積播放時間
      audio.currentTime = randomStart;
      // 開始播放時音量設為 0，讓淡入效果生效
      audio.volume = 0;
      
      // ✅ 在初始化時記錄播放器狀態（在開始預覽前記錄）
      wasPlayerPlayingRef.current = player?.isPlaying || false;
      console.log("🎵 [MusicPreview] 開始預覽，記錄播放器狀態:", wasPlayerPlayingRef.current);
      
      hasInitializedRef.current = true;
      // 開始新播放時，不清除固定位置，讓動畫從凍結的位置繼續
      // 這樣符號會從上次停止的位置繼續前進
    }

    if (isPlaying) {
      // ✅ 停止所有其他預覽
      stopAllOtherPreviews();
      
      // ✅ 設置標記
      audio.dataset.musicPreview = "true";
      
      // ✅ 請求播放權限（優先度 2 - 中等）
      // AudioManager 會自動暫停低優先度的音頻（主播放器），但不會暫停高優先度的音頻（音樂 Modal）
      const canPlay = audioManager.requestPlay(audio, 2);
      
      // 如果優先度不夠（例如音樂 Modal 正在播放），不允許播放
      if (!canPlay) {
        audio.pause();
        setIsPlaying(false);
        return;
      }

      // 播放時確保不被靜音，讓音量控制生效
      audio.muted = false;
      // 使用 Promise 來處理播放，避免中斷錯誤
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          // 播放被中斷或失敗，忽略錯誤
          if (error.name !== "AbortError" && error.name !== "NotAllowedError") {
            console.error("音頻播放錯誤:", error);
          }
        });
      }
    } else {
      // ✅ 釋放播放權限
      audioManager.release(audio);
      
      audio.pause();
      // 非播放時靜音（節省資源）
      audio.muted = true;
      // 停止播放時恢復音量（避免下次播放時音量異常）
      if (audio.volume === 0) {
        audio.volume = targetVolumeRef.current;
      }
      
      // ✅ 恢復播放器播放（如果之前是在播放狀態）
      if (wasPlayerPlayingRef.current && player?.play) {
        console.log("🎵 [MusicPreview] 預覽結束，恢復播放器播放");
        player.play();
      }
      
      // 重置標記
      wasPlayerPlayingRef.current = false;
      
      setPlayStartTime(null);
      audioPlayStartTimeRef.current = null; // 清除 ref
      playEndTime.current = null;
      hasInitializedRef.current = false;
    }
  }, [isPlaying, music.genre]);
  

  const handleMouseEnter = () => {
    if (!isMobile) {
      // 清除之前的 timeout
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      
      setIsHovered(true);
      
      // 延遲一小段時間再開始播放，避免快速滑過時觸發
      hoverTimeoutRef.current = setTimeout(() => {
        // AudioManager 會自動處理單一音源
        setIsPlaying(true);
      }, 150); // 150ms 延遲
    }
  };

  const handleMouseLeave = () => {
    if (!isMobile) {
      // 清除 timeout
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      
      setIsHovered(false);
      setIsPlaying(false);
    }
  };

  // 停止所有其他音樂預覽的函數
  const stopAllOtherPreviews = () => {
    try {
      // 查找所有正在預覽的音樂音頻元素
      const allPreviewAudios = document.querySelectorAll('audio[data-music-preview="true"]');
      allPreviewAudios.forEach((audio) => {
        // 跳過當前音樂的 audio
        if (audio !== audioRef.current) {
          audio.pause();
          audio.currentTime = 0;
          audioManager.release(audio);
          // 觸發自定義事件通知對應的組件停止播放
          audio.dispatchEvent(new CustomEvent('forceStopPreview'));
        }
      });
    } catch (error) {
      console.warn('停止其他預覽失敗:', error);
    }
  };

  const handlePlayButtonClick = (e) => {
    e.preventDefault(); // 阻止默認行為
    e.stopPropagation(); // 阻止冒泡，避免觸發 handleClick
    
    // 如果當前正在播放，則停止
    if (isPlaying) {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
        audioManager.release(audio);
      }
      setIsPlaying(false);
      setPlayStartTime(null);
      playEndTime.current = null;
      hasInitializedRef.current = false;
      
      // 恢復播放器（如果之前有播放）
      if (wasPlayerPlayingRef.current && player?.play) {
        player.play();
        wasPlayerPlayingRef.current = false;
      }
      return;
    }
    
    // 停止所有其他預覽
    stopAllOtherPreviews();
    
    // 手機版和桌面版都支持預覽
    // AudioManager 會自動處理單一音源
    setIsPlaying(true);
  };

  const handleClick = () => {
    // 點擊卡片時：停止當前預覽並打開 Modal
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audioManager.release(audio);
    }
    setIsPlaying(false);
    setPlayStartTime(null);
    playEndTime.current = null;
    hasInitializedRef.current = false;
    
    // 恢復播放器（如果之前有播放）
    if (wasPlayerPlayingRef.current && player?.play) {
      player.play();
      wasPlayerPlayingRef.current = false;
    }
    
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
        preload="metadata"
      />

      {/* 播放按鈕覆蓋層（在中間區域，z-index 高於符號） */}
      {/* 手機版：始終顯示播放/暫停按鈕；桌面版：懸停預聽時隱藏按鈕 */}
      {(!isPlaying || isMobile) && (
        <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
          <button
            onClick={handlePlayButtonClick}
            onTouchStart={(e) => {
              e.stopPropagation();
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
            }}
            className={`bg-black bg-opacity-60 hover:bg-opacity-80 rounded-full p-4 transition-all duration-300 pointer-events-auto ${
              isHovered ? "bg-opacity-40 scale-110" : "bg-opacity-60 scale-100"
            }`}
          >
            {isPlaying ? (
              <svg
                className="w-8 h-8 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg
                className="w-8 h-8 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
        </div>
      )}

      {/* 預覽指示器 */}
      {isPlaying && (
        <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg z-30">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          播放中
        </div>
      )}

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
