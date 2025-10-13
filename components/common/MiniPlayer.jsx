"use client";

import { usePlayer } from "@/components/context/PlayerContext";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import MiniPlayerArt from "@/components/common/MiniPlayerArt";
import PinPlayerButton from "@/components/player/PinPlayerButton";
import axios from "axios";

export default function MiniPlayer() {
  const player = usePlayer();
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState(null); // ✅ 初始為 null，等待從 localStorage 載入
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isExpanded, setIsExpanded] = useState(false);
  const [dragStartTime, setDragStartTime] = useState(0);
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const justDraggedRef = useRef(false);
  const [isVolumeSliding, setIsVolumeSliding] = useState(false);
  const [isVolumeHovering, setIsVolumeHovering] = useState(false);
  const volumeSliderRef = useRef(null);
  const volumeWrapperRef = useRef(null);
  const [theme, setTheme] = useState("modern");
  const [imgFailed] = useState(false);
  const showInteractiveVolume = true; // 啟用直式音量拉條（右下角偏上一點）
  
  // 釘選狀態管理
  const [pinnedPlayerData, setPinnedPlayerData] = useState(null);
  const [isPinned, setIsPinned] = useState(false);
  const playerRef = useRef(player); // 使用 ref 保存最新的 player 引用
  
  // 更新 playerRef
  useEffect(() => {
    playerRef.current = player;
  }, [player]);
  
  // 依照 Hooks 規則：所有 hooks 必須在每次 render 都被呼叫，
  // 因此不在條件分支中提前 return；改用條件渲染控制輸出。
  
  // 顯示邏輯：有釘選 OR (在個人頁面 AND 該用戶有播放器)
  const showMini = isPinned || !!(player && player.miniPlayerEnabled);
  
  // 確保所有值都是有效數字後才計算進度
  const currentTime = typeof player?.currentTime === 'number' && isFinite(player.currentTime) ? player.currentTime : 0;
  const duration = typeof player?.duration === 'number' && isFinite(player.duration) && player.duration > 0 ? player.duration : 0;
  
  const pct = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  
  // 顯示進度條的條件：有 duration 或有歌單（釘選播放器）
  const showProgressBar = duration > 0 || (isPinned && player?.playlist?.length > 0);
  
  // 確保進度條不會顯示 NaN 或無效值
  const safePercentage = (isNaN(pct) || !isFinite(pct)) ? 0 : pct;
  
  
  // 使用 useMemo 緩存標題計算，避免無限循環
  const displayTitle = useMemo(() => {
    const t = (player?.trackTitle || "").trim();
    const u = (player?.originUrl || player?.src || "").trim();
    
    if (t) return t;
    if (!u) return "未設定音源";
    
    // 嘗試從 YouTube URL 提取標題
    try {
      const url = new URL(u, typeof window !== "undefined" ? window.location.origin : undefined);
      if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) {
        const videoId = url.searchParams.get('v') || url.pathname.split('/').pop();
        return `YouTube: ${videoId || '未知'}`;
      }
    } catch (e) {
      // URL 解析失敗，忽略
    }
    
    return "未知音源";
  }, [player?.trackTitle, player?.originUrl, player?.src]);
  
  // 手動更新時間的定時器 - 移除會導致無限循環的依賴
  useEffect(() => {
    if (!showMini || !player?.isPlaying) return;
    
    let saveCounter = 0; // 用於控制保存頻率
    
    const interval = setInterval(() => {
      if (player?.updateCurrentTime) {
        player.updateCurrentTime();
      }
      
      // ✅ 每 5 秒保存一次播放進度（釘選播放器）
      saveCounter++;
      if (saveCounter >= 5) {
        saveCounter = 0;
        
        // 使用 ref 來獲取最新狀態，避免閉包問題
        const currentPlayer = playerRef.current;
        const currentIsPinned = isPinned;
        const currentPinnedData = pinnedPlayerData;
        
        // 續播功能已移除（YouTube API 限制）
      }
    }, 1000); // 每秒更新一次
    
    return () => clearInterval(interval);
  }, [showMini, player?.isPlaying]); // 只依賴關鍵狀態，避免重複創建 interval

  // 移除調試日誌，避免無限循環
  // useEffect(() => {
  //   // 調試日誌已移除，避免無限循環
  // }, []);
  

  useEffect(() => {
    try {
      const t = (localStorage.getItem("miniPlayerTheme") || "").trim();
      if (t) setTheme(t);
    } catch {}
  }, []);

  const palette = (() => {
    switch (theme) {
      case "dark":
        return {
          bg: "#1f2937",
          border: "#374151",
          accent1: "#60a5fa",
          accent2: "#3b82f6",
        };
      case "retro":
        return {
          bg: "#F8F1E4", // 米白（內層）
          border: "#F8F1E4", // 同色米白（外框）
          accent1: "#E67E22",
          accent2: "#D35400",
        };
      case "modern":
      default:
        return {
          bg: "#F8F1E4", // 米白（內層）
          border: "#F8F1E4", // 同色米白（外框）
          accent1: "#E67E22",
          accent2: "#D35400",
        };
    }
  })();

  const handleMouseDown = (e) => {
    e.preventDefault();
    setDragStartTime(Date.now());
    dragStartPosRef.current = { x: position.x, y: position.y };
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
    // 以 ref 紀錄 offset，避免在 mouseup 時計算距離時受非同步 state 影響
    dragOffsetRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    setIsDragging(true);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y
    });
  };

  const handleMouseUp = (e) => {
    // 結束拖曳，取消任何展開/收起切換（僅由箭頭圖示控制）
    setIsDragging(false);
    // 若有明顯拖曳距離，視為拖曳而非點擊：短暫抑制點擊切換
    try {
      // 使用當前滑鼠座標推算最後位置，避免取用可能未更新完成的 state
      const finalX = e.clientX - (dragOffsetRef.current?.x || 0);
      const finalY = e.clientY - (dragOffsetRef.current?.y || 0);
      const dx = finalX - dragStartPosRef.current.x;
      const dy = finalY - dragStartPosRef.current.y;
      const moved = Math.hypot(dx, dy);
      if (moved >= 8) {
        justDraggedRef.current = true;
        setTimeout(() => { justDraggedRef.current = false; }, 250);
      }
    } catch {}
    // 儲存目前位置，供下次載入還原
    try {
      localStorage.setItem("miniPlayerPosition", JSON.stringify(position));
    } catch {}
  };

  // 保持展開狀態（避免因重新掛載而重置）
  useEffect(() => {
    try {
      const saved = localStorage.getItem("miniPlayerExpanded");
      if (saved !== null) {
        setIsExpanded(saved === "1");
      }
    } catch {}
  }, []);

  // 預設位置：右上角；若有已儲存位置則優先使用
  useEffect(() => {
    try {
      const saved = localStorage.getItem("miniPlayerPosition");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.x === "number" && typeof parsed.y === "number") {
          setPosition(parsed);
          return;
        }
      }
    } catch {}

    if (typeof window !== "undefined") {
      const margin = 16;
      const width = 140; // 與元件寬度一致
      const x = Math.max(margin, window.innerWidth - width - margin);
      const y = margin;
      setPosition({ x, y });
    }
  }, []);

  // 處理進度條點擊
  const handleButtonClick = (e) => {
    e.stopPropagation();
    
    // 如果是進度條點擊，計算點擊位置並跳轉
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    
    if (player.duration > 0) {
      const newTime = percentage * player.duration;
      // 移除調試日誌，避免無限循環
      
      // 優先使用外部播放器控制
      if (player.externalControls && typeof player.externalControls.seekTo === 'function') {
        try {
          player.externalControls.seekTo(newTime);
          // console.log("🔧 外部播放器跳轉成功:", newTime);
        } catch (error) {
          console.error("🔧 外部播放器跳轉失敗:", error);
          // 如果外部播放器跳轉失敗，嘗試本地播放器
          if (player.seekTo) {
            try {
              player.seekTo(newTime);
              console.log("🔧 本地播放器跳轉成功:", newTime);
            } catch (localError) {
              console.error("🔧 本地播放器跳轉失敗:", localError);
            }
          }
        }
      } else if (player.seekTo) {
        try {
          player.seekTo(newTime);
          console.log("🔧 本地播放器跳轉成功:", newTime);
        } catch (error) {
          console.error("🔧 本地播放器跳轉失敗:", error);
        }
      } else {
        console.warn("🔧 沒有可用的跳轉方法");
      }
    }
  };

  // 下一首處理函數 - 直接使用 PlayerContext 的 next 方法
  const handleNext = () => {
    // 移除調試日誌，避免無限循環
    if (player.next) {
      player.next();
    }
  };

  // 上一首處理函數 - 直接使用 PlayerContext 的 previous 方法
  const handlePrevious = () => {
    // 移除調試日誌，避免無限循環
    if (player.previous) {
      player.previous();
    }
  };

  // 音量滑桿事件處理
  const handleVolumeMouseDown = (e) => {
    e.stopPropagation();
    setIsVolumeSliding(true);
    updateVolumeFromEvent(e);
  };

  const handleVolumeMouseMove = (e) => {
    if (isVolumeSliding) {
      updateVolumeFromEvent(e);
    }
  };

  const handleVolumeMouseUp = () => {
    setIsVolumeSliding(false);
  };

  const handleVolumeMouseEnter = () => {
    setIsVolumeHovering(true);
  };

  const handleVolumeMouseLeave = () => {
    setIsVolumeHovering(false);
  };

  const updateVolumeFromEvent = (e) => {
    const host = volumeWrapperRef.current || volumeSliderRef.current;
    if (!host) return;

    const rect = host.getBoundingClientRect();
    // 以實際顯示長邊為滑桿長度，避免旋轉造成高度僅 3~4px 導致點擊幾乎等於 100%
    const isVertical = rect.height >= rect.width;
    const length = Math.max(1, isVertical ? rect.height : rect.width);
    const rel = isVertical ? (e.clientY - rect.top) : (e.clientX - rect.left);
    let percentage = isVertical ? (1 - (rel / length)) : (rel / length);
    percentage = Math.max(0, Math.min(1, percentage));

    player.setVolume(percentage);
  };

  // 檢查釘選狀態並載入釘選的播放清單
  useEffect(() => {
    const fetchPinnedPlayer = async () => {
      try {
        const res = await axios.get('/api/current-user');
        const userData = res.data.user || res.data;
        
        if (userData?.pinnedPlayer?.userId) {
          const pinned = userData.pinnedPlayer;
          // 檢查是否過期
          const now = new Date();
          const expiresAt = pinned.expiresAt ? new Date(pinned.expiresAt) : null;
          
          if (expiresAt && expiresAt > now) {
            // 未過期，設置釘選狀態
            setIsPinned(true);
            setPinnedPlayerData(pinned);
            
            // 觸發全局事件，通知其他組件
            window.dispatchEvent(new CustomEvent('pinnedPlayerChanged', { 
              detail: { 
                isPinned: true,
                pinnedPlayer: pinned
              } 
            }));
            
            // ✅ 刷新後恢復釘選播放器的播放清單
            if (playerRef.current && pinned.playlist && pinned.playlist.length > 0) {
              const currentIndex = pinned.currentIndex || 0;
              const track = pinned.playlist[currentIndex];
              if (track?.url) {
                // 設置播放清單和當前索引
                playerRef.current.setPlaylist?.(pinned.playlist);
                playerRef.current.setActiveIndex?.(currentIndex);
                
                // 設置當前曲目
                playerRef.current.setSrc?.(track.url);
                playerRef.current.setOriginUrl?.(track.url);
                playerRef.current.setTrackTitle?.(track.title || '');
                
                // 設置播放器擁有者
                playerRef.current.setPlayerOwner?.({ 
                  userId: pinned.userId, 
                  username: pinned.username 
                });
                
              }
            }
          } else if (expiresAt && expiresAt <= now) {
            // 已過期，自動解除釘選
            await axios.delete('/api/player/pin');
            setIsPinned(false);
            setPinnedPlayerData(null);
          }
        }
      } catch (error) {
        console.error('獲取釘選播放器失敗:', error);
      }
    };
    
    fetchPinnedPlayer();
    
    // 監聽釘選變更事件（使用 playerRef 避免閉包問題）
    const handlePinnedChange = (e) => {
      if (e.detail.isPinned) {
        setIsPinned(true);
        const pinnedData = e.detail.pinnedPlayer || {
          userId: e.detail.userId,
          username: e.detail.username,
          playlist: e.detail.playlist,
          currentIndex: 0,
          expiresAt: e.detail.expiresAt
        };
        setPinnedPlayerData(pinnedData);
        
        // 當收到釘選事件時，也載入歌單
        if (playerRef.current && pinnedData.playlist && pinnedData.playlist.length > 0) {
          const currentIndex = pinnedData.currentIndex || 0;
          const track = pinnedData.playlist[currentIndex];
          if (track?.url) {
            // 設置播放清單和當前索引
            playerRef.current.setPlaylist?.(pinnedData.playlist);
            playerRef.current.setActiveIndex?.(currentIndex);
            
            // 設置當前曲目
            playerRef.current.setSrc?.(track.url);
            playerRef.current.setOriginUrl?.(track.url);
            playerRef.current.setTrackTitle?.(track.title || '');
            
            // 設置播放器擁有者
            playerRef.current.setPlayerOwner?.({ 
              userId: pinnedData.userId, 
              username: pinnedData.username 
            });
          }
        }
      } else {
        setIsPinned(false);
        setPinnedPlayerData(null);
      }
    };
    
    window.addEventListener('pinnedPlayerChanged', handlePinnedChange);
    
    return () => {
      window.removeEventListener('pinnedPlayerChanged', handlePinnedChange);
    };
  }, []); // 只在組件掛載時執行一次，避免重複獲取覆蓋釘選狀態

  // 全域監聽滑鼠事件
  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }
    if (isVolumeSliding) {
      document.addEventListener("mousemove", handleVolumeMouseMove);
      document.addEventListener("mouseup", handleVolumeMouseUp);
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousemove", handleVolumeMouseMove);
      document.removeEventListener("mouseup", handleVolumeMouseUp);
    };
  }, [isDragging, isVolumeSliding]);


  // 在所有 hooks 宣告之後再根據條件決定是否輸出 UI
  if (!showMini) return null;
  
  // ✅ 等待位置載入完成後才渲染，避免從左上角閃現
  if (!position) return null;

  return (
    <div
      className="fixed z-50 cursor-move select-none"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="flex flex-col items-center space-y-3">
        {/* 釘選狀態提示（如果有釘選） */}
        {isPinned && pinnedPlayerData && (
          <div className="w-[140px] h-6 rounded bg-purple-600/90 text-white text-xs overflow-hidden flex items-center justify-between px-2">
            <div className="flex items-center truncate flex-1">
              <span className="mr-1">📌</span>
              <span className="truncate">@{pinnedPlayerData.username}</span>
              <span className="ml-1 text-[10px] opacity-75 flex-shrink-0">
                ({Math.ceil((new Date(pinnedPlayerData.expiresAt) - new Date()) / (1000 * 60 * 60 * 24))}天)
              </span>
            </div>
            <button
              onClick={async (e) => {
                e.stopPropagation();
                if (confirm('確定要解除釘選嗎？')) {
                  try {
                    await axios.delete('/api/player/pin');
                    setIsPinned(false);
                    setPinnedPlayerData(null);
                    
                    // ✅ 暫停播放器並清除狀態，讓當前頁面重新載入播放清單
                    if (playerRef.current) {
                      playerRef.current.pause?.();
                      // 清除 src，強制重新載入
                      playerRef.current.setSrcWithAudio?.('', [], 0, '');
                      // ✅ 禁用播放器，確保 MiniPlayer 消失
                      playerRef.current.setMiniPlayerEnabled?.(false);
                    }
                    
                    window.dispatchEvent(new CustomEvent('pinnedPlayerChanged', { 
                      detail: { isPinned: false } 
                    }));
                  } catch (error) {
                    console.error('解除釘選失敗:', error);
                    alert('解除釘選失敗');
                  }
                }
              }}
              className="ml-1 text-white/70 hover:text-white transition-colors flex-shrink-0"
              title="解除釘選"
            >
              ✕
            </button>
          </div>
        )}
        
        {/* 黑色跑馬燈（曲名 + 可點連結） */}
        <div
          className="w-[140px] h-6 rounded bg-black/80 text-white text-xs overflow-hidden flex items-center px-2 cursor-pointer"
          title={player.originUrl || player.src || "未設定來源"}
          onClick={(e) => {
            e.stopPropagation();
            const href = player.originUrl || player.src;
            if (href) window.open(href, "_blank");
          }}
        >
          <div
            className="inline-block whitespace-nowrap"
            style={{
              animation: "miniMarquee 12s linear infinite",
            }}
          >
            {displayTitle}
          </div>
        </div>

        {/* 主體以 SVG 佈景為主視覺 */}
        <div 
          className="relative cursor-pointer transition-shadow duration-200 hover:shadow-2xl"
          style={{
            width: '140px',
            height: '140px',
            borderRadius: '16px'
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (justDraggedRef.current) return;
            setIsExpanded(prev => {
              const next = !prev;
              try { localStorage.setItem("miniPlayerExpanded", next ? "1" : "0"); } catch {}
              return next;
            });
          }}
        >
          <MiniPlayerArt isPlaying={player.isPlaying} palette={palette} />
          
          {/* 釘選按鈕 - 在播放器圖示左上方內部 */}
          {player?.playerOwner && player?.playlist?.length > 0 && (
            <div className="absolute top-2 left-2 z-10">
              <PinPlayerButton
                targetUserId={player.playerOwner.userId}
                targetUserPlaylist={player.playlist}
                targetUsername={player.playerOwner.username}
              />
            </div>
          )}

          {/* 播放進度條：置於唱片下方居中顯示 */}
          {showProgressBar && (
            <div
              className="absolute"
              style={{
                left: '50%',
                transform: 'translateX(-50%)',
                bottom: '14px',
                width: '104px',
                height: '6px',
                background: 'rgba(0,0,0,0.10)',
                borderRadius: '3px',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.12)'
              }}
              onMouseDown={handleButtonClick}
              aria-label="播放進度"
              title={`進度: ${Math.round(safePercentage)}%`}
            >
              <div
                style={{
                  width: `${safePercentage}%`,
                  height: '100%',
                  borderRadius: '3px',
                  background: `linear-gradient(to right, ${palette.accent1}, ${palette.accent2})`,
                  transition: 'width 0.15s ease'
                }}
              />
            </div>
          )}

          {showInteractiveVolume && player.volumeSynced && (
            <div 
              className="absolute cursor-pointer" 
              style={{ 
                right: '-8px',
                bottom: '50px',
                transform: 'rotate(-90deg)', 
                transformOrigin: 'center',
                background: 'rgba(0, 0, 0, 0.6)',
                border: '0.5px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '6px',
                padding: '4px 6px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                backdropFilter: 'blur(4px)'
              }}
              ref={volumeWrapperRef}
              title={`音量: ${Math.round(player.volume * 100)}%`}
              onMouseEnter={handleVolumeMouseEnter}
              onMouseLeave={handleVolumeMouseLeave}
            >
              <div 
                ref={volumeSliderRef}
                onMouseDown={handleVolumeMouseDown}
                style={{
                  width: '30px',
                  height: isVolumeHovering || isVolumeSliding ? '4px' : '3px',
                  background: isVolumeSliding ? '#95A5A6' : (isVolumeHovering ? '#A8B5B8' : '#BDC3C7'),
                  borderRadius: '2px',
                  position: 'relative',
                  boxShadow: isVolumeHovering || isVolumeSliding 
                    ? 'inset 0 1px 3px rgba(0,0,0,0.15), 0 1px 2px rgba(0,0,0,0.1)' 
                    : 'inset 0 1px 2px rgba(0,0,0,0.1)',
                  transition: 'all 0.2s ease'
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '0',
                    left: '0',
                    width: `${player.volume * 100}%`,
                    height: '100%',
                    background: `linear-gradient(to right, ${palette.accent1}, ${palette.accent2})`,
                    borderRadius: '2px',
                    transition: isVolumeSliding ? 'none' : 'width 0.1s ease'
                  }}
                />
                 <div 
                   style={{
                     position: 'absolute',
                     top: isVolumeHovering || isVolumeSliding ? '-4px' : '-3px',
                     left: `${player.volume * 24}px`,
                     width: isVolumeSliding ? '12px' : (isVolumeHovering ? '10px' : '9px'),
                     height: isVolumeSliding ? '12px' : (isVolumeHovering ? '10px' : '9px'),
                     background: isVolumeSliding 
                       ? 'radial-gradient(circle, #2C3E50, #34495E)' 
                       : (isVolumeHovering 
                         ? 'radial-gradient(circle, #34495E, #2C3E50)' 
                         : 'radial-gradient(circle, #34495E, #2C3E50)'),
                     borderRadius: '50%',
                     border: `1px solid ${isVolumeSliding || isVolumeHovering ? '#95A5A6' : '#BDC3C7'}`,
                     boxShadow: isVolumeSliding 
                       ? '0 3px 8px rgba(0,0,0,0.5)' 
                       : (isVolumeHovering 
                         ? '0 2px 5px rgba(0,0,0,0.4)' 
                         : '0 1px 3px rgba(0,0,0,0.3)'),
                     transition: isVolumeSliding ? 'none' : 'all 0.2s ease',
                     cursor: 'pointer'
                   }}
                 />
              </div>
            </div>
          )}
        </div>

        {/* 展開按鈕移除，改為點擊唱片圖示展開/收起 */}

        {/* 外部控制面板 - 透明風格 */}
        <div 
          className={`rounded-lg transition-all duration-300 ease-in-out overflow-hidden ${
            isExpanded ? 'opacity-100 max-h-20' : 'opacity-0 max-h-0'
          }`}
          style={{
            background: 'transparent',
            padding: isExpanded ? '8px 12px' : '0 12px'
          }}
        >
          {/* 播放控制按鈕 */}
          <div className="flex justify-center items-center space-x-4">
            {/* 上一首 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrevious();
              }}
              onMouseDown={(e) => { e.stopPropagation(); }}
              className={`w-8 h-8 flex items-center justify-center text-gray-300 transition-all duration-200 rounded-full ${isDragging ? '' : 'hover:text-white hover:scale-110'}`}
              title="上一首"
              style={{
                background: 'rgba(0, 0, 0, 0.6)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
              </svg>
            </button>

            {/* 播放/暫停 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                player.isPlaying ? player.pause() : player.play();
              }}
              onMouseDown={(e) => { e.stopPropagation(); }}
              className={`w-10 h-10 flex items-center justify-center text-orange-400 transition-all duration-200 ${isDragging ? '' : 'hover:text-orange-300 hover:scale-110'}`}
              title={player.isPlaying ? "暫停" : "播放"}
              style={{
                background: 'rgba(0, 0, 0, 0.7)',
                backdropFilter: 'blur(8px)',
                borderRadius: '50%',
                border: '1px solid rgba(230, 126, 34, 0.4)'
              }}
            >
              {player.isPlaying ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </button>

            {/* 下一首 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              onMouseDown={(e) => { e.stopPropagation(); }}
              className={`w-8 h-8 flex items-center justify-center text-gray-300 transition-all duration-200 rounded-full ${isDragging ? '' : 'hover:text-white hover:scale-110'}`}
              title="下一首"
              style={{
                background: 'rgba(0, 0, 0, 0.6)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
      {/* 跑馬燈動畫樣式 */}
      <style jsx>{`
        @keyframes miniMarquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
}