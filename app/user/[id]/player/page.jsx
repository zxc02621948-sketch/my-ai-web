"use client";

import { useEffect, useState, useRef } from "react";
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

// GlobalYouTubeBridge 已移至全域 layout.js，不需要在此重複渲染

export default function UserPlayerPage() {
  const { id } = useParams();
  const player = usePlayer();
  const { currentUser } = useCurrentUser() || {};
  const isOwner = !!(currentUser && String(currentUser._id) === String(id));
  
  // 調試登入狀態
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userData, setUserData] = useState(null);
  // 使用 PlayerContext 的播放清單狀態
  const { playlist, setPlaylist, activeIndex, setActiveIndex } = player;
  
  // 使用 PlayerContext 的狀態作為主要狀態
  const currentTrack = playlist[activeIndex];
  const isCurrentTrackPlaying = player.isPlaying && player.originUrl === currentTrack?.url;
  const [modalOpen, setModalOpen] = useState(false);
  
  // 從後端 API 載入用戶的播放清單
  useEffect(() => {
    const fetchPlaylist = async () => {
      try {
        // ✅ 檢查是否有釘選的播放器
        const hasPinnedPlayer = currentUser?.pinnedPlayer?.userId;
        if (hasPinnedPlayer) {
          console.log('📌 [UserPlayerPage] 檢測到釘選播放器，跳過加載本地播放清單');
          setLoading(false);
          return; // 不覆蓋釘選的播放器
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
        try {
          player.setIsPlaying?.(false);
          player.setSrc?.('');
          player.setOriginUrl?.('');
          player.setTrackTitle?.('');
        } catch (error) {
          console.error("重置播放器狀態失敗:", error);
        }
        
        // 從 API 獲取該用戶的資料（包含播放清單）
        let userDataFetched = {};
        try {
          const response = await axios.get(`/api/user-info?id=${id}`, {
            headers: { 'Cache-Control': 'no-cache' }
          });
          userDataFetched = response.data;
          setUserData(userDataFetched); // 保存用戶數據用於釘選按鈕
          
          // ✅ 設置 playerOwner（用於顯示釘選按鈕）
          if (userDataFetched.username) {
            player.setPlayerOwner?.({ userId: id, username: userDataFetched.username });
          }
        } catch (error) {
          console.error("獲取用戶資料失敗:", error.message);
          userDataFetched = {}; // 使用空物件作為備用
        }
        
             // 🏗️ 理想架構：數據庫為主，localStorage為進度，PlayerContext為UI
             let finalPlaylist = [];
             
             // 1. 優先從數據庫載入播放清單（主要存儲）
             if (userDataFetched.playlist && userDataFetched.playlist.length > 0) {
               finalPlaylist = userDataFetched.playlist;
             } else {
               // 2. 數據庫沒有，檢查 localStorage（備用存儲）
               const localPlaylist = localStorage.getItem(`playlist_${id}`);
               if (localPlaylist) {
                 try {
                   const parsedPlaylist = JSON.parse(localPlaylist);
                   if (Array.isArray(parsedPlaylist) && parsedPlaylist.length > 0) {
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
               
               // 3. 同步到 PlayerContext（UI狀態管理）
               player.setSrc?.(currentItem.url);
               player.setOriginUrl?.(currentItem.url);
               player.setTrackTitle?.(currentItem.title);
               setActiveIndex(activeIndex);
               
               // 4. 恢復用戶偏好（音量等）
               if (savedVolume) {
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
        console.error("載入播放清單失敗:", error);
        setError("載入播放清單失敗");
      } finally {
        setLoading(false);
      }
    };
    
    fetchPlaylist();
  }, [id, currentUser?.pinnedPlayer]); // 依賴 currentUser 的釘選狀態

  // 監聽播放狀態變化事件
  useEffect(() => {
    const handlePlayerStateChange = (event) => {
      const { isPlaying, action } = event.detail || {};
      console.log("🔧 播放器頁面收到狀態變化事件:", { isPlaying, action });
      
      // 這裡可以添加額外的 UI 更新邏輯
      // 例如更新播放按鈕狀態等
    };

    // 監聽頁面可見性變化，確保播放器狀態同步
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log("🔧 頁面重新可見，檢查播放器狀態");
        // 重新同步播放器狀態
        if (playlist.length > 0 && player.originUrl) {
          console.log("🔧 重新同步播放器狀態");
          player.setSrc?.(player.originUrl);
        }
      }
    };
    
    // 🔥 監聽積分更新事件，刷新用戶數據（用於播放清單擴充等）
    const handlePointsUpdated = async () => {
      console.log("🔧 收到積分更新事件，刷新用戶數據");
      try {
        const response = await axios.get(`/api/user-info?id=${id}`, {
          headers: { 'Cache-Control': 'no-cache' }
        });
        if (response.data) {
          setUserData(response.data);
          console.log("✅ 用戶數據已刷新，新的播放清單上限:", response.data.playlistMaxSize);
        }
      } catch (error) {
        console.error("刷新用戶數據失敗:", error);
      }
    };
    
    window.addEventListener('playerStateChanged', handlePlayerStateChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('points-updated', handlePointsUpdated); // ✅ 新增監聽器
    
    return () => {
      window.removeEventListener('playerStateChanged', handlePlayerStateChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('points-updated', handlePointsUpdated); // ✅ 清理監聽器
    };
  }, [playlist, id]); // 移除 player 依賴，避免無限循環

  // 組件卸載時的清理
  useEffect(() => {
    return () => {
      console.log("🔧 播放器頁面卸載，清理狀態");
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
    
    console.log("🔧 下一首，直接使用 PlayerContext 方法");
    
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
    
    console.log("🔧 上一首，直接使用 PlayerContext 方法");
    
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
      console.log("🔧 收到下一首事件，同步 UI 狀態");
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
      console.log("🔧 收到上一首事件，同步 UI 狀態");
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
        console.log("🔧 檢測到 PlayerContext 狀態不同步，尋找匹配的播放清單項目");
        const matchingIndex = playlist.findIndex(item => item.url === player.originUrl);
        if (matchingIndex !== -1) {
          console.log("🔧 找到匹配的播放清單項目，更新索引:", matchingIndex);
          setActiveIndex(matchingIndex);
          try {
            localStorage.setItem(`playlist_${id}_activeIndex`, matchingIndex.toString());
          } catch (error) {
            console.error("🔧 保存播放索引失敗:", error);
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
                console.log("🔧 點擊錯誤頁面的建立播放清單按鈕");
                setModalOpen(true);
              }}
              className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              🎵 建立播放清單 🎵
            </button>
          </div>
        ) : (
          <div>
            <div className="text-xs text-gray-400 mb-4">
              調試信息: 播放清單長度: {playlist.length}, 用戶ID: {id}
            </div>
            
          <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white flex flex-col items-center justify-center p-8">
            <div className="max-w-lg mx-auto text-center">
              
              {/* 播放清單設定入口 */}
              <div className="mb-8 w-full max-w-lg mx-auto">
                <label className="block text-sm text-gray-300 mb-2">播放清單</label>
                <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-gray-400">目前曲目：{playlist.length} 首</div>
                    {playlist.length > 0 && (
                        <button
                          onClick={() => {
                          console.log("🔧 點擊編輯播放清單按鈕");
                          setModalOpen(true);
                        }}
                        className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 border-2 border-blue-500 text-white font-semibold transition-colors shadow-lg"
                      >
                        ✏️ 編輯清單
                      </button>
                    )}
                    </div>
                
                {playlist.length > 0 ? (
                  <div className="text-xs text-gray-400 mb-2">
                    目前播放：{playlist[activeIndex]?.title || "未知曲目"}
                </div>
              ) : (
                  <div className="text-xs text-yellow-400 mb-2">
                    ⚠️ 請先建立播放清單才能播放
                </div>
              )}

                <p className="text-xs text-gray-400 mt-2 break-all">目前來源：{player.originUrl || "未設定"}</p>
                
                {/* 備用建立播放清單按鈕 */}
                {playlist.length === 0 && (
                  <div className="mt-6">
                    <button
                      onClick={() => {
                        console.log("🔧 點擊備用建立播放清單按鈕");
                        console.log("🔧 當前 modalOpen 狀態:", modalOpen);
                        setModalOpen(true);
                        console.log("🔧 設置 modalOpen 為 true");
                      }}
                      className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold text-lg transition-all duration-300 shadow-xl border-2 border-blue-400"
                      style={{ display: 'block', visibility: 'visible' }}
                    >
                      🎵 立即建立播放清單 🎵
                    </button>
                    <p className="text-xs text-gray-500 mt-2">點擊上方按鈕開始設定你的音樂播放清單</p>
                  </div>
                )}
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
                        console.log("🔧 暫停播放");
                        await player.pause();
                      } catch (error) {
                        console.warn("🔧 暫停失敗:", error.message);
                      }
                    } else {
                      try {
                        console.log("🔧 開始播放");
                        const ok = await player.play();
                        if (!ok) {
                          console.log("🔧 播放失敗，可能是播放器未準備好");
                        }
                      } catch (error) {
                        console.warn("🔧 播放失敗:", error.message);
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
            setPlaylist(newPlaylist);
            
            // 🏗️ 理想架構：分工明確的保存邏輯
            
            // 1. 保存播放清單到數據庫（主要存儲）
            try {
              const response = await axios.post('/api/user/save-playlist', {
                playlist: newPlaylist
              });
              
              if (!response.data.success) {
                console.error("保存播放清單失敗:", response.data.message);
              }
            } catch (error) {
              if (error.response?.status !== 401) {
                console.error("保存播放清單到數據庫失敗:", error.message);
              }
            }
            
            // 2. 保存播放清單到 localStorage（備用存儲）
            try {
              localStorage.setItem(`playlist_${id}`, JSON.stringify(newPlaylist));
            } catch (error) {
              console.error("保存播放清單到本地存儲失敗:", error);
            }
            
            if (newPlaylist.length > 0) {
              const firstItem = newPlaylist[0];
              player.setSrc?.(firstItem.url);
              player.setOriginUrl?.(firstItem.url);
              player.setTrackTitle?.(firstItem.title);
              setActiveIndex(0);
          } else {
              player.setSrc?.("");
              player.setOriginUrl?.("");
              setActiveIndex(0);
          }
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

        {/* 全域 YouTube 橋接 */}
        {/* GlobalYouTubeBridge 已移至全域 layout.js */}
      </div>
    </main>
  );
}