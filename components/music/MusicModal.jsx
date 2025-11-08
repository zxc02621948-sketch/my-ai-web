"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Heart } from "lucide-react";
import DesktopMusicRightPane from "./DesktopMusicRightPane";
import MobileMusicSheet from "./MobileMusicSheet";
import { usePlayer } from "@/components/context/PlayerContext";
import { audioManager } from "@/utils/audioManager";
import { usePortalContainer } from "@/components/common/usePortal";

const MusicModal = ({
  music,
  onClose,
  currentUser,
  displayMode = "gallery",
  isFollowing,
  onFollowToggle,
  onUserClick,
  onDelete,
  canEdit = false,
  onEdit,
  isLiked,
  onToggleLike,
}) => {
  const modalRef = useRef(null);
  const audioRef = useRef(null);
  const [isLikedLocal, setIsLikedLocal] = useState(isLiked);
  const [likeCount, setLikeCount] = useState(music?.likes?.length || 0);
  const viewedRef = useRef(new Set());
  const progressCheckIntervalRef = useRef(null);
  const lastCurrentTimeRef = useRef(0); // 存儲最後一次更新的 currentTime
  const totalPlayedDurationRef = useRef(0); // 累計實際播放時長（處理跳播）
  const lastPlayTimeRef = useRef(0); // 上次檢查時的 currentTime（用於檢測跳播）
  const isPlayingRef = useRef(false); // 當前是否在播放
  const [isMobile, setIsMobile] = useState(false);
  const audioSrcRef = useRef(null); // 保存當前播放的音頻源，用於組件切換時保持播放
  const player = usePlayer(); // 獲取播放器 Context
  const wasPlayerPlayingRef = useRef(false); // 記錄打開音樂時播放器是否在播放
  const currentMusicIdRef = useRef(null); // 追蹤當前音樂 ID，用於判斷是否應該釋放
  const portalContainer = usePortalContainer();

  // ✅ 優化：封裝 dataset 操作，減少重複代碼
  const savePlayProgress = React.useCallback((totalPlayed, lastTime) => {
    if (audioRef.current) {
      audioRef.current.dataset.totalPlayedDuration = totalPlayed.toString();
      audioRef.current.dataset.lastPlayTime = lastTime.toString();
    }
  }, []);

  const loadPlayProgress = React.useCallback(() => {
    if (!audioRef.current) return { totalPlayed: 0, lastTime: 0 };
    const audio = audioRef.current;
    return {
      totalPlayed: parseFloat(audio.dataset.totalPlayedDuration || "0"),
      lastTime: parseFloat(audio.dataset.lastPlayTime || "0"),
    };
  }, []);

  // ✅ 優化：累計播放時長的通用函數
  const accumulatePlayDuration = React.useCallback((currentTime, lastTime) => {
    const timeDiff = currentTime - lastTime;
    // 正常播放（時間差在合理範圍內且為正數）
    if (timeDiff > 0 && timeDiff < 60) {
      totalPlayedDurationRef.current += timeDiff;
      lastPlayTimeRef.current = currentTime;
      return true; // 成功累計
    }
    // 時間倒退或跳播（跳過不累計，只更新位置）
    if (timeDiff !== 0) {
      lastPlayTimeRef.current = currentTime;
    }
    return false; // 未累計
  }, []);

  // 檢查播放進度的函數（可在多個地方調用）
  const checkProgress = React.useCallback(
    (useStoredTime = false) => {
      if (!audioRef.current || !music?._id) return;

      const audio = audioRef.current;
      // 如果 useStoredTime 為 true，使用存儲的 currentTime（用於關閉時檢查）
      const currentTime = useStoredTime
        ? lastCurrentTimeRef.current
        : audio.currentTime;
      const duration = audio.duration;

      // 更新存儲的 currentTime
      if (!useStoredTime && currentTime > 0) {
        lastCurrentTimeRef.current = currentTime;
      }

      if (duration > 0) {
        // 使用累計播放時長（處理跳播情況）
        const playedDuration = totalPlayedDurationRef.current;
        const playedPercent = (playedDuration / duration) * 100;

        // 如果實際播放時長達到總時長的 10% 以上，就計數
        if (playedPercent >= 10 && !audio.dataset.progressReported) {
          audio.dataset.progressReported = "true";
          const startTime = parseFloat(audio.dataset.startTime || "0");
          // 調用進度追蹤 API
          fetch(`/api/music/${music._id}/track-progress`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              progress: currentTime,
              duration: duration,
              startTime: startTime,
              playedDuration: playedDuration,
            }),
          }).catch((err) => {
            console.error("❌ 計數失敗:", err);
          });
        }
      }
    },
    [music?._id],
  );

  // 🔧 修復：檢測是否為行動裝置，在視窗大小改變時切換佈局
  useEffect(() => {
    const checkMobile = () => {
      const newIsMobile = window.innerWidth <= 768;
      
      // 使用函數式更新，避免依賴 isMobile
      setIsMobile((prevIsMobile) => {
        // 如果切換了佈局（手機 ↔ 桌面），保存當前播放狀態
        if (newIsMobile !== prevIsMobile && audioRef.current) {
          const audio = audioRef.current;
          audioSrcRef.current = {
            currentTime: audio.currentTime,
            paused: audio.paused,
            volume: audio.volume,
          };
        }
        return newIsMobile;
      });
    };
    
    // 初始化
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []); // 移除 isMobile 依賴，使用函數式更新

  useEffect(() => {
    setIsLikedLocal(isLiked);
  }, [isLiked]);

  useEffect(() => {
    setLikeCount(music?.likes?.length || 0);
  }, [music?.likes]);

  // ✅ 記錄點擊（每次打開音樂時調用一次）
  useEffect(() => {
    const musicId = music?._id;
    if (!musicId) return;

    // 避免同一個音樂在同一次開啟中被重複計分
    if (viewedRef.current.has(musicId)) return;
    viewedRef.current.add(musicId);

    fetch(`/api/music/${musicId}/click`, { method: "POST" })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => {});
  }, [music?._id]);

  // ✅ 關鍵修復：當音樂 ID 改變時（打開新音樂或重新打開），重置進度報告標記和自動播放標記
  useEffect(() => {
    if (audioRef.current && music?._id) {
      audioRef.current.dataset.progressReported = "";
      // ✅ 修復：重置自動播放標記，確保新音樂可以自動播放
      audioRef.current.dataset.autoPlayAttempted = "";
    }
  }, [music?._id]);

  // ✅ 使用 AudioManager：當 Modal 打開時，請求播放權限（優先度 3）
  useEffect(() => {
    if (!music?._id) return;
    
    const musicId = music._id.substring(0, 8) || 'unknown';
    console.log("🎵 [MusicModal] 打開音樂 Modal, music._id:", music._id);
    
    // ✅ 從 PlayerContext 獲取播放器在被打斷前的狀態（由播放器自己記錄，不受預覽等影響）
    const wasPlaying = player?.wasPlayingBeforeInterruption || false;
    wasPlayerPlayingRef.current = wasPlaying;
    console.log(`🎵 [Modal] 從播放器獲取打斷前狀態 [${musicId}]: ${wasPlaying}`);
    
    // 更新當前音樂 ID
    const previousMusicId = currentMusicIdRef.current;
    
    currentMusicIdRef.current = music._id;
    
    // 使用 setTimeout 確保 audioRef.current 已經設置
    const timer = setTimeout(() => {
      if (!audioRef.current) {
        console.warn("🎵 [MusicModal] audioRef.current 為 null，無法設置標記");
        return;
      }
      
      // 設置 audio 元素的標記
      audioRef.current.dataset.musicFullPlayer = "true";
      
      // 請求播放權限（優先度 3 - 最高）
      // AudioManager 會自動暫停低優先度的音頻
      audioManager.requestPlay(audioRef.current, 3);
      console.log("🎵 [MusicModal] ✅ 已請求播放權限（優先度 3）");
    }, 10);
    
    return () => {
      clearTimeout(timer);
      // 只有在音樂 ID 真正改變時才釋放（而不是因為重新渲染）
      // 如果清理函數執行時，music._id 已經改變，說明是切換音樂，不應該釋放
      // 如果清理函數執行時，music._id 仍然是當前值，說明是關閉 Modal，應該釋放
      if (currentMusicIdRef.current === previousMusicId && previousMusicId !== null) {
        // 這表示 Modal 被關閉了（音樂 ID 沒有改變，但清理函數被執行）
        // 但實際上，如果 music._id 為 null，currentMusicIdRef.current 也會被設置為 null
        // 所以這個檢查可能不夠準確
      }
    };
  }, [music?._id]); // 只依賴 music._id，避免播放器狀態改變時重新執行

  useEffect(() => {
    // 禁止背景滾動
    document.body.style.overflow = "hidden";

    // ✅ AudioManager 會自動處理暫停低優先度的音頻，不需要手動停止預覽

    // ESC 鍵關閉
    const handleEsc = (e) => {
      if (e.key === "Escape") {
        // 使用包裝的 handleClose
        releaseAudioManager();
        onClose();
      }
    };
    document.addEventListener("keydown", handleEsc);

    return () => {
      document.body.style.overflow = "unset";
      document.removeEventListener("keydown", handleEsc);

      // ✅ 注意：釋放邏輯移到 handleBackdropClick 和 onClose 中處理
      // 這裡不做釋放，因為 useEffect 的清理函數可能在音樂切換時被觸發

      // 清除定時器
      if (progressCheckIntervalRef.current) {
        clearInterval(progressCheckIntervalRef.current);
        progressCheckIntervalRef.current = null;
      }

      // 模態關閉時，最後檢查一次播放進度（防止 onTimeUpdate 未觸發）
      // 先累計最後一段播放時長，然後檢查
      if (audioRef.current && music?._id) {
        const audio = audioRef.current;

        // ✅ 優化：使用工具函數簡化邏輯
        const saved = loadPlayProgress();

        // 如果 ref 有值但 dataset 為 0（關閉 F12 時可能發生），將 ref 的值保存到 dataset
        if (totalPlayedDurationRef.current > saved.totalPlayed) {
          savePlayProgress(
            totalPlayedDurationRef.current,
            lastPlayTimeRef.current,
          );
        }

        // 如果 dataset 中有保存的值且比 ref 中的值大，使用保存的值
        const currentSaved = loadPlayProgress();
        if (currentSaved.totalPlayed > totalPlayedDurationRef.current) {
          totalPlayedDurationRef.current = currentSaved.totalPlayed;
          lastPlayTimeRef.current = currentSaved.lastTime;
        }

        const currentTime = audio.currentTime || currentSaved.lastTime;
        const lastTime = lastPlayTimeRef.current || currentSaved.lastTime;

        // 如果還在播放且時間差正常，累計最後一段播放時長
        if (
          isPlayingRef.current &&
          audio.currentTime > 0 &&
          accumulatePlayDuration(currentTime, lastTime)
        ) {
          savePlayProgress(
            totalPlayedDurationRef.current,
            lastPlayTimeRef.current,
          );
        } else if (audio.currentTime === 0 && currentSaved.totalPlayed > 0) {
          // 如果 currentTime 是 0，但 dataset 中有保存的累計值，使用保存的值
          totalPlayedDurationRef.current = currentSaved.totalPlayed;
        }

        // 暫停音頻以確保 currentTime 已保存
        if (!audio.paused) {
          audio.pause();
        }

        // ✅ 優化：使用工具函數獲取最終值
        const finalSaved = loadPlayProgress();
        const finalPlayedDurationToUse =
          Math.max(finalSaved.totalPlayed, totalPlayedDurationRef.current) ||
          totalPlayedDurationRef.current;

        // 使用累計播放時長進行檢查
        const duration = audio.duration;
        if (duration > 0 && finalPlayedDurationToUse > 0) {
          const playedDuration = finalPlayedDurationToUse;
          const playedPercent = (playedDuration / duration) * 100;
          const startTime = parseFloat(
            audio.dataset.originalStartTime || audio.dataset.startTime || "0",
          );

          // 如果實際播放時長達到總時長的 10% 以上，就計數
          if (playedPercent >= 10 && !audio.dataset.progressReported) {
            audio.dataset.progressReported = "true";
            // 調用進度追蹤 API
            fetch(`/api/music/${music._id}/track-progress`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                progress: currentTime,
                duration: duration,
                startTime: startTime,
                playedDuration: playedDuration,
              }),
            }).catch((err) => {
              console.error("❌ 關閉時計數失敗:", err);
            });
          }
        }
      }
    };
  }, [onClose, music?._id, checkProgress]);

  // ✅ 封裝釋放邏輯，在 Modal 關閉時調用
  const releaseAudioManager = () => {
    const musicId = music?._id?.substring(0, 8) || 'unknown';
    
    // 釋放 AudioManager
    if (audioRef.current) {
      audioManager.release(audioRef.current);
    }
    audioManager.release(); // 強制釋放
    
    const shouldRestorePlayer = wasPlayerPlayingRef.current;
    console.log(`🎵 [Modal] 關閉 Modal [${musicId}], wasPlaying: ${wasPlayerPlayingRef.current}, shouldRestore: ${shouldRestorePlayer}`);
    
    if (shouldRestorePlayer && player?.play) {
      console.log(`🎵 [Modal] 設置恢復 timer（100ms）- 使用全局 timer`);
      
      // ✅ 使用全局 timer，不保存到 ref，即使組件卸載也會執行
      window.setTimeout(() => {
        console.log(`🎵 [Modal] ⏰ 恢復 timer 執行`);
        
        // ✅ 檢查 AudioManager 當前優先度，避免在高優先度音頻播放時恢復
        const currentPriority = window.audioManager?.priority || 0;
        console.log(`🎵 [Modal] 檢查優先度: ${currentPriority}`);
        
        if (currentPriority > 1) {
          console.log(`🎵 [Modal] ❌ 當前優先度 ${currentPriority} > 1，不恢復`);
          return;
        }
        
        // 檢查播放器狀態
        console.log(`🎵 [Modal] 播放器狀態:`, {
          hasSrc: !!player?.src,
          hasOriginUrl: !!player?.originUrl,
          hasPlay: !!player?.play,
          src: player?.src?.substring(0, 50),
          originUrl: player?.originUrl?.substring(0, 50)
        });
        
        // 確認播放器有音樂源才恢復
        if (player?.src || player?.originUrl) {
          console.log(`🎵 [Modal] ✅ 調用 player.play()`);
          player.play();
        } else {
          console.log(`🎵 [Modal] ❌ 播放器無音樂源，不恢復`);
        }
      }, 100);
    } else {
      console.log(`🎵 [Modal] 不需要恢復`);
    }
    
    // 重置當前音樂 ID
    currentMusicIdRef.current = null;
  };
  
  // ✅ 包裝 onClose，確保在關閉前釋放 AudioManager
  const handleClose = () => {
    releaseAudioManager();
    onClose();
  };
  
  // 點擊背景關閉
  const handleBackdropClick = (e) => {
    if (e.target === modalRef.current) {
      handleClose();
    }
  };

  // 處理愛心點擊
  const handleLikeClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!currentUser) {
      return;
    }

    // ✅ 保存音頻狀態，用於恢復播放
    const audio = audioRef.current;
    const wasPlaying = audio && !audio.paused;
    const currentTime = audio?.currentTime || 0;

    // 樂觀更新
    const newLiked = !isLikedLocal;
    setIsLikedLocal(newLiked);
    setLikeCount(newLiked ? likeCount + 1 : Math.max(0, likeCount - 1));

    // ✅ 立即檢查一次（可能在異步操作前就被暫停）
    const restorePlayback = () => {
      if (audio && wasPlaying && audio.paused) {
        audio.currentTime = currentTime;
        audio.play().catch((err) => {
          if (err.name !== "NotAllowedError") {
            console.warn("愛心點擊後恢復播放失敗:", err);
          }
        });
      }
    };

    // 立即檢查一次
    setTimeout(restorePlayback, 0);

    // 呼叫外部回調
    if (onToggleLike && music._id) {
      await onToggleLike(music._id);
    }

    // ✅ 異步操作後再次檢查（確保恢復播放）
    setTimeout(restorePlayback, 10);
  };

  if (!portalContainer) {
    return null;
  }

  return createPortal(
    <div
      ref={modalRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[1200] flex items-center justify-center py-8 px-4 overflow-y-auto"
      style={{
        paddingTop: 'max(env(safe-area-inset-top), 80px)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 80px)',
      }}
    >
      <div 
        className="relative w-full max-w-5xl bg-[#1a1a1a] rounded-lg shadow-2xl overflow-hidden flex flex-col"
        style={{
          maxHeight: 'calc(100vh - 160px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 手機版：使用 MobileMusicSheet - 使用條件渲染而非 CSS 隱藏 */}
        {isMobile ? (
          <div className="overflow-y-auto snap-y snap-mandatory" style={{ 
            height: 'calc(100vh - 160px)',
            maxHeight: 'calc(100vh - 160px)',
            WebkitOverflowScrolling: 'touch'
          }}>
            <MobileMusicSheet
            music={music}
            audioRef={audioRef}
            isMobile={isMobile}
            currentUser={currentUser}
            displayMode={displayMode}
            isFollowing={isFollowing}
            onFollowToggle={onFollowToggle}
            onUserClick={onUserClick}
            onClose={handleClose}
            onDelete={onDelete}
            canEdit={canEdit}
            onEdit={onEdit}
            isLiked={isLiked}
            onToggleLike={onToggleLike}
            likeCount={likeCount}
            isLikedLocal={isLikedLocal}
            setIsLikedLocal={setIsLikedLocal}
            setLikeCount={setLikeCount}
            handleLikeClick={handleLikeClick}
            onAudioError={(e) => {
              console.error("音樂載入錯誤:", e);
            }}
            onAudioCanPlay={() => {
              console.log("🎵 [MusicModal Mobile] onAudioCanPlay 觸發");
              
              if (!audioRef.current) return;
              
              // ✅ 設置標記
              audioRef.current.dataset.musicFullPlayer = "true";
              
              // ✅ 請求播放權限（優先度 3 - 最高）
              // AudioManager 會自動暫停低優先度的音頻
              audioManager.requestPlay(audioRef.current, 3);
              
              // 設定音量
              try {
                const saved = localStorage.getItem("playerVolume");
                if (saved) {
                  const vol = parseFloat(saved);
                  if (!isNaN(vol) && vol >= 0 && vol <= 1) {
                    audioRef.current.volume = vol;
                  }
                }
              } catch (e) {
                console.warn("設定音量失敗:", e);
              }

              // 🔧 修復：如果組件切換時有保存的播放狀態，先恢復它
              if (audioSrcRef.current) {
                const savedState = audioSrcRef.current;
                audioRef.current.currentTime = savedState.currentTime;
                audioRef.current.volume = savedState.volume || audioRef.current.volume;
                
                // 如果之前是播放狀態，繼續播放
                if (!savedState.paused) {
                  audioRef.current.play().then(() => {
                    isPlayingRef.current = true;
                  }).catch((err) => {
                    if (err.name !== "NotAllowedError") {
                      console.warn("恢復播放失敗:", err);
                    }
                  });
                }
                
                // 清除保存的狀態
                audioSrcRef.current = null;
                return; // 已經恢復了狀態，不再執行自動播放
              }

              // ✅ 檢查是否需要自動播放
              if (audioRef.current.paused && !audioRef.current.dataset.autoPlayAttempted) {
                audioRef.current.dataset.autoPlayAttempted = "true";
                console.log("🎵 [MusicModal Mobile] 嘗試自動播放音樂");
                audioRef.current.play().then(() => {
                  isPlayingRef.current = true;
                  console.log("🎵 [MusicModal Mobile] ✅ 音樂播放成功");
                }).catch((err) => {
                  console.warn("🎵 [MusicModal Mobile] ❌ 自動播放失敗:", err);
                  if (err.name !== "NotAllowedError") {
                    console.warn("自動播放失敗:", err);
                  }
                });
              }
            }}
            onAudioVolumeChange={(e) => {
              // 同步音量改變並保存到 localStorage
              if (audioRef.current) {
                try {
                  localStorage.setItem(
                    "playerVolume",
                    audioRef.current.volume.toString(),
                  );
                } catch (e) {
                  console.warn("保存音量失敗:", e);
                }
              }
            }}
            onAudioPlay={() => {
              console.log("🎵 [MusicModal Mobile] onAudioPlay 觸發 - 音樂開始播放");
              // 記錄播放開始時的狀態（用於計數）
              if (audioRef.current) {
                const audio = audioRef.current;
                const startTime = audio.currentTime;
                const duration = audio.duration;

                // ✅ 關鍵：判斷是否為第一次播放
                // 如果 dataset.startTime 不存在或為空，就是第一次播放
                const hasStartTime =
                  audio.dataset.startTime && audio.dataset.startTime !== "";

                const firstPlay = !hasStartTime;

                if (firstPlay) {
                  // 第一次播放，重置累計播放時長和計數標記
                  totalPlayedDurationRef.current = 0;
                  audio.dataset.startTime = startTime.toString();
                  savePlayProgress(0, startTime);
                  // ✅ 重置計數標記，允許重新計數
                  audio.dataset.progressReported = "";
                } else {
                  // 不是第一次播放，從 dataset 恢復累計值
                  // 這樣可以處理暫停後繼續播放、重新載入等情況
                  const saved = loadPlayProgress();
                  totalPlayedDurationRef.current = saved.totalPlayed;
                }

                // 記錄開始播放時的位置（用於 API）
                if (!audio.dataset.originalStartTime) {
                  audio.dataset.originalStartTime = startTime.toString();
                }

                // 記錄當前播放位置（用於檢測跳播）
                lastPlayTimeRef.current = startTime;
                isPlayingRef.current = true;

                // 清除定時器（如果存在）
                if (progressCheckIntervalRef.current) {
                  clearInterval(progressCheckIntervalRef.current);
                }

                // ✅ 優化：使用定時器，每2秒檢查一次進度（防止 onTimeUpdate 被節流）
                progressCheckIntervalRef.current = setInterval(() => {
                  // 在定時器中累計播放時長
                  if (audioRef.current && isPlayingRef.current) {
                    const audio = audioRef.current;
                    const currentTime = audio.currentTime;
                    const lastTime = lastPlayTimeRef.current;

                    // 使用重用累計函數
                    accumulatePlayDuration(currentTime, lastTime);

                    // ✅ 關鍵：無論是否累計或位置改變，都保存當前累計值到 dataset
                    // 這樣即使 F12 導致 onTimeUpdate 被節流，累計值也不會丟失
                    savePlayProgress(
                      totalPlayedDurationRef.current,
                      currentTime,
                    );
                  }
                  checkProgress();
                }, 2000);
              }
            }}
            onAudioPause={() => {
              console.log("🎵 [MusicModal Mobile] onAudioPause 觸發 - 音樂被暫停", {
                currentTime: audioRef.current?.currentTime,
                paused: audioRef.current?.paused,
                src: audioRef.current?.src?.substring(0, 50),
                hasMusicFullPlayerTag: audioRef.current?.dataset.musicFullPlayer === "true"
              });
              
              // ⚠️ 關鍵：檢查是否被意外暫停（不應該被暫停的情況）
              const isUnexpectedPause = audioRef.current && 
                  audioRef.current.dataset.musicFullPlayer === "true" && 
                  audioRef.current.paused === true && // 確認確實被暫停了
                  isPlayingRef.current; // 在設置為 false 之前檢查
              
              // 記錄詳細的暫停信息，用於調試
              const stackTrace = new Error().stack;
              console.log("🎵 [MusicModal Mobile] onPause 觸發", {
                currentTime: audioRef.current?.currentTime,
                paused: audioRef.current?.paused,
                hasMusicFullPlayerTag: audioRef.current?.dataset.musicFullPlayer === "true",
                isPlayingRef: isPlayingRef.current,
                isUnexpectedPause: isUnexpectedPause,
                stackTrace: stackTrace?.split('\n').slice(0, 10).join('\n')
              });
              
              // ⚠️ 如果被意外暫停，記錄錯誤但不自動恢復（需要找出根本原因）
              if (isUnexpectedPause) {
                console.error("🎵 [MusicModal Mobile] ❌ 音樂 Modal 被意外暫停！這是一個 BUG，需要修復。", {
                  audioElement: audioRef.current,
                  allAudioElements: Array.from(document.querySelectorAll('audio')).map(a => ({
                    src: a.src?.substring(0, 50),
                    paused: a.paused,
                    hasMusicFullPlayerTag: a.dataset.musicFullPlayer === "true",
                    hasMusicPreviewTag: a.dataset.musicPreview === "true"
                  }))
                });
              }
              
              // ✅ 優化：暫停時累計播放時長
              if (audioRef.current && isPlayingRef.current) {
                const audio = audioRef.current;
                const currentTime = audio.currentTime;
                const lastTime = lastPlayTimeRef.current;

                // 從 dataset 恢復累計值（確保使用最新值）
                const saved = loadPlayProgress();
                if (saved.totalPlayed > totalPlayedDurationRef.current) {
                  totalPlayedDurationRef.current = saved.totalPlayed;
                }

                // 累計這段播放時長（處理跳播）
                accumulatePlayDuration(currentTime, lastTime);
                isPlayingRef.current = false;

                // 立即保存累計值到 dataset
                savePlayProgress(
                  totalPlayedDurationRef.current,
                  currentTime,
                );
              }

              // 清除定時器
              if (progressCheckIntervalRef.current) {
                clearInterval(progressCheckIntervalRef.current);
                progressCheckIntervalRef.current = null;
              }
              // 最後檢查一次進度（防止開發者控制台的 onTimeUpdate 不觸發）
              checkProgress();
            }}
            onAudioSeeked={() => {
              // ✅ 優化：跳播時，確保累計跳播前最後一段播放時長
              if (audioRef.current) {
                const audio = audioRef.current;
                const currentTime = audio.currentTime;

                // ✅ 修復：如果是跳播前的播放狀態，確保跳播後恢復播放
                const wasPlaying = isPlayingRef.current;

                // 從 dataset 恢復累計值和上次位置（確保使用最新值）
                const saved = loadPlayProgress();
                if (saved.totalPlayed > totalPlayedDurationRef.current) {
                  totalPlayedDurationRef.current = saved.totalPlayed;
                }

                // 在跳播時，確保跳播前最後一段播放時長被累計
                // 如果從 dataset 位置到 ref 位置是正常播放時間差，累計這段
                const refLastTime = lastPlayTimeRef.current;
                const diffFromSaved = refLastTime - saved.lastTime;

                // 如果時間差在正常播放範圍內（0-3秒），且正在播放，累計這段
                if (
                  wasPlaying &&
                  diffFromSaved > 0 &&
                  diffFromSaved < 3 &&
                  saved.lastTime > 0
                ) {
                  totalPlayedDurationRef.current += diffFromSaved;
                }

                // 更新 lastPlayTimeRef 到新位置，並保存進度
                lastPlayTimeRef.current = currentTime;
                savePlayProgress(
                  totalPlayedDurationRef.current,
                  currentTime,
                );

                // ✅ 修復：如果跳播前正在播放，跳播後繼續播放
                // 這樣可以防止跳播後意外暫停
                if (wasPlaying && audio.paused) {
                  audio.play().catch((err) => {
                    // 播放失敗可能是因為需要用戶交互，不是錯誤
                    if (err.name !== "NotAllowedError") {
                      console.warn("跳播後恢復播放失敗:", err);
                    }
                    // 如果播放失敗，更新狀態
                    isPlayingRef.current = false;
                  });
                }
              }
            }}
            onAudioEnded={() => {
              // ✅ 優化：播放結束時累計最後一段播放時長
              if (audioRef.current && isPlayingRef.current) {
                const audio = audioRef.current;
                const currentTime = audio.currentTime;
                const lastTime = lastPlayTimeRef.current;

                // 累計最後一段播放時長
                accumulatePlayDuration(currentTime, lastTime);
                isPlayingRef.current = false;

                // 保存到 dataset
                savePlayProgress(
                  totalPlayedDurationRef.current,
                  currentTime,
                );
              }

              // 清除定時器
              if (progressCheckIntervalRef.current) {
                clearInterval(progressCheckIntervalRef.current);
                progressCheckIntervalRef.current = null;
              }
              checkProgress();
            }}
            onAudioTimeUpdate={() => {
              // ✅ 優化：在播放過程中持續累計播放時長
              if (audioRef.current && isPlayingRef.current) {
                const audio = audioRef.current;
                const currentTime = audio.currentTime;
                const lastTime = lastPlayTimeRef.current;

                // 使用重用累計函數
                const accumulated = accumulatePlayDuration(
                  currentTime,
                  lastTime,
                );
                // 如果成功累計或位置改變，保存進度
                if (accumulated || currentTime !== lastTime) {
                  savePlayProgress(
                    totalPlayedDurationRef.current,
                    lastPlayTimeRef.current,
                  );
                }
              }

              // 追蹤播放進度（主要檢查方式）
              checkProgress();
            }}
          />
          </div>
        ) : (
          /* 桌面版：保持原有佈局 */
          <div className="flex flex-row flex-1 overflow-y-auto">
          {/* 左側：音樂播放器 */}
          <div className="flex-1 relative bg-black flex items-center justify-center p-4 md:p-6 min-h-0 overflow-y-auto">
            {/* 音樂封面與播放器 */}
            <div className="relative w-full max-w-md max-h-full">
              {/* 封面（內含播放器） */}
              <div 
                className={`aspect-square rounded-lg overflow-hidden shadow-2xl max-w-md mx-auto relative ${
                  music.coverImageUrl 
                    ? "" 
                    : "bg-gradient-to-br from-purple-600 via-pink-600 to-blue-600"
                }`}
                style={
                  music.coverImageUrl
                    ? {
                        backgroundImage: `url(${music.coverImageUrl})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        backgroundRepeat: "no-repeat",
                      }
                    : {}
                }
              >
                <div className="w-full h-full flex items-center justify-center">
                  {music.coverImageUrl ? null : (
                    <div className="text-white text-8xl opacity-60">🎵</div>
                  )}
                </div>
                
                {/* 播放器（疊加在封面底部） */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent pb-2 pt-6">
                  <audio
                ref={audioRef}
                src={music.musicUrl}
                controls
                controlsList="nodownload nofullscreen noplaybackrate"
                autoPlay
                data-music-full-player="true"
                className="w-full px-2"
                onError={(e) => {
                  console.error("音樂載入失敗:", e);
                }}
                onCanPlay={() => {
                  console.log("🎵 [MusicModal Desktop] onCanPlay 觸發");
                  
                  if (!audioRef.current) return;
                  
                  // ✅ 設置標記
                  audioRef.current.dataset.musicFullPlayer = "true";
                  
                  // ✅ 請求播放權限（優先度 3 - 最高）
                  // AudioManager 會自動暫停低優先度的音頻
                  audioManager.requestPlay(audioRef.current, 3);
                  
                  // 設定音量
                  try {
                    const saved = localStorage.getItem("playerVolume");
                    if (saved) {
                      const vol = parseFloat(saved);
                      if (!isNaN(vol) && vol >= 0 && vol <= 1) {
                        audioRef.current.volume = vol;
                      }
                    }
                  } catch (e) {
                    console.warn("設定音量失敗:", e);
                  }

                  // 🔧 修復：如果組件切換時有保存的播放狀態，先恢復它
                  if (audioSrcRef.current) {
                    const savedState = audioSrcRef.current;
                    audioRef.current.currentTime = savedState.currentTime;
                    audioRef.current.volume = savedState.volume || audioRef.current.volume;
                    
                    // 如果之前是播放狀態，繼續播放
                    if (!savedState.paused) {
                      audioRef.current.play().then(() => {
                        isPlayingRef.current = true;
                      }).catch((err) => {
                        if (err.name !== "NotAllowedError") {
                          console.warn("恢復播放失敗:", err);
                        }
                      });
                    }
                    
                    // 清除保存的狀態
                    audioSrcRef.current = null;
                    return; // 已經恢復了狀態，不再執行自動播放
                  }

                  // ✅ 確保自動播放（處理瀏覽器自動播放策略）
                  if (audioRef.current.paused && !audioRef.current.dataset.autoPlayAttempted) {
                    audioRef.current.dataset.autoPlayAttempted = "true";
                    console.log("🎵 [MusicModal Desktop] 嘗試自動播放音樂");
                    audioRef.current.play().then(() => {
                      isPlayingRef.current = true;
                      console.log("🎵 [MusicModal Desktop] ✅ 音樂播放成功");
                    }).catch((err) => {
                      // 自動播放被阻止是正常的（需要用戶交互），不記錄錯誤
                      console.warn("🎵 [MusicModal Desktop] ❌ 自動播放失敗:", err);
                      if (err.name !== "NotAllowedError") {
                        console.warn("自動播放失敗:", err);
                      }
                    });
                  }
                }}
                onVolumeChange={(e) => {
                  // 當用戶調整音量時同步到 localStorage
                  if (audioRef.current) {
                    try {
                      localStorage.setItem(
                        "playerVolume",
                        audioRef.current.volume.toString(),
                      );
                    } catch (e) {
                      console.warn("儲存音量失敗:", e);
                    }
                  }
                }}
                onPlay={() => {
                  console.log("🎵 [MusicModal Desktop] onPlay 觸發 - 音樂開始播放");
                  // 記錄播放開始時的絕對位置（秒）
                  if (audioRef.current) {
                    const audio = audioRef.current;
                    const startTime = audio.currentTime;
                    const duration = audio.duration;

                    // ✅ 關鍵修復：判斷是否為真正的第一次播放
                    // 如果 dataset.startTime 不存在或為空，才是第一次播放
                    const hasStartTime =
                      audio.dataset.startTime && audio.dataset.startTime !== "";

                    const firstPlay = !hasStartTime;

                    if (firstPlay) {
                      // 真正的第一次播放，重置累計播放時長和進度報告標記
                      totalPlayedDurationRef.current = 0;
                      audio.dataset.startTime = startTime.toString();
                      savePlayProgress(0, startTime);
                      // ✅ 重置進度報告標記，允許重新計數
                      audio.dataset.progressReported = "";
                    } else {
                      // 不是第一次播放，從 dataset 恢復累計值
                      // 這包括：跳播後重新播放、暫停後繼續播放等情況
                      const saved = loadPlayProgress();
                      totalPlayedDurationRef.current = saved.totalPlayed;
                    }

                    // 記錄開始播放時的絕對時間位置（用於 API）
                    if (!audio.dataset.originalStartTime) {
                      audio.dataset.originalStartTime = startTime.toString();
                    }

                    // 記錄當前播放位置（用於檢測跳播）
                    lastPlayTimeRef.current = startTime;
                    isPlayingRef.current = true;

                    // 清除舊的定時器（如果有）
                    if (progressCheckIntervalRef.current) {
                      clearInterval(progressCheckIntervalRef.current);
                    }

                    // ✅ 優化：啟動定時器，每2秒檢查一次進度（作為 onTimeUpdate 的備用）
                    progressCheckIntervalRef.current = setInterval(() => {
                      // 在定時器中也累計播放時長
                      if (audioRef.current && isPlayingRef.current) {
                        const audio = audioRef.current;
                        const currentTime = audio.currentTime;
                        const lastTime = lastPlayTimeRef.current;

                        // 使用通用累計函數
                        accumulatePlayDuration(currentTime, lastTime);

                        // ✅ 關鍵：無論是否有新的累計，都保存當前累計值到 dataset
                        // 這樣即使關閉 F12 導致 onTimeUpdate 被節流，累計值也不會丟失
                        savePlayProgress(
                          totalPlayedDurationRef.current,
                          currentTime,
                        );
                      }
                      checkProgress();
                    }, 2000);
                  }
                }}
                onPause={() => {
                  // ✅ 優化：暫停時累計播放時長
                  if (audioRef.current && isPlayingRef.current) {
                    const audio = audioRef.current;
                    const currentTime = audio.currentTime;
                    const lastTime = lastPlayTimeRef.current;

                    // 先從 dataset 恢復累計值（確保使用最新值）
                    const saved = loadPlayProgress();
                    if (saved.totalPlayed > totalPlayedDurationRef.current) {
                      totalPlayedDurationRef.current = saved.totalPlayed;
                    }

                    // 累計這段播放時長（如果沒有跳播）
                    accumulatePlayDuration(currentTime, lastTime);
                    isPlayingRef.current = false;

                    // 立即保存累計值到 dataset
                    savePlayProgress(
                      totalPlayedDurationRef.current,
                      currentTime,
                    );
                  } else {
                    // 如果沒有在播放，也更新狀態
                    if (audioRef.current) {
                      isPlayingRef.current = false;
                    }
                  }
                  
                  // 清除定時器
                  if (progressCheckIntervalRef.current) {
                    clearInterval(progressCheckIntervalRef.current);
                    progressCheckIntervalRef.current = null;
                  }
                  // 暫停時檢查一次進度（防止關閉控制台時 onTimeUpdate 不觸發）
                  checkProgress();
                }}
                onSeeked={() => {
                  // ✅ 優化：跳播時，確保累計跳播前的最後一段播放時長
                  if (audioRef.current) {
                    const audio = audioRef.current;
                    const currentTime = audio.currentTime;

                    // ✅ 修復：記錄跳播前的播放狀態，確保跳播後恢復播放
                    const wasPlaying = isPlayingRef.current;

                    // 先從 dataset 恢復累計值和上次位置（確保使用最新值）
                    const saved = loadPlayProgress();
                    if (saved.totalPlayed > totalPlayedDurationRef.current) {
                      totalPlayedDurationRef.current = saved.totalPlayed;
                    }

                    // 在跳播時，確保跳播前的最後一段播放時長被累計
                    // 如果從 dataset 位置到 ref 位置有正常播放的差距，累計這段
                    const refLastTime = lastPlayTimeRef.current;
                    const diffFromSaved = refLastTime - saved.lastTime;

                    // 如果差距在正常播放範圍內（0-3秒），且是在播放狀態，累計這段
                    if (
                      wasPlaying &&
                      diffFromSaved > 0 &&
                      diffFromSaved < 3 &&
                      saved.lastTime > 0
                    ) {
                      totalPlayedDurationRef.current += diffFromSaved;
                    }

                    // 更新 lastPlayTimeRef 到新位置，並保存進度
                    lastPlayTimeRef.current = currentTime;
                    savePlayProgress(
                      totalPlayedDurationRef.current,
                      currentTime,
                    );

                    // ✅ 修復：如果跳播前是在播放狀態，跳播後繼續播放
                    // 這樣可以防止跳播後意外暫停
                    if (wasPlaying && audio.paused) {
                      audio.play().catch((err) => {
                        // 播放失敗可能是因為用戶交互要求，不記錄錯誤
                        if (err.name !== "NotAllowedError") {
                          console.warn("跳播後恢復播放失敗:", err);
                        }
                        // 如果播放失敗，更新狀態
                        isPlayingRef.current = false;
                      });
                    }
                  }
                }}
                onEnded={() => {
                  // ✅ 優化：播放結束時累計最後一段播放時長
                  if (audioRef.current && isPlayingRef.current) {
                    const audio = audioRef.current;
                    const currentTime = audio.currentTime;
                    const lastTime = lastPlayTimeRef.current;

                    // 累計最後一段播放時長
                    accumulatePlayDuration(currentTime, lastTime);
                    isPlayingRef.current = false;

                    // 保存到 dataset
                    savePlayProgress(
                      totalPlayedDurationRef.current,
                      currentTime,
                    );
                  }

                  // 清除定時器
                  if (progressCheckIntervalRef.current) {
                    clearInterval(progressCheckIntervalRef.current);
                    progressCheckIntervalRef.current = null;
                  }
                  checkProgress();
                }}
                onTimeUpdate={() => {
                  // ✅ 優化：在播放過程中持續累計播放時長
                  if (audioRef.current && isPlayingRef.current) {
                    const audio = audioRef.current;
                    const currentTime = audio.currentTime;
                    const lastTime = lastPlayTimeRef.current;

                    // 使用通用累計函數
                    const accumulated = accumulatePlayDuration(
                      currentTime,
                      lastTime,
                    );
                    // 如果成功累計或位置改變，保存進度
                    if (accumulated || currentTime !== lastTime) {
                      savePlayProgress(
                        totalPlayedDurationRef.current,
                        lastPlayTimeRef.current,
                      );
                    }
                  }

                  // 追蹤播放進度（主要檢查方式）
                  checkProgress();
                }}
              />
                </div>

                {/* 愛心按鈕 - 右上角 */}
                {currentUser && (
                  <div
                    onClick={handleLikeClick}
                    onKeyDown={(e) => {
                      // ✅ 支援鍵盤操作（Enter/Space）
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleLikeClick(e);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    className="absolute top-6 right-6 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-full p-3 transition-all duration-200 hover:scale-110 z-50 pointer-events-auto cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/50"
                    title={isLikedLocal ? "取消愛心" : "點愛心"}
                  >
                    <Heart
                      size={24}
                      className={`transition-all duration-200 ${
                        isLikedLocal ? "text-pink-400 fill-pink-400" : "text-white"
                      }`}
                    />
                    {likeCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-pink-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                        {likeCount > 99 ? "99+" : likeCount}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 右側：音樂資訊 */}
          <DesktopMusicRightPane
            music={music}
            currentUser={currentUser}
            displayMode={displayMode}
            isFollowing={isFollowing}
            onFollowToggle={onFollowToggle}
            onUserClick={onUserClick}
            onClose={handleClose}
            onDelete={onDelete}
            canEdit={canEdit}
            onEdit={onEdit}
            isLiked={isLiked}
            onToggleLike={onToggleLike}
          />
        </div>
        )}
      </div>
    </div>,
    portalContainer,
  );
};

export default MusicModal;
