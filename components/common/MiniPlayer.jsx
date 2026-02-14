"use client";

import { usePlayer } from "@/components/context/PlayerContext";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import MiniPlayerArt from "@/components/common/MiniPlayerArt";
import CatPlayerArt from "@/components/player/MiniPlayerArt";
import CatHeadphoneCanvas from "@/components/player/CatHeadphoneCanvas";
import PinPlayerButton from "@/components/player/PinPlayerButton";
import PlayerTutorialModal from "@/components/player/PlayerTutorialModal";
import { useCurrentUser } from "@/contexts/CurrentUserContext";
import axios from "axios";
import { notify } from "@/components/common/GlobalNotificationManager";
import { getApiErrorMessage, isAuthError } from "@/lib/clientAuthError";
import {
  readPinnedPlayerCache,
  writePinnedPlayerCache,
  clearPinnedPlayerCache,
} from "@/utils/pinnedPlayerCache";

export default function MiniPlayer() {
  const player = usePlayer();
  const { currentUser, hasValidSubscription, setCurrentUser, subscriptions } = useCurrentUser(); // 使用 Context
  const pathname = usePathname(); // 獲取當前路徑
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState(null); // ✅ 初始為 null，等待從 localStorage 載入
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isExpanded, setIsExpanded] = useState(false);
  const [dragStartTime, setDragStartTime] = useState(0);
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const justDraggedRef = useRef(false);
  const [isVolumeSliding, setIsVolumeSliding] = useState(false);
  const [isVolumeHovering, setIsVolumeHovering] = useState(false);
  const volumeSliderRef = useRef(null);
  const volumeWrapperRef = useRef(null);
  const [theme, setTheme] = useState("modern");
  const [imgFailed] = useState(false);
  const showInteractiveVolume = true; // 啟用直式音量拉條（右下角偏上一點）
  const [isTutorialOpen, setIsTutorialOpen] = useState(false); // 教學彈窗狀態
  
  // 釘選狀態管理
  const [pinnedPlayerData, setPinnedPlayerData] = useState(null);
  const [isPinned, setIsPinned] = useState(false);
  const playerRef = useRef(player); // 使用 ref 保存最新的 player 引用
  const needsPinnedRefreshRef = useRef(true); // 控制是否需要重新載入釘選狀態
  // ✅ 本地狀態：追蹤是否正在載入播放清單（用於立即更新 UI，需要在 displayTitle 之前定義）
  const [isLoadingPlaylist, setIsLoadingPlaylist] = useState(false);
  
  const {
    shuffleAllowed: globalShuffleAllowed,
    shuffleEnabled: globalShuffleEnabled,
    setShuffleEnabled: setGlobalShuffleEnabled,
    playerOwner: globalPlayerOwner,
  } = player;
  const currentPlaylistLength = player?.playlist?.length || 0;

  const applyPinnedShufflePreference = useCallback((allow, ownerId) => {
    if (!playerRef.current?.setShuffleEnabled) {
      return;
    }

    if (allow === false) {
      playerRef.current.setShuffleEnabled(false);
      return;
    }

    if (allow !== true) {
      return;
    }

    let shouldEnable = false;
    try {
      shouldEnable = localStorage.getItem(`playlist_${ownerId}_shuffle`) === "1";
    } catch (error) {
      console.warn("讀取釘選隨機播放設定失敗:", error);
    }

    playerRef.current.setShuffleEnabled(shouldEnable);
  }, []);

  const handleShuffleButtonClick = useCallback(() => {
    if (!globalShuffleAllowed || !setGlobalShuffleEnabled) {
      return;
    }
    const ownerId = globalPlayerOwner?.userId;
    const next = !globalShuffleEnabled;
    setGlobalShuffleEnabled(next);
    if (!ownerId) {
      return;
    }
    try {
      const storageKey = `playlist_${ownerId}_shuffle`;
      if (next) {
        localStorage.setItem(storageKey, "1");
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch (error) {
      console.warn("保存釘選隨機播放設定失敗:", error);
    }
  }, [globalShuffleAllowed, globalShuffleEnabled, setGlobalShuffleEnabled, globalPlayerOwner]);

  useEffect(() => {
    const ref = playerRef.current;
    if (!ref) {
      return;
    }

    if (globalShuffleAllowed) {
      return;
    }

    // ✅ 如果没有 playerOwner，但播放列表长度 > 1，也允许随机播放（预设播放器）
    if (!globalPlayerOwner && currentPlaylistLength > 1) {
      ref.setShuffleAllowed?.(true);
      return;
    }

    const allowPinned = pinnedPlayerData?.allowShuffle === true;
    const allowOwner = globalPlayerOwner?.allowShuffle === true;
    if (allowOwner || (allowPinned && globalPlayerOwner?.allowShuffle !== false)) {
      ref.setShuffleAllowed?.(true);
    }
  }, [
    globalShuffleAllowed,
    pinnedPlayerData?.allowShuffle,
    globalPlayerOwner?.allowShuffle,
    currentPlaylistLength,
  ]);

  // ✅ 檢查當前路徑是否是用戶頁面（需要在 useMemo 之前定義）
  const isUserPage = pathname.startsWith("/user/") && pathname !== "/user/following";
  
  // 當前啟用的造型（不受釘選影響）
  const activePlayerSkin = useMemo(() => {
    // ✅ 如果在用戶頁面，使用頁面主人的造型
    if (isUserPage && player?.pageOwnerSkin) {
      if (!player.pageOwnerSkin.premiumPlayerSkin) {
        return "default";
      }
      return player.pageOwnerSkin.activePlayerSkin || "default";
    }
    
    // ✅ 否則使用當前登入使用者自己的造型
    if (!currentUser) return "default";
    
    // 如果沒有購買高階造型，強制使用預設造型
    if (!currentUser.premiumPlayerSkin) {
      return "default";
    }
    
    // 如果有過期時間且已過期，強制使用預設造型
    if (currentUser.premiumPlayerSkinExpiry) {
      const isExpired =
        new Date(currentUser.premiumPlayerSkinExpiry) <= new Date();
      if (isExpired) {
        return "default";
      }
    }
    
    // 返回用戶選擇的造型（預設為 'default'）
    return currentUser.activePlayerSkin || "default";
  }, [currentUser, isUserPage, player?.pageOwnerSkin]);
  
  // 顏色設定狀態（優先使用數據庫設定，否則使用預設值）
  const [colorSettings, setColorSettings] = useState(() => {
    // 如果用戶已登入且有保存的設定，使用數據庫設定
    if (currentUser?.playerSkinSettings) {
      return currentUser.playerSkinSettings;
    }
    return {
      mode: "rgb",
      speed: 0.02,
      saturation: 50,
      lightness: 60,
      hue: 0,
    };
  });
  
  // 當 currentUser 或頁面主人造型更新時，同步顏色設定（不受釘選影響）
  useEffect(() => {
    // ✅ 如果在用戶頁面，使用頁面主人的設定
    if (isUserPage && player?.pageOwnerSkin?.playerSkinSettings) {
      setColorSettings((prev) => {
        // 只在設定真的改變時才更新，避免無限循環
        const newSettings = player.pageOwnerSkin.playerSkinSettings;
        if (JSON.stringify(prev) !== JSON.stringify(newSettings)) {
          return newSettings;
        }
        return prev;
      });
      return;
    }
    
    // 否則使用當前登入使用者的設定
    if (currentUser?.playerSkinSettings) {
      setColorSettings((prev) => {
        const newSettings = currentUser.playerSkinSettings;
        if (JSON.stringify(prev) !== JSON.stringify(newSettings)) {
          return newSettings;
        }
        return prev;
      });
    }
  }, [currentUser?.playerSkinSettings, isUserPage, player?.pageOwnerSkin?.playerSkinSettings]);
  
  // 更新 playerRef
  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  useEffect(() => {
    if (!isPinned || !pinnedPlayerData) {
      return;
    }

    const ownerId = globalPlayerOwner?.userId;
    if (!ownerId || String(ownerId) !== String(pinnedPlayerData.userId)) {
      return;
    }

    const ownerAllow = globalPlayerOwner?.allowShuffle;
    if (typeof ownerAllow !== "boolean") {
      return;
    }

    if (pinnedPlayerData.allowShuffle === ownerAllow) {
      return;
    }

    setPinnedPlayerData((prev) => {
      if (!prev) {
        return prev;
      }
      const next = { ...prev, allowShuffle: ownerAllow };
      const cached = readPinnedPlayerCache();
      if (cached && String(cached.userId) === String(next.userId)) {
        writePinnedPlayerCache({ ...cached, allowShuffle: ownerAllow });
      }
      return next;
    });
  }, [
    globalPlayerOwner?.allowShuffle,
    globalPlayerOwner?.userId,
    isPinned,
    pinnedPlayerData?.allowShuffle,
    pinnedPlayerData?.userId,
  ]);

  useEffect(() => {
    try {
      const cached = readPinnedPlayerCache();
      if (!cached || !cached.userId) {
        return;
      }

      setIsPinned(true);
      setPinnedPlayerData((prev) => prev || cached);

      const ref = playerRef.current;
      if (ref) {
        ref.setMiniPlayerEnabled?.(true);
        ref.setPlayerOwner?.({
          userId: cached.userId,
          username: cached.username,
          ...(typeof cached.allowShuffle === "boolean"
            ? { allowShuffle: cached.allowShuffle }
            : {}),
        });
        // 標記釘選擁有者（解除背景限制）
        ref.setPinnedOwnerInfo?.({
          userId: cached.userId,
          allowShuffle: typeof cached.allowShuffle === "boolean" ? cached.allowShuffle : null,
          shuffleEnabled: null,
        });
      }

      window.dispatchEvent(
        new CustomEvent("pinnedPlayerChanged", {
          detail: { isPinned: true, pinnedPlayer: cached },
        }),
      );
    } catch (error) {
      console.warn("[MiniPlayer] failed to restore pinned cache", error);
      clearPinnedPlayerCache();
    }
  }, []);
  
  useEffect(() => {
    const ownerId = globalPlayerOwner?.userId;
    applyPinnedShufflePreference(globalShuffleAllowed, ownerId);
  }, [applyPinnedShufflePreference, globalShuffleAllowed, globalPlayerOwner]);

  // 依照 Hooks 規則：所有 hooks 必須在每次 render 都被呼叫，
  // 因此不在條件分支中提前 return；改用條件渲染控制輸出。
  
  // 顯示邏輯：
  // 1. 如果釘選了 → 只要 currentUser 載入完成，就在全站顯示（不再受 miniPlayerEnabled / 頁面權限影響）
  // 2. 如果在用戶頁面 → 顯示（由頁面主人控制，只要 miniPlayerEnabled 為 true 就顯示）
  //    在用戶頁面時，即使 currentUser 還在載入中，只要 miniPlayerEnabled 為 true 就顯示
  // 3. shareMode === "page" 時顯示（用於分享頁，需要 miniPlayerEnabled 和 currentUser 載入完成）
  // 注意：在個人頁面，只要頁面主人有播放清單，就會設置 miniPlayerEnabled 為 true，所有人都可以看到
  const isPageModeActive = player?.shareMode === "page";
  // ✅ 在用戶頁面時，允許在 currentUser 載入中時也顯示（只要 miniPlayerEnabled 為 true）
  // ✅ 釘選狀態：不再受 miniPlayerEnabled 影響，只要 currentUser 已載入就顯示
  // ✅ 其他情況（非釘選的分享頁）需要等待 currentUser 載入完成
  const showMini = isPinned
    ? currentUser !== undefined // 只要登入狀態已知，就允許顯示釘選播放器
    : !!player?.miniPlayerEnabled &&
      (isUserPage || isPageModeActive) &&
      (isUserPage || currentUser !== undefined); // 用戶頁面不需要等待 currentUser，其他情況需要
  
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
    // ✅ 如果正在載入播放清單，立即返回空標題（避免顯示舊標題）
    // 無論播放清單是否為空，只要在載入中就不顯示標題
    if (isLoadingPlaylist) {
      return "";
    }
    
    const t = (player?.trackTitle || "").trim();
    const u = (player?.originUrl || player?.src || "").trim();
    if (t) return t;
    if (!u) return "未設定音源";
    return "未知音源";
  }, [player?.trackTitle, player?.originUrl, player?.src, isLoadingPlaylist, player?.playlist]);
  
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

  const isInteractiveTarget = (target) => {
    return target?.closest?.('[data-no-drag="true"]');
  };

  const startDrag = (clientX, clientY) => {
    if (typeof clientX !== "number" || typeof clientY !== "number") {
      return;
    }
    setDragStartTime(Date.now());
    dragStartPosRef.current = { x: position.x, y: position.y };
    const offsetX = clientX - position.x;
    const offsetY = clientY - position.y;
    setDragOffset({
      x: offsetX,
      y: offsetY,
    });
    dragOffsetRef.current = { x: offsetX, y: offsetY };
    setIsDragging(true);
    isDraggingRef.current = true;
  };

  const updateDrag = (clientX, clientY) => {
    if (!isDragging) return;
    if (typeof clientX !== "number" || typeof clientY !== "number") {
      return;
    }
    setPosition({
      x: clientX - dragOffset.x,
      y: clientY - dragOffset.y,
    });
  };

  const finishDrag = (clientX, clientY) => {
    if (!isDraggingRef.current) {
      return;
    }
    setIsDragging(false);
    isDraggingRef.current = false;
    try {
      const hasClient = typeof clientX === "number" && typeof clientY === "number";
      const finalX = hasClient
        ? clientX - (dragOffsetRef.current?.x || 0)
        : position.x;
      const finalY = hasClient
        ? clientY - (dragOffsetRef.current?.y || 0)
        : position.y;
      const dx = finalX - dragStartPosRef.current.x;
      const dy = finalY - dragStartPosRef.current.y;
      const moved = Math.hypot(dx, dy);
      if (moved >= 8) {
        justDraggedRef.current = true;
        setTimeout(() => {
          justDraggedRef.current = false;
        }, 250);
      }

      const margin = 16;
      const width = 140;
      const height = 200;
      const maxX = window.innerWidth - width - margin;
      const maxY = window.innerHeight - height - margin;

      const safeX = Math.max(margin, Math.min(finalX, maxX));
      const safeY = Math.max(margin, Math.min(finalY, maxY));

      if (safeX !== position.x || safeY !== position.y) {
        setPosition({ x: safeX, y: safeY });
      }

      localStorage.setItem(
        "miniPlayerPosition",
        JSON.stringify({ x: safeX, y: safeY }),
      );
    } catch {}
  };

  const handleMouseDown = (e) => {
    // 如果教學彈窗打開，禁用拖拽
    if (isTutorialOpen) {
      return;
    }
    if (isInteractiveTarget(e.target)) {
      return;
    }
    e.preventDefault();
    startDrag(e.clientX, e.clientY);
  };

  const handleMouseMove = (e) => {
    updateDrag(e.clientX, e.clientY);
  };

  const handleMouseUp = (e) => {
    if (!isDraggingRef.current) return;
    finishDrag(e?.clientX, e?.clientY);
  };

  const handleTouchStart = (e) => {
    // 如果教學彈窗打開，禁用拖拽
    if (isTutorialOpen) {
      return;
    }
    if (isInteractiveTarget(e.target)) {
      return;
    }
    if (!e.touches || e.touches.length === 0) return;
    const touch = e.touches[0];
    e.preventDefault();
    startDrag(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e) => {
    if (!e.touches || e.touches.length === 0) return;
    const touch = e.touches[0];
    e.preventDefault();
    updateDrag(touch.clientX, touch.clientY);
  };

  const handleTouchEnd = (e) => {
    if (!isDraggingRef.current) {
      return;
    }
    const touch =
      (e.changedTouches && e.changedTouches[0]) ||
      (e.touches && e.touches[0]) ||
      null;
    const clientX = touch ? touch.clientX : undefined;
    const clientY = touch ? touch.clientY : undefined;
    finishDrag(clientX, clientY);
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

  // 預設位置：右上角（留有安全距離）；若有已儲存位置則優先使用
  useEffect(() => {
    const initializePosition = () => {
      const margin = 16;
      const width = 140; // 與元件寬度一致
      const height = 80; // 播放器高度
      const safeOffset = 60; // ✅ 新增：額外的安全距離，避免太靠邊
      
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

      // 預設位置：右上角，但留有安全距離
      if (typeof window !== "undefined") {
        const x = Math.max(margin + safeOffset, window.innerWidth - width - margin - safeOffset);
        const y = margin + safeOffset;
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

  // 進度條拖動狀態
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);
  const progressDragStartRef = useRef(null);
  const progressDragOffsetRef = useRef(null);

  // 處理進度條點擊/拖動
  const handleProgressSeek = (e, clientX) => {
    if (!clientX && typeof clientX !== "number") {
      const point =
        (e.touches && e.touches[0]) ||
        (e.changedTouches && e.changedTouches[0]) ||
        e;
      if (!point || typeof point.clientX !== "number") {
        return;
      }
      clientX = point.clientX;
    }

    // ✅ 確保 target 是有效的 DOM 元素
    let target = e.currentTarget;
    if (!target || typeof target.getBoundingClientRect !== 'function') {
      // 如果 currentTarget 無效，嘗試從 target 查找
      target = e.target?.closest?.('[data-progress-bar]');
      if (!target || typeof target.getBoundingClientRect !== 'function') {
        console.warn("🔧 [進度條] 無法找到有效的目標元素");
        return;
      }
    }

    try {
      const rect = target.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, clickX / rect.width));
      
      if (player.duration > 0) {
        const newTime = percentage * player.duration;
        
        // 優先使用外部播放器控制
        if (player.externalControls && typeof player.externalControls.seekTo === 'function') {
          try {
            player.externalControls.seekTo(newTime);
          } catch (error) {
            console.error("❌ [進度條] 外部播放器跳轉失敗:", error);
            // 如果外部播放器跳轉失敗，嘗試本地播放器
            if (player.seekTo) {
              try {
                player.seekTo(newTime);
              } catch (localError) {
                console.error("🔧 本地播放器跳轉失敗:", localError);
              }
            }
          }
        } else if (player.seekTo) {
          try {
            player.seekTo(newTime);
          } catch (error) {
            console.error("🔧 本地播放器跳轉失敗:", error);
          }
        } else {
          console.warn("🔧 沒有可用的跳轉方法");
        }
      }
    } catch (error) {
      console.error("🔧 [進度條] 計算位置失敗:", error);
    }
  };

  // 處理進度條點擊（保持向後兼容）
  const handleButtonClick = (e) => {
    e.stopPropagation();
    if (e.cancelable) {
      e.preventDefault();
    }
    handleProgressSeek(e);
  };

  // 處理進度條拖動開始
  const handleProgressMouseDown = (e) => {
    e.stopPropagation();
    if (e.cancelable) {
      e.preventDefault();
    }

    const point =
      (e.touches && e.touches[0]) ||
      (e.changedTouches && e.changedTouches[0]) ||
      e;
    if (!point || typeof point.clientX !== "number") {
      return;
    }

    // ✅ 確保 target 是有效的 DOM 元素
    const target = e.currentTarget;
    if (!target || typeof target.getBoundingClientRect !== 'function') {
      console.warn("🔧 [進度條拖動] 無法找到有效的目標元素");
      return;
    }

    try {
      const rect = target.getBoundingClientRect();
      progressDragStartRef.current = {
        x: point.clientX,
        y: point.clientY,
        startTime: Date.now()
      };
      progressDragOffsetRef.current = {
        x: point.clientX - rect.left,
        y: point.clientY - rect.top
      };
      setIsDraggingProgress(true);

      // 立即處理點擊
      handleProgressSeek(e, point.clientX);
    } catch (error) {
      console.error("🔧 [進度條拖動] 開始失敗:", error);
    }
  };

  // 處理進度條拖動結束
  const handleProgressMouseUp = (e) => {
    if (!isDraggingProgress) return;
    
    const point =
      (e.touches && e.touches[0]) ||
      (e.changedTouches && e.changedTouches[0]) ||
      e;
    
    if (point && typeof point.clientX === "number") {
      handleProgressSeek(e, point.clientX);
    }

    setIsDraggingProgress(false);
    progressDragStartRef.current = null;
    progressDragOffsetRef.current = null;
  };

  // 處理進度條拖動移動
  useEffect(() => {
    if (!isDraggingProgress) return;

    const handleMove = (e) => {
      if (!progressDragStartRef.current) return;

      const point =
        (e.touches && e.touches[0]) ||
        (e.changedTouches && e.changedTouches[0]) ||
        e;
      
      if (!point || typeof point.clientX !== "number") return;

      // 阻止默認行為
      if (e.cancelable) {
        e.preventDefault();
      }
      e.stopPropagation();

      handleProgressSeek(e, point.clientX);
    };

    const handleEnd = (e) => {
      handleProgressMouseUp(e);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);
    document.addEventListener('touchcancel', handleEnd);

    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
      document.removeEventListener('touchcancel', handleEnd);
    };
  }, [isDraggingProgress, player]);

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

  const handleVolumeTouchStart = (e) => {
    if (!e.touches || e.touches.length === 0) return;
    const touch = e.touches[0];
    e.stopPropagation();
    e.preventDefault();
    setIsVolumeSliding(true);
    updateVolumeFromEvent(touch);
  };

  const handleVolumeTouchMove = (e) => {
    if (!isVolumeSliding || !e.touches || e.touches.length === 0) return;
    const touch = e.touches[0];
    e.preventDefault();
    updateVolumeFromEvent(touch);
  };

  const handleVolumeTouchEnd = (e) => {
    const touch =
      (e.changedTouches && e.changedTouches[0]) ||
      (e.touches && e.touches[0]) ||
      null;
    if (touch) {
      updateVolumeFromEvent(touch);
    }
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

  // ✅ 防抖：避免重複載入播放清單
  const isLoadingRef = useRef(false);
  const lastLoadTimeRef = useRef(0);
  const lastPlaylistLengthRef = useRef(-1);

  const loadPinnedPlayer = useCallback(async ({ force = false } = {}) => {
    if (!force && !needsPinnedRefreshRef.current) {
      return;
    }

    if (currentUser === undefined) {
      return;
    }

    if (currentUser === null) {
      return;
    }

    try {
      const userData = currentUser;

      if (userData?.user?.pinnedPlayer?.userId || userData?.pinnedPlayer?.userId) {
        const pinnedRaw = userData?.user?.pinnedPlayer || userData.pinnedPlayer;
        const pinned =
          pinnedRaw && typeof pinnedRaw === "object"
            ? {
                ...pinnedRaw,
                allowShuffle:
                  typeof pinnedRaw.allowShuffle === "boolean"
                    ? pinnedRaw.allowShuffle
                    : null,
                // ✅ 確保 expiresAt 是 Date 對象
                expiresAt: pinnedRaw.expiresAt ? new Date(pinnedRaw.expiresAt) : null,
              }
            : null;
        const now = new Date();
        const expiresAt = pinned?.expiresAt || null;

        if (expiresAt && expiresAt > now) {
          const pinnedUserId = String(pinned.userId || "");
          const isPinnedOwnPlayer =
            userData?._id && String(userData._id) === pinnedUserId;

          if (isPinnedOwnPlayer) {
            const nowTs = Date.now();
            if (isLoadingRef.current) {
              if (!isLoadingPlaylist) {
                setIsLoadingPlaylist(true);
              }
              return;
            }
            if (!force && nowTs - lastLoadTimeRef.current < 500) {
              setIsLoadingPlaylist(false);
              return;
            }

            setIsLoadingPlaylist(true);
            isLoadingRef.current = true;
            lastLoadTimeRef.current = nowTs;

            try {
              const response = await axios.get(
                `/api/user-info?id=${pinnedUserId}`,
                {
                  headers: { "Cache-Control": "no-cache" },
                },
              );
              const latestPlaylist = response.data?.playlist || [];
              const allowShuffleLatest =
                response.data?.playlistAllowShuffle ?? pinned.allowShuffle;
              pinned.allowShuffle =
                typeof allowShuffleLatest === "boolean"
                  ? allowShuffleLatest
                  : pinned.allowShuffle;

              if (
                latestPlaylist.length === lastPlaylistLengthRef.current &&
                playerRef.current?.playlist?.length === latestPlaylist.length
              ) {
                setIsLoadingPlaylist(false);
                isLoadingRef.current = false;
                return;
              }
              lastPlaylistLengthRef.current = latestPlaylist.length;

              if (playerRef.current) {
                playerRef.current.setPlayerOwner?.({
                  userId: pinned.userId,
                  username: pinned.username,
                  ...(typeof pinned.allowShuffle === "boolean"
                    ? { allowShuffle: pinned.allowShuffle }
                    : {}),
                });
                // 標記釘選擁有者（解除背景限制）
                playerRef.current.setPinnedOwnerInfo?.({
                  userId: pinned.userId,
                  allowShuffle: typeof pinned.allowShuffle === "boolean" ? pinned.allowShuffle : null,
                  shuffleEnabled: null,
                });

                if (Array.isArray(latestPlaylist)) {
                  playerRef.current.setPlaylist?.(latestPlaylist);

                  if (latestPlaylist.length > 0) {
                    const track = latestPlaylist[0];
                    if (track?.url) {
                      playerRef.current.setActiveIndex?.(0);
                      playerRef.current.setOriginUrl?.(track.url);
                      playerRef.current.setTrackTitle?.(track.title || "");
                      playerRef.current.setSrc?.(track.url);
                    }
                  } else {
                    playerRef.current.pause?.();
                    playerRef.current.setIsPlaying?.(false);
                    playerRef.current.setSrc?.("");
                    playerRef.current.setOriginUrl?.("");
                    playerRef.current.setTrackTitle?.("");
                    playerRef.current.setActiveIndex?.(0);
                  }
                }
                if (typeof pinned.allowShuffle === "boolean") {
                  playerRef.current.setShuffleAllowed?.(pinned.allowShuffle);
                  applyPinnedShufflePreference(pinned.allowShuffle, pinned.userId);
                }
              }
              setIsLoadingPlaylist(false);
            } catch (error) {
              if (!isAuthError(error)) {
                console.error("載入自己的播放清單失敗，使用釘選記錄:", error);
              }
              if (playerRef.current) {
                playerRef.current.setPlayerOwner?.({
                  userId: pinned.userId,
                  username: pinned.username,
                  ...(typeof pinned.allowShuffle === "boolean"
                    ? { allowShuffle: pinned.allowShuffle }
                    : {}),
                });
                // 標記釘選擁有者（解除背景限制）
                playerRef.current.setPinnedOwnerInfo?.({
                  userId: pinned.userId,
                  allowShuffle: typeof pinned.allowShuffle === "boolean" ? pinned.allowShuffle : null,
                  shuffleEnabled: null,
                });
                if (Array.isArray(pinned.playlist)) {
                  playerRef.current.setPlaylist?.(pinned.playlist);

                  if (pinned.playlist.length === 0) {
                    playerRef.current.pause?.();
                    playerRef.current.setIsPlaying?.(false);
                    playerRef.current.setSrc?.("");
                    playerRef.current.setOriginUrl?.("");
                    playerRef.current.setTrackTitle?.("");
                    playerRef.current.setActiveIndex?.(0);
                  }
                }
                if (typeof pinned.allowShuffle === "boolean") {
                  playerRef.current.setShuffleAllowed?.(pinned.allowShuffle);
                  applyPinnedShufflePreference(pinned.allowShuffle, pinned.userId);
                }
              }
              setIsLoadingPlaylist(false);
            }

            setIsPinned(true);
            // ✅ 確保使用最新的 expiresAt（從 currentUser.pinnedPlayer 獲取）
            setPinnedPlayerData({ 
              ...pinned,
              expiresAt: pinned.expiresAt ? new Date(pinned.expiresAt) : null
            });
            // 更新緩存
            writePinnedPlayerCache({ 
              ...pinned,
              expiresAt: pinned.expiresAt ? new Date(pinned.expiresAt) : null
            });
            isLoadingRef.current = false;
            return;
          }

          setIsPinned(true);
          // ✅ 確保使用最新的 expiresAt（從 currentUser.pinnedPlayer 獲取）
          setPinnedPlayerData({ 
            ...pinned,
            expiresAt: pinned.expiresAt ? new Date(pinned.expiresAt) : null
          });
          // 更新緩存
          writePinnedPlayerCache({ 
            ...pinned,
            expiresAt: pinned.expiresAt ? new Date(pinned.expiresAt) : null
          });

          window.dispatchEvent(
            new CustomEvent("pinnedPlayerChanged", {
              detail: {
                isPinned: true,
                pinnedPlayer: pinned,
              },
            }),
          );

          if (playerRef.current) {
            playerRef.current.setMiniPlayerEnabled?.(true);
            playerRef.current.setPlayerOwner?.({
              userId: pinned.userId,
              username: pinned.username,
              ...(typeof pinned.allowShuffle === "boolean"
                ? { allowShuffle: pinned.allowShuffle }
                : {}),
            });
            // 標記釘選擁有者（解除背景限制）
            playerRef.current.setPinnedOwnerInfo?.({
              userId: pinned.userId,
              allowShuffle: typeof pinned.allowShuffle === "boolean" ? pinned.allowShuffle : null,
              shuffleEnabled: null,
            });

            if (Array.isArray(pinned.playlist)) {
              playerRef.current.setPlaylist?.(pinned.playlist);

              if (pinned.playlist.length > 0) {
                const currentIndex = pinned.currentIndex || 0;
                const track = pinned.playlist[currentIndex];

                if (track?.url) {
                  playerRef.current.setActiveIndex?.(currentIndex);
                  playerRef.current.setSrc?.(track.url);
                  playerRef.current.setOriginUrl?.(track.url);
                  playerRef.current.setTrackTitle?.(track.title || "");
                }
              } else {
                playerRef.current.pause?.();
                playerRef.current.setIsPlaying?.(false);
                playerRef.current.setSrc?.("");
                playerRef.current.setOriginUrl?.("");
                playerRef.current.setTrackTitle?.("");
                playerRef.current.setActiveIndex?.(0);
              }
            }
            if (typeof pinned.allowShuffle === "boolean") {
              playerRef.current.setShuffleAllowed?.(pinned.allowShuffle);
              applyPinnedShufflePreference(pinned.allowShuffle, pinned.userId);
            }
          }
        } else if (expiresAt && expiresAt <= now) {
          await axios.delete("/api/player/pin");
          setIsPinned(false);
          setPinnedPlayerData(null);
        }
      } else {
        setIsPinned(false);
        setPinnedPlayerData(null);
        setIsLoadingPlaylist(false);
        if (playerRef.current) {
          playerRef.current.setShuffleAllowed?.(false);
          playerRef.current.setShuffleEnabled?.(false);
        }
      }
    } catch (error) {
      if (!isAuthError(error)) {
        console.error("載入釘選播放器失敗:", error);
      }
      setIsLoadingPlaylist(false);
    } finally {
      isLoadingRef.current = false;
      if (
        playerRef.current?.trackTitle ||
        playerRef.current?.originUrl ||
        playerRef.current?.src
      ) {
        setIsLoadingPlaylist(false);
      }
      needsPinnedRefreshRef.current = false;
    }
  }, [
    currentUser,
    isLoadingPlaylist,
    setIsLoadingPlaylist,
    playerRef,
    setIsPinned,
    setPinnedPlayerData,
  ]);

  useEffect(() => {
    needsPinnedRefreshRef.current = true;
  }, [currentUser?._id]);

  // ✅ 監聽 currentUser.pinnedPlayer.expiresAt 的變化，強制更新 pinnedPlayerData
  useEffect(() => {
    if (!currentUser) return;
    
    const currentExpiresAt = currentUser?.pinnedPlayer?.expiresAt 
      ? new Date(currentUser.pinnedPlayer.expiresAt).getTime()
      : null;
    const displayedExpiresAt = pinnedPlayerData?.expiresAt 
      ? new Date(pinnedPlayerData.expiresAt).getTime()
      : null;
    
    // ✅ 優先使用 subscriptions 的 expiresAt（如果存在），因為它是最新的
    const subscriptionsExpiresAt = subscriptions?.pinPlayer?.expiresAt 
      ? new Date(subscriptions.pinPlayer.expiresAt).getTime()
      : null;
    
    
    // ✅ 優先使用 subscriptions 的 expiresAt（如果存在），因為它是最新的
    let targetExpiresAt = currentExpiresAt;
    if (subscriptionsExpiresAt && (!targetExpiresAt || subscriptionsExpiresAt > targetExpiresAt)) {
      targetExpiresAt = subscriptionsExpiresAt;
    }
    
    // 如果 targetExpiresAt 與顯示的不同，強制更新
    if (targetExpiresAt && displayedExpiresAt && targetExpiresAt !== displayedExpiresAt) {
      setPinnedPlayerData(prev => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          expiresAt: new Date(targetExpiresAt)
        };
        writePinnedPlayerCache(updated);
        return updated;
      });
    } else if (targetExpiresAt && !displayedExpiresAt && isPinned) {
      // 如果有 targetExpiresAt 但沒有顯示的，也更新
      setPinnedPlayerData(prev => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          expiresAt: new Date(targetExpiresAt)
        };
        writePinnedPlayerCache(updated);
        return updated;
      });
    }
  }, [currentUser?.pinnedPlayer?.expiresAt, subscriptions?.pinPlayer?.expiresAt, isPinned, pinnedPlayerData]);

  useEffect(() => {
    needsPinnedRefreshRef.current = true;
  }, [pathname]);

  // 檢查釘選狀態並載入釘選的播放清單（使用 Context 中的 currentUser）
  useEffect(() => {
    if (currentUser === undefined) {
      return;
    }

    loadPinnedPlayer({ force: false });
  }, [currentUser, pathname, loadPinnedPlayer]);

  useEffect(() => {
    const handlePlaylistChanged = () => {
      isLoadingRef.current = false;
      lastLoadTimeRef.current = 0;
      lastPlaylistLengthRef.current = -1;
      needsPinnedRefreshRef.current = true;
      loadPinnedPlayer({ force: true });
    };

    window.addEventListener("playlistChanged", handlePlaylistChanged);
    return () => {
      window.removeEventListener("playlistChanged", handlePlaylistChanged);
    };
  }, [loadPinnedPlayer]);
  
  // 監聽訂閱續費事件（當用戶續費時更新 pinnedPlayer.expiresAt）
  useEffect(() => {
    const handleSubscriptionRenewed = (e) => {
      if (e.detail.subscriptionType === 'pinPlayer') {
        // 即使 isPinned 為 false，也先更新數據，因為用戶可能已經釘選了
        const newExpiresAt = new Date(e.detail.expiresAt);
        
        // 如果已經有 pinnedPlayerData，直接更新
        if (pinnedPlayerData) {
          setPinnedPlayerData(prev => {
            if (!prev) {
              return prev;
            }
            const updated = {
              ...prev,
              expiresAt: newExpiresAt
            };
            // 更新緩存
            writePinnedPlayerCache(updated);
            return updated;
          });
        } else {
          // 如果還沒有 pinnedPlayerData，強制重新載入
          loadPinnedPlayer({ force: true });
        }
      }
    };
    
    window.addEventListener("subscriptionRenewed", handleSubscriptionRenewed);
    return () => {
      window.removeEventListener("subscriptionRenewed", handleSubscriptionRenewed);
    };
  }, [isPinned, pinnedPlayerData, loadPinnedPlayer]);

  // 監聽釘選變更事件（當用戶主動釘選/取消釘選時）
  useEffect(() => {
    const handlePinnedChange = (e) => {
      
      if (e.detail.isPinned) {
        setIsPinned(true);
        const pinnedData = e.detail.pinnedPlayer || {
          userId: e.detail.userId,
          username: e.detail.username,
          playlist: e.detail.playlist,
          currentIndex: 0,
          expiresAt: e.detail.expiresAt,
          allowShuffle: !!e.detail.allowShuffle,
        };
        if (typeof pinnedData.allowShuffle !== "boolean") {
          pinnedData.allowShuffle = null;
        }
        setPinnedPlayerData({ ...pinnedData });
        const ownerId = pinnedData.userId;
        const allowShuffle = pinnedData.allowShuffle;
        
        
        // 當收到釘選事件時，也載入歌單
        if (playerRef.current) {
          playerRef.current.setMiniPlayerEnabled?.(true);
          // ✅ 設置 playerOwner，帶上 allowShuffle（如有）
          const ownerPayload = {
            userId: pinnedData.userId,
            username: pinnedData.username,
          };
          if (typeof allowShuffle === "boolean") {
            ownerPayload.allowShuffle = allowShuffle;
          }
          playerRef.current.setPlayerOwner?.(ownerPayload);
          // 標記釘選擁有者（解除背景限制）
          playerRef.current.setPinnedOwnerInfo?.({
            userId: pinnedData.userId,
            allowShuffle: typeof allowShuffle === "boolean" ? allowShuffle : null,
            shuffleEnabled: null,
          });
          
          // ✅ 設置播放清單（即使是空的）
          if (Array.isArray(pinnedData.playlist)) {
            playerRef.current.setPlaylist?.(pinnedData.playlist);
            
            // ✅ 只有當播放清單不為空時，才設置當前曲目
            if (pinnedData.playlist.length > 0) {
              const currentIndex = pinnedData.currentIndex || 0;
              const track = pinnedData.playlist[currentIndex];
              
              if (track?.url) {
                playerRef.current.setActiveIndex?.(currentIndex);
                playerRef.current.setSrc?.(track.url);
                playerRef.current.setOriginUrl?.(track.url);
                playerRef.current.setTrackTitle?.(track.title || '');
              }
            } else {
              // ✅ 播放清單為空時，停止播放並清空音頻源
              playerRef.current.pause?.();
              playerRef.current.setIsPlaying?.(false);
              playerRef.current.setSrc?.('');
              playerRef.current.setOriginUrl?.('');
              playerRef.current.setTrackTitle?.('');
              playerRef.current.setActiveIndex?.(0);
            }
          }

          if (typeof allowShuffle === "boolean") {
            playerRef.current.setShuffleAllowed?.(allowShuffle);
            applyPinnedShufflePreference(allowShuffle, ownerId);
          }
        } else {
        }

        needsPinnedRefreshRef.current = false;
      } else {
        setIsPinned(false);
        setPinnedPlayerData(null);
        if (playerRef.current) {
          playerRef.current.setShuffleAllowed?.(false);
          playerRef.current.setShuffleEnabled?.(false);
          playerRef.current.setPlayerOwner?.(null);
          // 清除釘選擁有者（恢復背景限制）
          playerRef.current.setPinnedOwnerInfo?.(null);
        }
        clearPinnedPlayerCache();
        needsPinnedRefreshRef.current = false;
      }
    };
    
    // ✅ 監聽登出事件，清理播放器狀態
    const handleLogout = () => {
      const ref = playerRef.current;
      if (ref) {
        ref.setMiniPlayerEnabled?.(false);
        ref.pause?.();
        ref.setPlaylist?.([]);
        ref.setActiveIndex?.(0);
        ref.setPinnedOwnerInfo?.(null);
        ref.setPlayerOwner?.(null);
        setIsPinned(false);
        setPinnedPlayerData(null);
      }
    };
    
    window.addEventListener('pinnedPlayerChanged', handlePinnedChange);
    window.addEventListener('userLogout', handleLogout);
    
    return () => {
      window.removeEventListener('pinnedPlayerChanged', handlePinnedChange);
      window.removeEventListener('userLogout', handleLogout);
    };
  }, []);

  // 全域監聽滑鼠事件
  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.addEventListener("touchmove", handleTouchMove, { passive: false });
      document.addEventListener("touchend", handleTouchEnd);
      document.addEventListener("touchcancel", handleTouchEnd);
    }
    if (isVolumeSliding) {
      document.addEventListener("mousemove", handleVolumeMouseMove);
      document.addEventListener("mouseup", handleVolumeMouseUp);
      document.addEventListener("touchmove", handleVolumeTouchMove, { passive: false });
      document.addEventListener("touchend", handleVolumeTouchEnd);
      document.addEventListener("touchcancel", handleVolumeTouchEnd);
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousemove", handleVolumeMouseMove);
      document.removeEventListener("mouseup", handleVolumeMouseUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("touchcancel", handleTouchEnd);
      document.removeEventListener("touchmove", handleVolumeTouchMove);
      document.removeEventListener("touchend", handleVolumeTouchEnd);
      document.removeEventListener("touchcancel", handleVolumeTouchEnd);
    };
  }, [isDragging, isVolumeSliding]);

  // ✅ 當播放器隱藏時（未釘選且離開用戶頁面），停止播放並觸發暫停事件
  useEffect(() => {
    if (!showMini && !isPinned && player?.shareMode !== "page" && player?.isPlaying) {
      // 調用 player.pause()，觸發 playerStateChanged 事件（記錄為暫停狀態）
      player?.pause?.();
    }
  }, [showMini, isPinned, player]);

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
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div className="flex flex-col items-center space-y-3">
        {/* 釘選狀態提示（如果有釘選） */}
        {isPinned && pinnedPlayerData && (
          <div className="w-[140px] h-6 rounded bg-purple-600/90 text-white text-xs overflow-hidden flex items-center justify-between px-2">
            <div className="flex items-center truncate flex-1">
              <span className="mr-1">📌</span>
              <span className="truncate">@{pinnedPlayerData.username}</span>
              <span className="ml-1 text-[10px] opacity-75 flex-shrink-0">
                ({(() => {
                  // ✅ 確保 expiresAt 是 Date 對象
                  const expiresAt = pinnedPlayerData.expiresAt instanceof Date 
                    ? pinnedPlayerData.expiresAt 
                    : new Date(pinnedPlayerData.expiresAt);
                  const now = new Date();
                  const diffMs = expiresAt.getTime() - now.getTime();
                  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                  return days > 10000 ? '永久' : `${days}天`;
                })()})
              </span>
            </div>
            <button
              data-no-drag="true"
              onClick={async (e) => {
                e.stopPropagation();
                const confirmed = await notify.confirm("確認解除釘選", "確定要解除釘選嗎？");
                if (confirmed) {
                  try {
                    await axios.delete('/api/player/pin');
                    setIsPinned(false);
                    setPinnedPlayerData(null);
                    
                    // 同步 CurrentUserContext：移除 pinnedPlayer，避免頁面效果又啟用播放器（兩層都要移除）
                    setCurrentUser?.((prev) => {
                      if (!prev) return prev;
                      // 移除根層級的 pinnedPlayer
                      const { pinnedPlayer, ...rest } = prev;
                      // 如果還有 user 層級，也要移除
                      if (rest.user && rest.user.pinnedPlayer) {
                        const { pinnedPlayer: userPinnedPlayer, ...userRest } = rest.user;
                        return { ...rest, user: userRest };
                      }
                      return rest;
                    });
                    
                    // 暫停播放器並清除狀態，讓當前頁面重新載入播放清單
                    if (playerRef.current) {
                      playerRef.current.pause?.();
                      // 清除 src，強制重新載入
                      playerRef.current.setSrcWithAudio?.('', [], 0, '');
                      // 禁用播放器，確保 MiniPlayer 消失
                      playerRef.current.setMiniPlayerEnabled?.(false);
                      // 清除釘選擁有者（恢復背景限制）
                      playerRef.current.setPinnedOwnerInfo?.(null);
                    }
                    
                    window.dispatchEvent(new CustomEvent('pinnedPlayerChanged', { 
                      detail: { isPinned: false } 
                    }));
                  } catch (error) {
                    if (!isAuthError(error)) {
                      console.error('解除釘選失敗:', error);
                    }
                    notify.error("解除釘選失敗", getApiErrorMessage(error, "解除釘選播放器時發生錯誤"));
                  }
                }
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
              }}
              className="ml-1 text-white/70 hover:text-white transition-colors flex-shrink-0"
              title="解除釘選"
            >
              ✕
            </button>
          </div>
        )}
        
        {/* 黑色跑馬燈（曲名 + 可點連結） */}
        {displayTitle && (
          <div
            className="w-[140px] h-6 rounded bg-black/80 text-white text-xs overflow-hidden flex items-center px-2 cursor-pointer"
            title={player.originUrl || player.src || "未設定來源"}
            data-no-drag="true"
            onClick={(e) => {
              e.stopPropagation();
              if (justDraggedRef.current) return; // 如果剛拖動過，不要打開連結
              
              // 嘗試從播放器獲取當前音樂 ID
              let musicId = null;
              
              // 方法1: 從 playlist 和 activeIndex 獲取
              if (player?.playlist && Array.isArray(player.playlist) && typeof player.activeIndex === 'number') {
                const currentTrack = player.playlist[player.activeIndex];
                if (currentTrack?._id) {
                  musicId = currentTrack._id;
                }
              }
              
              // 方法2: 從 URL 中提取音樂 ID
              if (!musicId) {
                const url = player.originUrl || player.src || "";
                if (url && url.includes("/api/music/stream/")) {
                  const match = url.match(/\/api\/music\/stream\/([^/?]+)/);
                  if (match && match[1]) {
                    musicId = match[1];
                  }
                }
              }
              
              // 如果有音樂 ID，打開音樂彈窗
              if (musicId) {
                router.push(`/music?id=${musicId}`);
              }
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
            }}
          >
            <div
              className="inline-block whitespace-nowrap"
              style={{
                animation: "miniMarquee 12s linear infinite",
              }}
              key={displayTitle} // ✅ 當標題變化時重新渲染跑馬燈
            >
              {displayTitle}
            </div>
          </div>
        )}

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
            // ✅ 如果點擊的是進度條，不要處理展開/收合
            if (e.target.closest('[data-progress-bar]')) {
              return;
            }
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
          {/* ✅ 只要有 playerOwner 就顯示釘選按鈕，即使播放清單為空（用戶可能想釘選空播放清單） */}
          {player?.playerOwner && (
            <div className="absolute top-2 left-2 z-10" data-no-drag="true">
              <PinPlayerButton
                targetUserId={player.playerOwner.userId}
                targetUserPlaylist={player.playlist || []}
                targetUsername={player.playerOwner.username}
              />
            </div>
          )}
 
          {/* 教學按鈕 - 在播放器圖示右上方 */}
          <button
            data-no-drag="true"
            onClick={(e) => {
              e.stopPropagation();
              setIsTutorialOpen(true);
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
            }}
            className="absolute top-2 right-2 z-10 w-6 h-6 flex items-center justify-center rounded-full bg-blue-600/80 border border-blue-400/50 text-white hover:bg-blue-500/80 transition-all duration-200 backdrop-blur-sm shadow hover:scale-110"
            title="播放器使用教學"
          >
            <span className="text-xs font-bold">?</span>
          </button>

          {globalShuffleAllowed && currentPlaylistLength > 1 && (
            <button
              data-no-drag="true"
              onClick={(e) => {
                e.stopPropagation();
                handleShuffleButtonClick();
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
              }}
              className={`absolute bottom-4 right-2 z-10 w-6 h-6 flex items-center justify-center rounded-full border transition-all duration-200 backdrop-blur-sm shadow
                ${globalShuffleEnabled
                  ? "bg-purple-600/80 border-purple-300 text-white hover:bg-purple-500/80"
                  : "bg-black/60 border-white/20 text-gray-200 hover:text-white hover:bg-black/70"}
              `}
              title={
                globalShuffleEnabled
                  ? "隨機播放：開（點擊關閉）"
                  : "隨機播放：關（點擊啟用）"
              }
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="16 3 21 3 21 8"></polyline>
                <line x1="4" y1="20" x2="21" y2="3"></line>
                <polyline points="21 16 21 21 16 21"></polyline>
                <line x1="15" y1="15" x2="21" y2="21"></line>
                <line x1="4" y1="4" x2="9" y2="9"></line>
              </svg>
            </button>
          )}
 
          {/* 播放進度條：置於唱片下方居中顯示 */}
          {showProgressBar && (
            <div
              className="absolute cursor-pointer"
              data-progress-bar="true"
              style={{
                left: '50%',
                transform: 'translateX(-50%)',
                bottom: '5px',
                width: '90px',
                height: '4px',
                background: 'rgba(0,0,0,0.10)',
                borderRadius: '3px',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.12)',
                zIndex: 20,
                pointerEvents: 'auto'
              }}
              data-no-drag="true"
              onMouseDown={(e) => {
                e.stopPropagation();
                handleProgressMouseDown(e);
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                handleProgressMouseDown(e);
              }}
              onClick={(e) => {
                e.stopPropagation();
              }}
              aria-label="播放進度"
              title={`進度: ${Math.round(safePercentage)}%`}
            >
              <div
                style={{
                  width: `${safePercentage}%`,
                  height: '100%',
                  borderRadius: '3px',
                  background: `linear-gradient(to right, ${palette.accent1}, ${palette.accent2})`,
                  transition: isDraggingProgress ? 'none' : 'width 0.15s ease',
                  pointerEvents: 'none'
                }}
              />
              {/* 拖動點 */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
                style={{
                  left: `calc(${safePercentage}% - 4px)`,
                  opacity: isDraggingProgress ? 1 : 0
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
              data-no-drag="true"
              title={`音量: ${Math.round(player.volume * 100)}%`}
              onMouseEnter={handleVolumeMouseEnter}
              onMouseLeave={handleVolumeMouseLeave}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleVolumeMouseDown(e);
              }}
              onTouchStart={(e) => {
                handleVolumeTouchStart(e);
              }}
              onTouchMove={handleVolumeTouchMove}
              onTouchEnd={handleVolumeTouchEnd}
              onTouchCancel={handleVolumeTouchEnd}
            >
              <div 
                ref={volumeSliderRef}
                data-no-drag="true"
                onMouseDown={handleVolumeMouseDown}
                onTouchStart={handleVolumeTouchStart}
                onTouchMove={handleVolumeTouchMove}
                onTouchEnd={handleVolumeTouchEnd}
                onTouchCancel={handleVolumeTouchEnd}
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
              data-no-drag="true"
              onClick={(e) => {
                e.stopPropagation();
                handlePrevious();
              }}
              onMouseDown={(e) => { e.stopPropagation(); }}
              onTouchStart={(e) => { e.stopPropagation(); }}
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
              data-no-drag="true"
              onClick={async (e) => {
                e.stopPropagation();
                if (player.isPlaying) {
                  player.pause();
                } else {
                  await player.play();
                }
              }}
              onMouseDown={(e) => { e.stopPropagation(); }}
              onTouchStart={(e) => { e.stopPropagation(); }}
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
              data-no-drag="true"
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              onMouseDown={(e) => { e.stopPropagation(); }}
              onTouchStart={(e) => { e.stopPropagation(); }}
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
      
      {/* 教學彈窗 */}
      <PlayerTutorialModal
        isOpen={isTutorialOpen}
        onClose={() => setIsTutorialOpen(false)}
      />
    </div>
  );
}