"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import axios from "axios";
import { usePlayer } from "@/components/context/PlayerContext";
import dynamic from "next/dynamic";
import PlaylistModal from "@/components/player/PlaylistModal";
import { useCurrentUser } from "@/contexts/CurrentUserContext";
import MiniPlayerArt from "@/components/common/MiniPlayerArt";
import AudioMonitor from "@/components/common/AudioMonitor";
import PlayerSkinSettings from "@/components/player/PlayerSkinSettings";
import CatHeadphoneCanvas from "@/components/player/CatHeadphoneCanvas";
import CassettePlayerCanvas from "@/components/player/CassettePlayerCanvas";
import { notify } from "@/components/common/GlobalNotificationManager";

export default function UserPlayerPage() {
  const { id } = useParams();
  const player = usePlayer();
  const { currentUser, setCurrentUser } = useCurrentUser() || {};
  const isOwner = !!(currentUser && String(currentUser._id) === String(id));
  
  // 調試登入狀態
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userData, setUserData] = useState(null);
  // 使用 PlayerContext 的播放清單狀態
  const {
    playlist,
    setPlaylist,
    activeIndex,
    setActiveIndex,
    shuffleAllowed,
    setShuffleAllowed,
    shuffleEnabled,
    setShuffleEnabled,
    playerOwner,
  } = player;
  
  // ✅ 防止並發保存請求相互覆蓋
  const savingRef = useRef(false); // 是否正在保存
  const pendingPlaylistRef = useRef(null); // 待保存的播放清單（最新版本）
  const saveVersionRef = useRef(0); // 保存版本計數器
  
  // 使用 PlayerContext 的狀態作為主要狀態
  const currentTrack = playlist[activeIndex];
  const isCurrentTrackPlaying = player.isPlaying && player.originUrl === currentTrack?.url;
  const [modalOpen, setModalOpen] = useState(false);
  const [updatingShufflePermission, setUpdatingShufflePermission] = useState(false);
  const shuffleStorageKey = id ? `playlist_${id}_shuffle` : null;

  const applyShufflePreference = useCallback(
    (allow) => {
      if (!setShuffleEnabled) {
        return;
      }

      if (allow === false) {
        setShuffleEnabled(false);
        if (shuffleStorageKey) {
          try {
            localStorage.removeItem(shuffleStorageKey);
          } catch (error) {
            console.warn("移除隨機播放設定失敗:", error);
          }
        }
        return;
      }

      if (allow !== true) {
        return;
      }

      if (!shuffleStorageKey) {
        setShuffleEnabled(false);
        return;
      }

      let shouldEnable = false;
      try {
        shouldEnable = localStorage.getItem(shuffleStorageKey) === "1";
      } catch (error) {
        console.warn("讀取隨機播放設定失敗:", error);
      }

      setShuffleEnabled(shouldEnable);
    },
    [setShuffleEnabled, shuffleStorageKey],
  );

  const handleShuffleToggle = useCallback(() => {
    if (!shuffleAllowed || playlist.length === 0) {
      return;
    }
    const next = !shuffleEnabled;
    setShuffleEnabled(next);
    if (!shuffleStorageKey) {
      return;
    }
    try {
      if (next) {
        localStorage.setItem(shuffleStorageKey, "1");
      } else {
        localStorage.removeItem(shuffleStorageKey);
      }
    } catch (error) {
      console.warn("保存隨機播放設定失敗:", error);
    }
  }, [shuffleAllowed, shuffleEnabled, setShuffleEnabled, shuffleStorageKey, playlist.length]);

  const handleAllowShuffleToggle = useCallback(async () => {
    if (!isOwner || updatingShufflePermission) {
      return;
    }

    const next = !userData?.playlistAllowShuffle;
    setUpdatingShufflePermission(true);

    try {
      await axios.patch("/api/player/shuffle-settings", { allowShuffle: next });

      setUserData((prev) => (prev ? { ...prev, playlistAllowShuffle: next } : prev));
      setCurrentUser?.((prev) => (prev ? { ...prev, playlistAllowShuffle: next } : prev));

      const ownerUsername =
        userData?.username ||
        playerOwner?.username ||
        currentUser?.username ||
        "";

      player.setPlayerOwner?.({
        ...(playerOwner || {}),
        userId: id,
        username: ownerUsername,
        ...(typeof next === "boolean" ? { allowShuffle: next } : {}),
      });

      applyShufflePreference(next);

      notify.success(next ? "已允許訪客隨機播放歌單" : "已禁止訪客隨機播放歌單");
    } catch (error) {
      console.error("更新隨機播放權限失敗:", error);
      notify.error("更新隨機播放權限失敗", error.response?.data?.error || error.message);
    } finally {
      setUpdatingShufflePermission(false);
    }
  }, [
    applyShufflePreference,
    currentUser?.username,
    id,
    isOwner,
    player,
    playerOwner,
    setCurrentUser,
    updatingShufflePermission,
    userData?.playlistAllowShuffle,
    userData?.username,
  ]);
  
  // 從後端 API 載入用戶的播放清單
  useEffect(() => {
    // ✅ 添加 AbortController 來取消請求，防止內存泄漏
    const abortController = new AbortController();
    
    const fetchPlaylist = async () => {
      try {
        // ✅ 檢查是否有釘選的播放器，但只有在不是自己的頁面時才跳過
        // 如果是自己的頁面（id === currentUser._id），應該載入自己的播放清單，不受釘選影響
        const isOwnPage = currentUser && String(currentUser._id) === String(id);
        const hasPinnedPlayer = currentUser?.pinnedPlayer?.userId;
        const isPinnedThisPage = hasPinnedPlayer && String(currentUser.pinnedPlayer.userId) === String(id);
        const preservePinnedPlayback = !isOwnPage && isPinnedThisPage;
        
        // 只有在不是自己的頁面，且釘選的是其他用戶的播放器時，才跳過載入
        if (hasPinnedPlayer && !isOwnPage && !isPinnedThisPage) {
          setLoading(false);
          return; // 不覆蓋其他用戶的釘選播放器
        }
        
        // 啟用小播放器
        player.setMiniPlayerEnabled?.(true);
        
        // 清理可能存在的播放器狀態衝突
        if (window.__AUTO_PLAY_TRIGGERED__) {
          delete window.__AUTO_PLAY_TRIGGERED__;
        }
        if (window.__PERSISTENT_AUTO_PLAY__) {
          delete window.__PERSISTENT_AUTO_PLAY__;
        }
        
        // 重置播放器狀態，確保乾淨的開始
        // 從 API 獲取該用戶的資料（包含播放清單）
        let userDataFetched = {};
        try {
          const response = await axios.get(`/api/user-info?id=${id}`, {
            headers: { 'Cache-Control': 'no-cache' },
            signal: abortController.signal // ✅ 添加 signal 以支持取消
          });
          userDataFetched = response.data;
          setUserData(userDataFetched); // 保存用戶數據用於釘選按鈕
          
          const allowShuffleValue = userDataFetched.playlistAllowShuffle;
          const allowShuffleIsBoolean = typeof allowShuffleValue === "boolean";
          if (userDataFetched.username) {
            player.setPlayerOwner?.({
              userId: id,
              username: userDataFetched.username,
              ...(allowShuffleIsBoolean
                ? { allowShuffle: allowShuffleValue }
                : {}),
            });
          } else if (allowShuffleIsBoolean) {
            setShuffleAllowed?.(allowShuffleValue);
          }
          applyShufflePreference(allowShuffleIsBoolean ? allowShuffleValue : null);
        } catch (error) {
          // ✅ 檢查是否是被取消的請求
          if (error.name === 'CanceledError' || error.message === 'canceled' || abortController.signal.aborted) {
            return; // 請求被取消，直接返回，不處理錯誤
          }
          console.error("獲取用戶資料失敗:", error.message);
          userDataFetched = {}; // 使用空物件作為備用
        }
        
             // 🏗️ 理想架構：數據庫為主，localStorage為進度，PlayerContext為UI
             let finalPlaylist = [];
             
             // 1. 優先從數據庫載入播放清單（主要存儲）
             // ✅ 檢查數據庫中是否有播放清單（即使是空數組也要使用，表示用戶已清空）
             if (userDataFetched.playlist !== undefined && userDataFetched.playlist !== null) {
               // 數據庫中有播放清單（可能是空數組），使用它
               finalPlaylist = Array.isArray(userDataFetched.playlist) ? userDataFetched.playlist : [];
             } else {
               // 2. 數據庫沒有播放清單欄位，檢查 localStorage（備用存儲）
               const localPlaylist = localStorage.getItem(`playlist_${id}`);
               if (localPlaylist) {
                 try {
                   const parsedPlaylist = JSON.parse(localPlaylist);
                   if (Array.isArray(parsedPlaylist)) {
                     finalPlaylist = parsedPlaylist;
                   }
                 } catch (error) {
                   console.error("解析播放清單失敗:", error);
                 }
               }
             }
             
             // 3. 從 localStorage 載入播放進度（用戶偏好）
             const savedActiveIndex = localStorage.getItem(`playlist_${id}_activeIndex`);
             const savedVolume = localStorage.getItem(`playlist_${id}_volume`);
             const savedProgress = localStorage.getItem(`playlist_${id}_progress`);
             
             if (finalPlaylist.length > 0) {
               // 🏗️ 理想架構實現
               
               // 1. 設置播放清單到 PlayerContext（UI狀態）
               setPlaylist(finalPlaylist);
               
               // 2. 從 localStorage 載入播放進度（用戶偏好）
               const activeIndex = savedActiveIndex ? parseInt(savedActiveIndex) : 0;
               const currentItem = finalPlaylist[activeIndex] || finalPlaylist[0];
               const hasExistingSource = Boolean(player?.src || player?.originUrl);
               
               // 3. 同步到 PlayerContext（UI狀態管理）
               if (!preservePinnedPlayback && currentItem?.url && !hasExistingSource) {
                 player.setSrc?.(currentItem.url);
                 player.setOriginUrl?.(currentItem.url);
                 player.setTrackTitle?.(currentItem.title);
               }
               setActiveIndex(activeIndex);
               
               // 4. 恢復用戶偏好（音量等）
               if (!preservePinnedPlayback && savedVolume) {
                 try {
                   const volume = parseFloat(savedVolume);
                   if (!isNaN(volume) && volume >= 0 && volume <= 1) {
                     player.setVolume?.(volume);
                   }
                 } catch (error) {
                   console.error("恢復音量設定失敗:", error);
                 }
               }
             }
      } catch (error) {
        // ✅ 檢查是否是被取消的請求
        if (error.name === 'CanceledError' || error.message === 'canceled' || error.code === 'ERR_CANCELED' || abortController.signal.aborted) {
          return; // 請求被取消，直接返回，不處理錯誤
        }
        console.error("載入播放清單失敗:", error);
        setError("載入播放清單失敗");
      } finally {
        // ✅ 只有在請求未被取消時才設置 loading
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };
    
    fetchPlaylist();
    
    // ✅ 清理函數：取消請求，防止內存泄漏
    return () => {
      abortController.abort();
    };
  }, [id, currentUser?.pinnedPlayer, applyShufflePreference, setShuffleAllowed]);

    // 監聽播放狀態變化事件
    useEffect(() => {
      const handlePlayerStateChange = (event) => {
        const { isPlaying, action } = event.detail || {};
        // 這裡可以添加額外的 UI 更新邏輯
        // 例如更新播放按鈕狀態等
      };

      // 監聽頁面可見性變化，確保播放器狀態同步
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          // ✅ 不再重新設置音頻源（避免重播），PlayerContext 會自動處理恢復播放
          // 只檢查播放器狀態是否正確，不做任何重置操作
          if (playlist.length > 0 && player.originUrl && !player.src) {
            // 只有在音頻源確實丟失時才重新設置
            player.setSrc?.(player.originUrl);
          }
        }
      };
      
      // 🔥 監聽積分更新事件，刷新用戶數據（用於播放清單擴充等）
      // ✅ 添加 AbortController 來取消請求，防止內存泄漏
      const pointsUpdateAbortControllerRef = { current: null };
      
      const handlePointsUpdated = async () => {
        // ✅ 取消之前的請求（如果存在）
        if (pointsUpdateAbortControllerRef.current) {
          pointsUpdateAbortControllerRef.current.abort();
        }
        
        // ✅ 創建新的 AbortController
        const abortController = new AbortController();
        pointsUpdateAbortControllerRef.current = abortController;
        
      try {
        const response = await axios.get(`/api/user-info?id=${id}`, {
          headers: { 'Cache-Control': 'no-cache' },
          signal: abortController.signal // ✅ 添加 signal 以支持取消
        });
        
        // ✅ 檢查請求是否已被取消
        if (abortController.signal.aborted) {
          return;
        }
        if (response.data) {
          setUserData(response.data);
          const allowShuffle =
            typeof response.data.playlistAllowShuffle === "boolean"
              ? response.data.playlistAllowShuffle
              : null;
          if (response.data.username) {
            player.setPlayerOwner?.({
              userId: id,
              username: response.data.username,
              ...(typeof allowShuffle === "boolean" ? { allowShuffle } : {}),
            });
          } else {
            if (typeof allowShuffle === "boolean") {
              setShuffleAllowed?.(allowShuffle);
            }
          }
          applyShufflePreference(allowShuffle);
        }
      } catch (error) {
        // ✅ 檢查是否是被取消的請求
        if (error.name === 'CanceledError' || error.message === 'canceled' || error.code === 'ERR_CANCELED') {
          return; // 請求被取消，直接返回，不處理錯誤
        }
        console.error("刷新用戶數據失敗:", error);
      } finally {
        // ✅ 清理引用
        if (pointsUpdateAbortControllerRef.current === abortController) {
          pointsUpdateAbortControllerRef.current = null;
        }
      }
    };
    
    window.addEventListener('playerStateChanged', handlePlayerStateChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('points-updated', handlePointsUpdated); // ✅ 新增監聽器
    
    return () => {
      // ✅ 取消正在進行的請求
      if (pointsUpdateAbortControllerRef.current) {
        pointsUpdateAbortControllerRef.current.abort();
        pointsUpdateAbortControllerRef.current = null;
      }
      
      window.removeEventListener('playerStateChanged', handlePlayerStateChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('points-updated', handlePointsUpdated); // ✅ 清理監聽器
    };
  }, [playlist, id, applyShufflePreference, playerOwner, setShuffleAllowed]);

  // 組件卸載時的清理
  useEffect(() => {
    return () => {
      // 清理自動播放標記
      if (window.__AUTO_PLAY_TRIGGERED__) {
        delete window.__AUTO_PLAY_TRIGGERED__;
      }
      if (window.__PERSISTENT_AUTO_PLAY__) {
        delete window.__PERSISTENT_AUTO_PLAY__;
      }
      // 清理轉換標記
      if (window.__FORCE_RECREATE_PLAYER__) {
        delete window.__FORCE_RECREATE_PLAYER__;
      }
    };
  }, []);

  const nextTrack = async () => {
    if (playlist.length === 0) return;
    const nextIndex = (activeIndex + 1) % playlist.length;
    const nextItem = playlist[nextIndex];
    
    
    // 先暫停當前播放，避免雙重播放
    if (player.isPlaying) {
      player.pause();
    }
    
    // 直接使用 PlayerContext 的 next 方法，讓它處理所有邏輯
    player.next();
    
    // 更新本地索引（僅用於 UI 顯示）
    setActiveIndex(nextIndex);
    try {
      localStorage.setItem(`playlist_${id}_activeIndex`, nextIndex.toString());
    } catch (error) {
      console.error("🔧 保存播放索引失敗:", error);
    }
  };

  const prevTrack = async () => {
    if (playlist.length === 0) return;
    const prevIndex = activeIndex === 0 ? playlist.length - 1 : activeIndex - 1;
    const prevItem = playlist[prevIndex];
    
    
    // 先暫停當前播放，避免雙重播放
    if (player.isPlaying) {
      player.pause();
    }
    
    // 直接使用 PlayerContext 的 previous 方法，讓它處理所有邏輯
    player.previous();
    
    // 更新本地索引（僅用於 UI 顯示）
    setActiveIndex(prevIndex);
    try {
      localStorage.setItem(`playlist_${id}_activeIndex`, prevIndex.toString());
    } catch (error) {
      console.error("🔧 保存播放索引失敗:", error);
    }
  };

  // 監聽播放器事件 - 同步 UI 狀態
  useEffect(() => {
    const handleNext = (event) => {
      const { nextIndex } = event.detail || {};
      if (nextIndex !== undefined) {
        setActiveIndex(nextIndex);
        // 保存到本地存儲
        try {
          localStorage.setItem(`playlist_${id}_activeIndex`, nextIndex.toString());
        } catch (error) {
          console.error("🔧 保存播放索引失敗:", error);
        }
      }
    };
    
    const handlePrevious = (event) => {
      const { prevIndex } = event.detail || {};
      if (prevIndex !== undefined) {
        setActiveIndex(prevIndex);
        // 保存到本地存儲
        try {
          localStorage.setItem(`playlist_${id}_activeIndex`, prevIndex.toString());
        } catch (error) {
          console.error("🔧 保存播放索引失敗:", error);
        }
      }
    };

    window.addEventListener('playerNext', handleNext);
    window.addEventListener('playerPrevious', handlePrevious);

    return () => {
      window.removeEventListener('playerNext', handleNext);
      window.removeEventListener('playerPrevious', handlePrevious);
    };
  }, [id]);

  // 監聽 PlayerContext 狀態變化，確保同步
  useEffect(() => {
    // 只在有實際內容時才處理，避免無限循環
    if (player.originUrl && playlist.length > 0) {
      // 如果 PlayerContext 的狀態與本地狀態不同步，更新本地狀態
      if (player.originUrl !== playlist[activeIndex]?.url) {
        const matchingIndex = playlist.findIndex(item => item.url === player.originUrl);
        if (matchingIndex !== -1) {
          setActiveIndex(matchingIndex);
          try {
            localStorage.setItem(`playlist_${id}_activeIndex`, matchingIndex.toString());
          } catch (error) {
            console.error("保存播放索引失敗:", error);
          }
        }
      }
    }
  }, [player.originUrl, playlist, activeIndex, id]); // 添加 playlist 依賴

  return (
    <main className="pt-[var(--header-h,64px)] px-4">
      {/* 聲音監控組件 - 只在開發環境顯示 */}
      <AudioMonitor />
      <div className="max-w-3xl mx-auto">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold">播放器</h1>
        </div>

        {loading ? (
          <div className="text-gray-300">載入中...</div>
        ) : error ? (
          <div className="text-red-400">
            <div className="mb-4">{error}</div>
            <button
              onClick={() => {
                setModalOpen(true);
              }}
              className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              🎵 建立播放清單 🎵
            </button>
          </div>
        ) : (
          <div>
          <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white flex flex-col items-center justify-center p-8">
            <div className="max-w-lg mx-auto text-center">
              
              {/* 播放清單設定入口 */}
              <div className="mb-8 w-full max-w-lg mx-auto">
                <div className="flex items-start justify-center mb-4">
                  <div className="w-full flex flex-col items-center">
                    {playlist.length > 0 ? (
                      <div className="space-y-3 flex flex-col items-center w-full">
                        <div className="space-y-1 flex flex-col items-center">
                          <div className="text-xs text-gray-400">
                            目前曲目：<span className="text-white font-medium">{playlist.length}</span> 首
                          </div>
                          <div className="text-xs text-gray-400 flex items-center gap-2">
                            <span>目前播放：<span className="text-white font-medium">{playlist[activeIndex]?.title || "未知曲目"}</span></span>
                            {player.originUrl && (
                              <span className="px-2 py-0.5 bg-gray-700/50 rounded text-gray-300 text-[10px]">
                                {(() => {
                                  // 簡化來源顯示
                                  const url = player.originUrl || "";
                                  // 判斷是否為音樂區的公開音樂（R2 URL 或包含音樂 ID）
                                  if (url.includes("imagedelivery.net") || url.includes("pub-") || url.includes("/api/music/")) {
                                    return "音樂區";
                                  }
                                  // 判斷是否為本地上傳的 MP3（包含 /music/ 路徑或 .mp3 後綴）
                                  if (url.includes("/music/") && !url.includes("imagedelivery.net")) {
                                    return "MP3";
                                  }
                                  // 如果是 .mp3 後綴但不在 /music/ 路徑下，也可能是 MP3
                                  if (url.endsWith(".mp3") || url.includes(".mp3?")) {
                                    return "MP3";
                                  }
                                  // 其他情況顯示簡化的狀態
                                  return url ? "已載入" : "未設定";
                                })()}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setModalOpen(true);
                          }}
                          className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold text-base transition-all duration-300 shadow-xl border-2 border-blue-400"
                        >
                          🎵 編輯播放清單 🎵
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="text-xs text-yellow-400">
                          ⚠️ 請先建立播放清單才能播放
                        </div>
                        <button
                          onClick={() => {
                            setModalOpen(true);
                          }}
                          className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold text-lg transition-all duration-300 shadow-xl border-2 border-blue-400"
                        >
                          🎵 編輯播放清單 🎵
                        </button>
                        <p className="text-xs text-gray-500 text-center">點擊上方按鈕開始設定你的音樂播放清單</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 主視覺：根據造型切換顯示 */}
              <div className="flex justify-center mb-16 mt-12">
                {userData?.activePlayerSkin === 'cat-headphone' ? (
                  // 貓咪耳機造型預覽
                  <div
                    className="drop-shadow-2xl relative"
                    style={{ width: "200px", height: "200px", transform: "scale(1.2)", transformOrigin: "center" }}
                    aria-label="Cat Headphone Player"
                  >
                    <CatHeadphoneCanvas 
                      isPlaying={player.isPlaying} 
                      size={200} 
                      colorSettings={userData?.playerSkinSettings || {
                        mode: 'rgb',
                        speed: 0.02,
                        saturation: 50,
                        lightness: 60,
                        hue: 0,
                        opacity: 0.7
                      }}
                    />
                    
                    {/* 播放時顯示音符動畫 */}
                    {player.isPlaying && (
                      <>
                        {/* 音符 1 - 頂部右側 */}
                        <div 
                          className="absolute text-3xl animate-float-1"
                          style={{ 
                            top: '10px', 
                            right: '40px',
                            color: '#FF6B9D',
                            textShadow: '0 0 12px rgba(255, 107, 157, 1), 0 0 16px rgba(255, 107, 157, 0.8), 0 3px 8px rgba(0,0,0,0.5)',
                            zIndex: 10
                          }}
                        >
                          🎵
                        </div>
                        
                        {/* 音符 2 - 頂部左側 */}
                        <div 
                          className="absolute text-3xl animate-float-2"
                          style={{ 
                            top: '10px', 
                            left: '40px',
                            color: '#4ECDC4',
                            textShadow: '0 0 12px rgba(78, 205, 196, 1), 0 0 16px rgba(78, 205, 196, 0.8), 0 3px 8px rgba(0,0,0,0.5)',
                            zIndex: 10
                          }}
                        >
                          ♪
                        </div>
                        
                        {/* 音符 3 - 右側中央 */}
                        <div 
                          className="absolute text-3xl animate-float-3"
                          style={{ 
                            top: '50%',
                            marginTop: '-18px',
                            right: '10px',
                            color: '#FFD93D',
                            textShadow: '0 0 12px rgba(255, 217, 61, 1), 0 0 16px rgba(255, 217, 61, 0.8), 0 3px 8px rgba(0,0,0,0.5)',
                            zIndex: 10
                          }}
                        >
                          🎶
                        </div>
                        
                        {/* 音符 4 - 左側中央 */}
                        <div 
                          className="absolute text-3xl animate-float-4"
                          style={{ 
                            top: '50%',
                            marginTop: '-18px',
                            left: '10px',
                            color: '#C77DFF',
                            textShadow: '0 0 12px rgba(199, 125, 255, 1), 0 0 16px rgba(199, 125, 255, 0.8), 0 3px 8px rgba(0,0,0,0.5)',
                            zIndex: 10
                          }}
                        >
                          ♫
                        </div>
                        
                        {/* 音符 5 - 底部右側 */}
                        <div 
                          className="absolute text-3xl animate-float-1"
                          style={{ 
                            bottom: '15px', 
                            right: '40px',
                            color: '#FF9F43',
                            textShadow: '0 0 12px rgba(255, 159, 67, 1), 0 0 16px rgba(255, 159, 67, 0.8), 0 3px 8px rgba(0,0,0,0.5)',
                            zIndex: 10
                          }}
                        >
                          ♫
                        </div>
                        
                        {/* 音符 6 - 底部左側 */}
                        <div 
                          className="absolute text-3xl animate-float-2"
                          style={{ 
                            bottom: '15px', 
                            left: '40px',
                            color: '#6BCF7F',
                            textShadow: '0 0 12px rgba(107, 207, 127, 1), 0 0 16px rgba(107, 207, 127, 0.8), 0 3px 8px rgba(0,0,0,0.5)',
                            zIndex: 10
                          }}
                        >
                          ♪
                        </div>
                      </>
                    )}
                  </div>
                ) : userData?.activePlayerSkin === 'cassette-player' ? (
                  // 卡帶播放器造型預覽
                  <div
                    className="drop-shadow-2xl relative"
                    style={{ width: "200px", height: "200px", transform: "scale(1.2)", transformOrigin: "center" }}
                    aria-label="Cassette Player"
                  >
                    <CassettePlayerCanvas 
                      isPlaying={player.isPlaying} 
                      size={200} 
                      colorSettings={userData?.playerSkinSettings || {
                        mode: 'rgb',
                        speed: 0.02,
                        saturation: 50,
                        lightness: 60,
                        hue: 0,
                        opacity: 0.7
                      }}
                    />
                  </div>
                ) : (
                  // 預設造型預覽
                  <div
                    className="drop-shadow-2xl"
                    style={{ width: "200px", height: "200px", transform: "scale(1.2)", transformOrigin: "center" }}
                    aria-label="Mini Player Art"
                  >
                    <MiniPlayerArt
                      isPlaying={player.isPlaying}
                      palette={{ bg: "#F8F1E4", border: "#F8F1E4", accent1: "#E67E22", accent2: "#D35400" }}
                    />
                  </div>
                )}
              </div>

              {/* 隨機播放相關設定 */}
              {(isOwner || shuffleAllowed) && (
                <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
                  {isOwner && (
                    <button
                      onClick={handleAllowShuffleToggle}
                      disabled={updatingShufflePermission}
                      className={`px-4 py-2 rounded-full border text-sm transition-all ${
                        userData?.playlistAllowShuffle
                          ? "bg-green-600/80 border-green-400 text-white hover:bg-green-500/80"
                          : "bg-black/60 border-white/20 text-gray-300 hover:border-white/40 hover:text-white"
                      } ${updatingShufflePermission ? "opacity-60 cursor-not-allowed" : ""}`}
                    >
                      {userData?.playlistAllowShuffle ? "已允許訪客隨機播放" : "允許訪客隨機播放"}
                    </button>
                  )}
                  {shuffleAllowed && (
                    <button
                      onClick={handleShuffleToggle}
                      disabled={playlist.length === 0}
                      className={`px-4 py-2 rounded-full border text-sm flex items-center gap-2 transition-all ${
                        shuffleEnabled
                          ? "bg-purple-600/80 border-purple-400 text-white hover:bg-purple-500/80"
                          : "bg-black/60 border-white/20 text-gray-300 hover:border-white/40 hover:text-white"
                      } ${playlist.length === 0 ? "opacity-60 cursor-not-allowed" : ""}`}
                      title={
                        playlist.length === 0
                          ? "請先建立播放清單"
                          : shuffleEnabled
                            ? "點擊可恢復循序播放"
                            : "點擊切換為隨機播放"
                      }
                    >
                      <svg
                        className="w-4 h-4"
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
                      <span>{shuffleEnabled ? "隨機播放：開" : "隨機播放：關"}</span>
                    </button>
                  )}
                </div>
              )}

              {/* 播放控制 - 美化版 */}
              <div className="flex items-center justify-center gap-4 mb-8">
                {/* 上一首 */}
                <button
                  onClick={prevTrack}
                  disabled={playlist.length === 0}
                  className={`group relative w-14 h-14 rounded-full transition-all duration-300 flex items-center justify-center border ${
                    playlist.length === 0 
                      ? "bg-gray-700/50 text-gray-500 border-gray-600 cursor-not-allowed" 
                      : "bg-black/70 hover:bg-black/90 text-white border-white/30 hover:border-white/50 hover:scale-110 backdrop-blur-sm"
                  }`}
                  title={playlist.length === 0 ? "請先建立播放清單" : "上一首"}
                >
                  <svg className="w-6 h-6 transform group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
                  </svg>
                </button>
            
                {/* 播放/暫停 */}
                <button
                  onClick={async () => {
                    if (playlist.length === 0) {
                      notify.warning("提示", "請先建立播放清單");
                      return;
                    }
                    
                    if (player.isPlaying) {
                      try {
                        await player.pause();
                      } catch (error) {
                        console.warn("暫停失敗:", error.message);
                      }
                    } else {
                      try {
                        await player.play();
                      } catch (error) {
                        console.warn("播放失敗:", error.message);
                      }
                    }
                  }}
                  disabled={playlist.length === 0}
                  className={`group relative w-20 h-20 rounded-full transition-all duration-300 flex items-center justify-center border ${
                    playlist.length === 0 
                      ? "bg-gray-700/50 text-gray-500 border-gray-600 cursor-not-allowed" 
                      : "bg-black/70 hover:bg-black/90 text-white border-white/30 hover:border-white/50 hover:scale-110 backdrop-blur-sm"
                  }`}
                  title={playlist.length === 0 ? "請先建立播放清單" : (player.isPlaying ? "暫停" : "播放")}
                >
                  {player.isPlaying ? (
                    <svg className="w-8 h-8 transform group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                    </svg>
                  ) : (
                    <svg className="w-8 h-8 transform group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  )}
                </button>
            
                {/* 下一首 */}
                <button
                  onClick={nextTrack}
                  disabled={playlist.length === 0}
                  className={`group relative w-14 h-14 rounded-full transition-all duration-300 flex items-center justify-center border ${
                    playlist.length === 0 
                      ? "bg-gray-700/50 text-gray-500 border-gray-600 cursor-not-allowed" 
                      : "bg-black/70 hover:bg-black/90 text-white border-white/30 hover:border-white/50 hover:scale-110 backdrop-blur-sm"
                  }`}
                  title={playlist.length === 0 ? "請先建立播放清單" : "下一首"}
                >
                  <svg className="w-6 h-6 transform group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 6v12l8.5-6zm10 0h2v12h-2z"/>
                  </svg>
                </button>
              </div>

            {/* 進度條 */}
            <div className="w-full max-w-md mx-auto mb-4">
              <div className="text-xs text-gray-400 mb-2">
                {(() => {
                  const currentTime = typeof player.currentTime === 'number' && isFinite(player.currentTime) ? player.currentTime : 0;
                  const duration = typeof player.duration === 'number' && isFinite(player.duration) ? player.duration : 0;
                  const currentMin = Math.floor(currentTime / 60);
                  const currentSec = Math.floor(currentTime % 60);
                  const durationMin = Math.floor(duration / 60);
                  const durationSec = Math.floor(duration % 60);
                  return `${currentMin}:${String(currentSec).padStart(2, '0')} / ${durationMin}:${String(durationSec).padStart(2, '0')}`;
                })()}
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-white h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${(() => {
                      const currentTime = typeof player.currentTime === 'number' && isFinite(player.currentTime) ? player.currentTime : 0;
                      const duration = typeof player.duration === 'number' && isFinite(player.duration) && player.duration > 0 ? player.duration : 0;
                      const percentage = duration > 0 ? (currentTime / duration) * 100 : 0;
                      return Math.max(0, Math.min(100, percentage));
                    })()}%` 
                  }}
                />
              </div>
            </div>

                {/* 音量控制 */}
            <div className="w-full max-w-md mx-auto">
              <div className="text-xs text-gray-400 mb-2">音量</div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={player.volume}
                onChange={(e) => player.setVolume(parseFloat(e.target.value))}
                className="w-full"
              />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 播放清單設定模態框 */}
        {modalOpen && (
        <PlaylistModal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
          }}
          playlist={playlist}
          onChangePlaylist={async (newPlaylist) => {
            // ✅ 先更新本地狀態
            setPlaylist(newPlaylist);
            
            // ✅ 更新待保存的播放清單（始終保存最新版本）
            pendingPlaylistRef.current = newPlaylist;
            saveVersionRef.current += 1;
            const currentVersion = saveVersionRef.current;
            
            // ✅ 如果正在保存，只更新待保存版本，不立即執行（會在當前保存完成後繼續）
            if (savingRef.current) {
              return; // 等待當前保存完成後，會在 finally 塊中繼續保存
            }
            
            // ✅ 執行保存（確保只有一個保存請求在進行）
            const performSave = async () => {
              // 檢查是否仍是最新版本（使用最新的版本號）
              const latestVersion = saveVersionRef.current;
              if (currentVersion !== latestVersion) {
                // 使用最新版本重新調用
                if (pendingPlaylistRef.current) {
                  // 更新 currentVersion 為最新版本
                  const newVersion = latestVersion;
                  // 重新執行保存（使用最新版本）
                  setTimeout(() => {
                    const performSaveWithVersion = async () => {
                      const playlistToSave = pendingPlaylistRef.current;
                      if (!playlistToSave) {
                        savingRef.current = false;
                        return;
                      }
                      
                      savingRef.current = true;
                      
                      try {
                        const response = await axios.post('/api/user/save-playlist', {
                          playlist: playlistToSave
                        });
                        
                        if (response.data.success) {
                          if (currentUser && setCurrentUser) {
                            const pinnedUserId = currentUser?.pinnedPlayer?.userId;
                            const isPinnedOwnPlayer = pinnedUserId && String(pinnedUserId) === String(currentUser._id);
                            
                            if (isPinnedOwnPlayer && currentUser.pinnedPlayer) {
                              setCurrentUser(prevUser => {
                                if (!prevUser) return prevUser;
                                return {
                                  ...prevUser,
                                  pinnedPlayer: {
                                    ...prevUser.pinnedPlayer,
                                    playlist: playlistToSave
                                  }
                                };
                              });
                            }
                          }
                          
                          window.dispatchEvent(new CustomEvent('playlistChanged'));
                        }
                      } catch (error) {
                        if (error.response?.status !== 401) {
                          notify("保存播放清單失敗: " + (error.response?.data?.message || error.message), "error");
                        }
                      } finally {
                        savingRef.current = false;
                        
                        if (saveVersionRef.current > newVersion && pendingPlaylistRef.current) {
                          setTimeout(() => performSaveWithVersion(), 50);
                        }
                      }
                      
                      try {
                        localStorage.setItem(`playlist_${id}`, JSON.stringify(playlistToSave));
                      } catch (error) {
                        console.error("保存播放清單到本地存儲失敗:", error);
                      }
                      
                      player.setPlaylist?.(playlistToSave);
                      
                      if (playlistToSave.length > 0) {
                        const firstItem = playlistToSave[0];
                        player.setSrc?.(firstItem.url);
                        player.setOriginUrl?.(firstItem.url);
                        player.setTrackTitle?.(firstItem.title);
                        setActiveIndex(0);
                      } else {
                        player.setSrc?.("");
                        player.setOriginUrl?.("");
                        player.setTrackTitle?.("");
                        setActiveIndex(0);
                      }
                    };
                    performSaveWithVersion();
                  }, 50);
                }
                return;
              }
              
              const playlistToSave = pendingPlaylistRef.current;
              if (!playlistToSave) {
                savingRef.current = false;
                return;
              }
              
              savingRef.current = true;
              
              try {
                const response = await axios.post('/api/user/save-playlist', {
                  playlist: playlistToSave
                });
              
                if (response.data.success) {
                  // ✅ 如果用戶已釘選自己的播放器，更新 currentUser.pinnedPlayer.playlist
                  // 這樣可以避免使用舊的快照
                  if (currentUser && setCurrentUser) {
                    const pinnedUserId = currentUser?.pinnedPlayer?.userId;
                    const isPinnedOwnPlayer = pinnedUserId && String(pinnedUserId) === String(currentUser._id);
                    
                    if (isPinnedOwnPlayer && currentUser.pinnedPlayer) {
                      setCurrentUser(prevUser => {
                        if (!prevUser) return prevUser;
                        return {
                          ...prevUser,
                          pinnedPlayer: {
                            ...prevUser.pinnedPlayer,
                            playlist: playlistToSave // 使用最新的播放清單
                          }
                        };
                      });
                    }
                  }
                  
                  // ✅ 觸發播放清單變更事件，通知 MiniPlayer 重新載入
                  window.dispatchEvent(new CustomEvent('playlistChanged'));
                } else {
                  notify("保存播放清單失敗: " + (response.data.message || "未知錯誤"), "error");
                }
              } catch (error) {
                if (error.response?.status !== 401) {
                  notify("保存播放清單失敗: " + (error.response?.data?.message || error.message), "error");
                }
              } finally {
                savingRef.current = false;
                
                // ✅ 檢查是否有待保存的更新版本
                if (saveVersionRef.current > currentVersion && pendingPlaylistRef.current) {
                  // 遞歸調用以保存最新版本
                  setTimeout(() => performSave(), 50);
                }
              }
              
              // 2. 保存播放清單到 localStorage（備用存儲）
              try {
                localStorage.setItem(`playlist_${id}`, JSON.stringify(playlistToSave));
              } catch (error) {
                console.error("保存播放清單到本地存儲失敗:", error);
              }
              
              // 3. 更新播放器狀態
              // ✅ 無論是否已釘選自己的播放器，都更新 PlayerContext 的播放清單
              player.setPlaylist?.(playlistToSave);
              
              if (playlistToSave.length > 0) {
                const firstItem = playlistToSave[0];
                player.setSrc?.(firstItem.url);
                player.setOriginUrl?.(firstItem.url);
                player.setTrackTitle?.(firstItem.title);
                setActiveIndex(0);
              } else {
                player.setSrc?.("");
                player.setOriginUrl?.("");
                player.setTrackTitle?.("");
                setActiveIndex(0);
              }
            };
            
            // 執行保存
            performSave();
        }}
          activeIndex={activeIndex}
            onSetActiveIndex={(index) => {
              setActiveIndex(index);
              const item = playlist[index];
              if (item) {
                player.setSrc?.(item.url);
                player.setOriginUrl?.(item.url);
                player.setTrackTitle?.(item.title);
                
                // 保存當前播放索引
                try {
                  localStorage.setItem(`playlist_${id}_activeIndex`, index.toString());
                } catch (error) {
                  console.error("保存播放索引失敗:", error);
                }
              }
          }}
          maxItems={userData?.playlistMaxSize || 5}
        />
        )}

        {/* 播放器造型設定面板 - 在播放控制下方 */}
        {!loading && !error && (
          <div className="mt-8 mb-8">
            <PlayerSkinSettings 
              currentUser={currentUser}
              onSettingsSaved={(newSettings) => {
                // 設定保存後刷新用戶數據
                console.log('✅ 播放器造型設定已保存:', newSettings);
              }}
            />
          </div>
                  )}

      </div>
    </main>
  );
}