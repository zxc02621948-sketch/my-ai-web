"use client";

import { usePlayer } from "@/components/context/PlayerContext";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { usePathname } from "next/navigation";
import MiniPlayerArt from "@/components/common/MiniPlayerArt";
import CatPlayerArt from "@/components/player/MiniPlayerArt";
import CatHeadphoneCanvas from "@/components/player/CatHeadphoneCanvas";
import PinPlayerButton from "@/components/player/PinPlayerButton";
import { useCurrentUser } from "@/contexts/CurrentUserContext";
import axios from "axios";

export default function MiniPlayer() {
  const player = usePlayer();
  const { currentUser, hasValidSubscription } = useCurrentUser(); // 使用 Context
  const pathname = usePathname(); // 獲取當前路徑
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
  
  // 當前啟用的造型
  const activePlayerSkin = useMemo(() => {
    if (!currentUser) return 'default';
    
    // 如果沒有購買高階造型，強制使用預設造型
    if (!currentUser.premiumPlayerSkin) {
      return 'default';
    }
    
    // 如果有過期時間且已過期，強制使用預設造型
    if (currentUser.premiumPlayerSkinExpiry) {
      const isExpired = new Date(currentUser.premiumPlayerSkinExpiry) <= new Date();
      if (isExpired) {
        return 'default';
      }
    }
    
    // 返回用戶選擇的造型（預設為 'default'）
    return currentUser.activePlayerSkin || 'default';
  }, [currentUser]);
  
  // 顏色設定狀態（優先使用數據庫設定，否則使用預設值）
  const [colorSettings, setColorSettings] = useState(() => {
    // 如果用戶已登入且有保存的設定，使用數據庫設定
    if (currentUser?.playerSkinSettings) {
      return currentUser.playerSkinSettings;
    }
    return {
      mode: 'rgb',
      speed: 0.02,
      saturation: 50,
      lightness: 60,
      hue: 0
    };
  });
  
  // 當 currentUser 更新時，同步顏色設定
  useEffect(() => {
    if (currentUser?.playerSkinSettings) {
      setColorSettings(currentUser.playerSkinSettings);
    }
  }, [currentUser]);
  
  // 更新 playerRef
  useEffect(() => {
    playerRef.current = player;
  }, [player]);
  
  // 依照 Hooks 規則：所有 hooks 必須在每次 render 都被呼叫，
  // 因此不在條件分支中提前 return；改用條件渲染控制輸出。
  
  // 檢查當前路徑是否是用戶頁面
  const isUserPage = pathname.startsWith("/user/") && pathname !== "/user/following";
  
  // 檢查用戶是否有播放器功能（LV3 或體驗券 或 購買過 或 有訂閱）
  const hasPlayerFeature = useMemo(() => {
    if (!currentUser) return false;
    
    // 檢查等級（LV3 = totalEarnedPoints >= 500）
    const userLevel = (currentUser.totalEarnedPoints || 0) >= 500;
    
    // 檢查體驗券是否有效
    const hasCoupon = currentUser.playerCouponUsed && 
                      currentUser.miniPlayerExpiry && 
                      new Date(currentUser.miniPlayerExpiry) > new Date();
    
    // 檢查是否購買過播放器
    const hasPurchased = currentUser.miniPlayerPurchased;
    
    // 檢查是否有有效的釘選播放器訂閱
    const hasSubscription = hasValidSubscription('pinPlayer') || hasValidSubscription('pinPlayerTest');
    
    return userLevel || hasCoupon || hasPurchased || hasSubscription;
  }, [currentUser, hasValidSubscription]);
  
  // 顯示邏輯：
  // 1. currentUser 載入中 (undefined) → 不顯示（避免閃爍）
  // 2. 如果釘選了 → 全站顯示（但仍需要有播放器功能）
  // 3. 如果沒釘選 → 只在用戶頁面 AND player.miniPlayerEnabled AND 有播放器功能時顯示
  const showMini = currentUser !== undefined && hasPlayerFeature && (isPinned || (isUserPage && player?.miniPlayerEnabled));
  
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
    let lastLoggedTime = 0; // 避免重複日誌
    
    const interval = setInterval(() => {
      if (player?.updateCurrentTime) {
        player.updateCurrentTime();
      }
      
      // ✅ 每 10 秒輸出一次播放進度日誌
      saveCounter++;
      if (saveCounter >= 10) {
        saveCounter = 0;
        
        const currentPlayer = playerRef.current;
        const currentTime = Math.floor(currentPlayer?.currentTime || 0);
        
        // 避免重複輸出相同時間點
        if (currentTime !== lastLoggedTime) {
          console.log('⏱️ [播放監測]', {
            當前進度: `${currentTime}秒`,
            總時長: `${Math.floor(currentPlayer?.duration || 0)}秒`,
            進度百分比: `${Math.floor(pct)}%`,
            音量: `${Math.floor((currentPlayer?.volume || 1) * 100)}%`,
            播放狀態: currentPlayer?.isPlaying ? '播放中' : '已暫停',
            當前曲目: currentPlayer?.trackTitle || '未知',
            是否釘選: isPinned
          });
          lastLoggedTime = currentTime;
        }
      }
    }, 1000); // 每秒更新一次
    
    return () => clearInterval(interval);
  }, [showMini, player?.isPlaying, isPinned, pct]); // 只依賴關鍵狀態，避免重複創建 interval

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
    // ✅ 移除手機板拖動限制，允許所有設備拖動
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
      
      // ✅ 拖動結束後，確保位置在安全範圍內
      const margin = 16;
      const width = 140;
      const height = 200; // 考慮展開後的高度
      const maxX = window.innerWidth - width - margin;
      const maxY = window.innerHeight - height - margin;
      
      const safeX = Math.max(margin, Math.min(finalX, maxX));
      const safeY = Math.max(margin, Math.min(finalY, maxY));
      
      // 如果位置被調整，更新狀態
      if (safeX !== finalX || safeY !== finalY) {
        setPosition({ x: safeX, y: safeY });
      }
      
      // 儲存調整後的位置
      localStorage.setItem("miniPlayerPosition", JSON.stringify({ x: safeX, y: safeY }));
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
    const initializePosition = () => {
      const margin = 16;
      const width = 140; // 與元件寬度一致
      const height = 80; // 播放器高度
      
      try {
        const saved = localStorage.getItem("miniPlayerPosition");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed.x === "number" && typeof parsed.y === "number") {
            // 確保保存的位置在視窗範圍內
            const maxX = window.innerWidth - width - margin;
            const maxY = window.innerHeight - height - margin;
            const safeX = Math.max(margin, Math.min(parsed.x, maxX));
            const safeY = Math.max(margin, Math.min(parsed.y, maxY));
            
            setPosition({ x: safeX, y: safeY });
            return;
          }
        }
      } catch {}

      // 預設位置：右上角
      if (typeof window !== "undefined") {
        const x = Math.max(margin, window.innerWidth - width - margin);
        const y = margin;
        setPosition({ x, y });
      }
    };
    
    initializePosition();
  }, []);
  
  // 監聽視窗大小變化，調整播放器位置
  useEffect(() => {
    if (!position) return;
    
    const handleResize = () => {
      const margin = 16;
      const width = 140;
      const height = 200; // 考慮展開後的高度
      
      // 統一處理：確保在視窗範圍內（桌面和手機板都適用）
      const maxX = window.innerWidth - width - margin;
      const maxY = window.innerHeight - height - margin;
      
      // 如果當前位置超出視窗範圍，調整到安全位置
      if (position.x > maxX || position.y > maxY || position.x < margin || position.y < margin) {
        const safeX = Math.max(margin, Math.min(position.x, maxX));
        const safeY = Math.max(margin, Math.min(position.y, maxY));
        
        setPosition({ x: safeX, y: safeY });
        
        // 更新 localStorage
        try {
          localStorage.setItem("miniPlayerPosition", JSON.stringify({ x: safeX, y: safeY }));
        } catch {}
      }
    };
    
    // 只監聽 resize 事件，不在初始化時執行
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [position]);

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
      
      console.log('🖱️ [進度條點擊]', {
        點擊位置: `${Math.round(percentage * 100)}%`,
        跳轉到: `${Math.floor(newTime)}秒`,
        總時長: `${Math.floor(player.duration)}秒`
      });
      
      // 優先使用外部播放器控制
      if (player.externalControls && typeof player.externalControls.seekTo === 'function') {
        try {
          player.externalControls.seekTo(newTime);
          console.log("✅ [進度條點擊] 外部播放器跳轉成功:", Math.floor(newTime));
        } catch (error) {
          console.error("❌ [進度條點擊] 外部播放器跳轉失敗:", error);
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
    e.preventDefault();
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
    const wrapper = volumeWrapperRef.current; // 使用外層容器
    if (!wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    // 外層容器旋轉了 -90deg，padding 是 4px 6px (上下 左右)
    // 旋轉後：原本的左右 padding (6px) 變成了上下 padding
    // 實際有效高度 = rect.height - 12px (上下各 6px padding)
    const padding = 6; // 旋轉後的上下 padding
    const clickY = e.clientY - rect.top;
    const effectiveHeight = rect.height - (padding * 2);
    const relativeY = clickY - padding;
    let percentage = 1 - (relativeY / effectiveHeight); // 反向：頂部 = 1, 底部 = 0
    percentage = Math.max(0, Math.min(1, percentage));

    player.setVolume(percentage);
  };

  // 檢查釘選狀態並載入釘選的播放清單（使用 Context 中的 currentUser）
  useEffect(() => {
    // 等待 currentUser 載入完成
    if (currentUser === undefined) {
      console.log('🔍 [MiniPlayer] currentUser 未載入，等待中...');
      return;
    }
    
    const loadPinnedPlayer = async () => {
      try {
        const userData = currentUser;
        console.log('🔍 [MiniPlayer] 檢查釘選狀態:', {
          hasPinnedPlayer: !!userData?.pinnedPlayer?.userId,
          pinnedUserId: userData?.pinnedPlayer?.userId,
          pinnedUsername: userData?.pinnedPlayer?.username,
          playlistLength: userData?.pinnedPlayer?.playlist?.length
        });
        
        if (userData?.pinnedPlayer?.userId) {
          const pinned = userData.pinnedPlayer;
          // 檢查是否過期
          const now = new Date();
          const expiresAt = pinned.expiresAt ? new Date(pinned.expiresAt) : null;
          
          console.log('🔍 [MiniPlayer] 釘選數據:', {
            expiresAt,
            now,
            isExpired: expiresAt && expiresAt <= now,
            playlistLength: pinned.playlist?.length
          });
          
          if (expiresAt && expiresAt > now) {
            // 未過期，設置釘選狀態
            setIsPinned(true);
            setPinnedPlayerData(pinned);
            console.log('✅ [MiniPlayer] 設置釘選狀態為 true');
            
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
              console.log('🎵 [MiniPlayer] 載入釘選歌單:', {
                playlistLength: pinned.playlist.length,
                currentIndex,
                currentTrack: track?.title,
                trackUrl: track?.url
              });
              
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
                
                console.log('✅ [MiniPlayer] 歌單載入完成');
              }
            } else {
              console.warn('⚠️ [MiniPlayer] playerRef 或 playlist 不可用');
            }
          } else if (expiresAt && expiresAt <= now) {
            // 已過期，自動解除釘選
            console.log('⏰ [MiniPlayer] 釘選已過期，自動解除');
            await axios.delete('/api/player/pin');
            setIsPinned(false);
            setPinnedPlayerData(null);
          }
        } else {
          console.log('ℹ️ [MiniPlayer] 無釘選播放器');
        }
      } catch (error) {
        console.error('❌ [MiniPlayer] 載入釘選播放器失敗:', error);
      }
    };
    
    loadPinnedPlayer();
  }, [currentUser]); // 當 currentUser 變化時重新檢查
  
  // 監聽釘選變更事件（當用戶主動釘選/取消釘選時）
  useEffect(() => {
    const handlePinnedChange = (e) => {
      console.log('📡 [MiniPlayer] 收到釘選事件:', {
        isPinned: e.detail.isPinned,
        hasPlayerData: !!e.detail.pinnedPlayer,
        playlistLength: e.detail.playlist?.length || e.detail.pinnedPlayer?.playlist?.length
      });
      
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
        
        console.log('📡 [MiniPlayer] 釘選數據:', {
          userId: pinnedData.userId,
          username: pinnedData.username,
          playlistLength: pinnedData.playlist?.length,
          currentIndex: pinnedData.currentIndex
        });
        
        // 當收到釘選事件時，也載入歌單
        if (playerRef.current && pinnedData.playlist && pinnedData.playlist.length > 0) {
          const currentIndex = pinnedData.currentIndex || 0;
          const track = pinnedData.playlist[currentIndex];
          console.log('🎵 [MiniPlayer-Event] 載入歌單:', {
            track: track?.title,
            url: track?.url
          });
          
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
            
            console.log('✅ [MiniPlayer-Event] 歌單設置完成');
          }
        } else {
          console.warn('⚠️ [MiniPlayer-Event] playerRef 或 playlist 不可用');
        }
      } else {
        console.log('📌 [MiniPlayer] 取消釘選');
        setIsPinned(false);
        setPinnedPlayerData(null);
      }
    };
    
    window.addEventListener('pinnedPlayerChanged', handlePinnedChange);
    
    return () => {
      window.removeEventListener('pinnedPlayerChanged', handlePinnedChange);
    };
  }, []);

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

  // ✅ 當播放器隱藏時（未釘選且離開用戶頁面），停止播放
  useEffect(() => {
    if (!showMini && !isPinned && player?.isPlaying) {
      // ✅ 先使用 postMessage 暫停 YouTube 播放器（在清空 originUrl 之前）
      try {
        const iframes = document.querySelectorAll('iframe[src*="youtube.com"]');
        if (iframes.length > 0) {
          const iframe = iframes[iframes.length - 1];
          if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage(JSON.stringify({
              event: 'command',
              func: 'pauseVideo',
              args: []
            }), '*');
          }
        }
      } catch (error) {
        console.error('❌ [MiniPlayer] YouTube 暫停失敗:', error);
      }
      
      // 然後設置 isPlaying 為 false
      player?.setIsPlaying?.(false);
    }
  }, [showMini, isPinned, player?.isPlaying, player]);

  // 在所有 hooks 宣告之後再根據條件決定是否輸出 UI
  if (!showMini) return null;
  
  // ✅ 等待位置載入完成後才渲染，避免從左上角閃現
  if (!position) return null;

  return (
    <div
      className="fixed z-50 select-none"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        cursor: 'default' // 不顯示十字符號
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
            if (justDraggedRef.current) return; // 如果剛拖動過，不要打開連結
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
          className="relative transition-shadow duration-200 hover:shadow-2xl"
          style={{
            width: '140px',
            height: '140px',
            overflow: 'visible',
            cursor: 'default'
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
          {/* 播放器造型：根據啟用的造型顯示 */}
          {(() => {
            switch (activePlayerSkin) {
              case 'cat-headphone':
                // 高階造型：Canvas 動畫貓咪耳機
                return (
                  <CatHeadphoneCanvas 
                    isPlaying={player.isPlaying} 
                    size={130} 
                    colorSettings={colorSettings}
                  />
                );
              
              // 未來可以在這裡新增更多造型，例如：
              // case 'neon-glow':
              //   return <NeonGlowPlayer isPlaying={player.isPlaying} />;
              
              case 'default':
              default:
                // 預設造型：舊的播放器圖示
                return <MiniPlayerArt isPlaying={player.isPlaying} palette={palette} />;
            }
          })()}

          {/* 音符動畫 - 只在播放時且使用貓咪耳機造型時顯示 */}
          {player.isPlaying && activePlayerSkin === 'cat-headphone' && (
            <>
              {/* 音符 1 - 頂部右側，粉紅色雙音符 */}
              <div 
                className="absolute text-xl animate-float-1"
                style={{ 
                  top: '5px', 
                  right: '35px',
                  color: '#FF6B9D',
                  textShadow: '0 0 8px rgba(255, 107, 157, 0.8), 0 0 12px rgba(255, 107, 157, 0.6), 0 2px 6px rgba(0,0,0,0.4)',
                  filter: 'drop-shadow(0 0 4px rgba(255, 107, 157, 0.9))',
                  zIndex: 3,
                  fontWeight: 'bold'
                }}
              >
                🎵
              </div>
              
              {/* 音符 2 - 頂部左側，青綠色單音符 */}
              <div 
                className="absolute text-xl animate-float-2"
                style={{ 
                  top: '5px', 
                  left: '35px',
                  color: '#4ECDC4',
                  textShadow: '0 0 8px rgba(78, 205, 196, 0.8), 0 0 12px rgba(78, 205, 196, 0.6), 0 2px 6px rgba(0,0,0,0.4)',
                  filter: 'drop-shadow(0 0 4px rgba(78, 205, 196, 0.9))',
                  zIndex: 3,
                  fontWeight: 'bold'
                }}
              >
                ♪
              </div>
              
              {/* 音符 3 - 右側中央，金黃色雙音符 */}
              <div 
                className="absolute text-xl animate-float-3"
                style={{ 
                  top: '50%',
                  marginTop: '-12px',
                  right: '5px',
                  color: '#FFD93D',
                  textShadow: '0 0 8px rgba(255, 217, 61, 0.8), 0 0 12px rgba(255, 217, 61, 0.6), 0 2px 6px rgba(0,0,0,0.4)',
                  filter: 'drop-shadow(0 0 4px rgba(255, 217, 61, 0.9))',
                  zIndex: 3,
                  fontWeight: 'bold'
                }}
              >
                🎶
              </div>
              
              {/* 音符 4 - 左側中央，紫色三連音符 */}
              <div 
                className="absolute text-xl animate-float-4"
                style={{ 
                  top: '50%',
                  marginTop: '-12px',
                  left: '5px',
                  color: '#C77DFF',
                  textShadow: '0 0 8px rgba(199, 125, 255, 0.8), 0 0 12px rgba(199, 125, 255, 0.6), 0 2px 6px rgba(0,0,0,0.4)',
                  filter: 'drop-shadow(0 0 4px rgba(199, 125, 255, 0.9))',
                  zIndex: 3,
                  fontWeight: 'bold'
                }}
              >
                ♬
              </div>
              
              {/* 音符 5 - 底部右側，橙色單音符 */}
              <div 
                className="absolute text-xl animate-float-1"
                style={{ 
                  bottom: '8px', 
                  right: '35px',
                  color: '#FF9F1C',
                  textShadow: '0 0 8px rgba(255, 159, 28, 0.8), 0 0 12px rgba(255, 159, 28, 0.6), 0 2px 6px rgba(0,0,0,0.4)',
                  filter: 'drop-shadow(0 0 4px rgba(255, 159, 28, 0.9))',
                  zIndex: 3,
                  fontWeight: 'bold',
                  animationDelay: '0.3s'
                }}
              >
                ♫
              </div>
              
              {/* 音符 6 - 底部左側，綠色雙音符 */}
              <div 
                className="absolute text-xl animate-float-2"
                style={{ 
                  bottom: '8px', 
                  left: '35px',
                  color: '#6BCF7F',
                  textShadow: '0 0 8px rgba(107, 207, 127, 0.8), 0 0 12px rgba(107, 207, 127, 0.6), 0 2px 6px rgba(0,0,0,0.4)',
                  filter: 'drop-shadow(0 0 4px rgba(107, 207, 127, 0.9))',
                  zIndex: 3,
                  fontWeight: 'bold',
                  animationDelay: '0.6s'
                }}
              >
                ♩
              </div>
            </>
          )}
          
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
                bottom: '5px',
                width: '90px',
                height: '4px',
                background: 'rgba(0,0,0,0.10)',
                borderRadius: '3px',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.12)',
                zIndex: 1
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
              className="absolute" 
              style={{ 
                right: '-12px',
                bottom: '60px',
                transform: 'rotate(-90deg)', 
                transformOrigin: 'center',
                background: 'rgba(0, 0, 0, 0.6)',
                border: '0.5px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '6px',
                padding: '4px 6px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                backdropFilter: 'blur(4px)',
                zIndex: 10,
                cursor: 'pointer'
              }}
              ref={volumeWrapperRef}
              title={`音量: ${Math.round(player.volume * 100)}%`}
              onMouseEnter={handleVolumeMouseEnter}
              onMouseLeave={handleVolumeMouseLeave}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleVolumeMouseDown(e);
              }}
            >
              <div 
                ref={volumeSliderRef}
                onMouseDown={handleVolumeMouseDown}
                onClick={(e) => e.stopPropagation()}
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
                const action = player.isPlaying ? '暫停' : '播放';
                console.log(`🎮 [播放控制] 用戶點擊${action}按鈕`, {
                  當前狀態: player.isPlaying ? '播放中' : '已暫停',
                  即將執行: action,
                  當前曲目: player.trackTitle,
                  當前進度: `${Math.floor(player.currentTime)}/${Math.floor(player.duration)}秒`
                });
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