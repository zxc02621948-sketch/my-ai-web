
"use client";

import { useMemo, useRef, useEffect, useCallback, useState } from "react";
import { usePlayer } from "@/components/context/PlayerContext";
import YoutubeFallback from "./YoutubeFallback";

// 改善的播放器清理函數
const safeCleanupPlayer = (playerRef) => {
  if (!playerRef || !playerRef.current) {
    return;
  }
  
  try {
    // 檢查播放器是否仍然有效
    if (typeof playerRef.current.getPlayerState === 'function') {
      try {
        const state = playerRef.current.getPlayerState();
        if (state !== undefined) {
          // 播放器仍然有效，嘗試停止
          if (typeof playerRef.current.pauseVideo === 'function') {
            playerRef.current.pauseVideo();
          }
          if (typeof playerRef.current.stopVideo === 'function') {
            playerRef.current.stopVideo();
          }
        }
      } catch (stateError) {
        // 播放器已經無效，靜默處理
        console.log('🔧 播放器狀態檢查失敗，播放器可能已失效');
      }
    }
    
    // 不要立即清理引用，讓它自然失效
    // playerRef.current = null; // 移除這行
  } catch (error) {
    console.warn('🔧 播放器清理失敗:', error.message);
    // 不要強制清理引用
    // playerRef.current = null; // 移除這行
  }
};

export default function GlobalYouTubeBridge() {
  const player = usePlayer();
  const ytRef = useRef(null);
  const autoPlayTriggeredRef = useRef(false);
  const persistentAutoPlayRef = useRef(false);
  const [playerKey, setPlayerKey] = useState(0);
  const shouldResumeOnVisibleRef = useRef(false); // 記錄是否需要在分頁可見時繼續播放
  const reinitTimeoutRef = useRef(null); // 防抖重新初始化
  const lastIsPlayingRef = useRef(null); // 追踪上次的播放狀態

  // 提取 videoId，只在視頻真正變化時重新創建播放器
  const videoId = useMemo(() => {
    if (!player?.originUrl) return null;
    
    try {
      const url = new URL(player.originUrl);
      if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) {
        const videoId = url.searchParams.get('v') || url.pathname.split('/').pop();
        return videoId;
      }
    } catch (error) {
      console.warn('🔧 無法解析 URL:', player.originUrl);
    }
    
    return null;
  }, [player?.originUrl]);

  // 使用 useRef 來保持進度追蹤狀態
  const progressStateRef = useRef({
    isPlaying: false,
    startTime: null,
    pausedAt: 0,
    duration: 0
  });

  // 當 videoId 變化時，重置進度狀態並切換視頻
  useEffect(() => {
    if (videoId) {
      progressStateRef.current.isPlaying = false;
      progressStateRef.current.startTime = null;
      progressStateRef.current.pausedAt = 0;
      progressStateRef.current.duration = 0;
      
      // 重置自動播放標記，允許新視頻自動播放
      autoPlayTriggeredRef.current = false;
      
      // 在後台分頁時，嘗試使用 postMessage 切換視頻
      // 注意：由於瀏覽器的自動播放政策，後台分頁可能無法自動播放
      const shouldAutoPlay = player?.autoPlayAfterBridge || window.__AUTO_PLAY_TRIGGERED__ || window.__PERSISTENT_AUTO_PLAY__;
      
      if (shouldAutoPlay && document.hidden) {
        // 使用 postMessage 嘗試切換視頻（可能被瀏覽器阻止）
        setTimeout(() => {
          const youtubeIframes = document.querySelectorAll('iframe[src*="youtube.com"]');
          if (youtubeIframes.length > 0) {
            const iframe = youtubeIframes[youtubeIframes.length - 1];
            if (iframe && iframe.contentWindow) {
              try {
                iframe.contentWindow.postMessage(JSON.stringify({
                  event: 'command',
                  func: 'loadVideoById',
                  args: [videoId]
                }), '*');
                
                // 清除自動播放標記
                player?.setAutoPlayAfterBridge?.(false);
                window.__AUTO_PLAY_TRIGGERED__ = false;
                window.__PERSISTENT_AUTO_PLAY__ = false;
              } catch (error) {
                // 靜默處理錯誤
              }
            }
          }
        }, 500);
      }
    }
  }, [videoId, player?.autoPlayAfterBridge, player?.setAutoPlayAfterBridge]);

  // 監聽分頁可見性變化，在分頁切換回前台時繼續播放
  useEffect(() => {
    const handleVisibilityChange = () => {
      console.log('👁️ [分頁切換]', {
        分頁狀態: document.hidden ? '切到後台' : '切回前台',
        需要恢復播放: shouldResumeOnVisibleRef.current,
        當前曲目: player?.trackTitle,
        播放狀態: player?.isPlaying
      });
      
      if (!document.hidden && shouldResumeOnVisibleRef.current) {
        // 分頁切換回前台，且需要繼續播放
        console.log('▶️ [分頁切換] 準備恢復播放');
        shouldResumeOnVisibleRef.current = false;
        
        // 檢查播放器是否仍然有效
        if (ytRef.current && typeof ytRef.current.playVideo === 'function') {
          try {
            // 直接使用 YouTube API 播放
            ytRef.current.playVideo();
            console.log('✅ [分頁切換] 播放恢復成功');
          } catch (error) {
            console.warn("⚠️ [分頁切換] 播放失敗:", error.message);
            // 回退到 player.play()
            setTimeout(() => {
              player?.play?.();
            }, 500);
          }
        } else {
          // 播放器無效，使用 player.play()
          console.log('⚠️ [分頁切換] 播放器無效，使用 player.play()');
          setTimeout(() => {
            player?.play?.();
          }, 500);
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [player?.play]);

  // 監聽播放狀態變化事件
  useEffect(() => {
    const handlePlayerStateChange = (event) => {
      const { isPlaying } = event.detail || {};
      
      // 只有在播放器引用有效時才同步狀態
      if (typeof isPlaying === 'boolean' && ytRef.current) {
        player?.setExternalPlaying?.(isPlaying);
      }
    };
    
    window.addEventListener('playerStateChanged', handlePlayerStateChange);
    return () => window.removeEventListener('playerStateChanged', handlePlayerStateChange);
  }, [player?.setExternalPlaying]);

  // 添加頁面卸載時的清理
  useEffect(() => {
    return () => {
      console.log("🔧 GlobalYouTubeBridge 卸載，清理狀態");
      // 清理所有全域標記
      if (window.__AUTO_PLAY_TRIGGERED__) {
        delete window.__AUTO_PLAY_TRIGGERED__;
      }
      if (window.__PERSISTENT_AUTO_PLAY__) {
        delete window.__PERSISTENT_AUTO_PLAY__;
      }
      if (window.__FORCE_RECREATE_PLAYER__) {
        delete window.__FORCE_RECREATE_PLAYER__;
      }
      if (window.__YT_READY__) {
        delete window.__YT_READY__;
      }
      
      // 清理防抖定時器
      if (reinitTimeoutRef.current) {
        clearTimeout(reinitTimeoutRef.current);
        reinitTimeoutRef.current = null;
      }
      
      // 不要清理播放器引用，讓它保持有效
      // ytRef.current = null; // 移除這行
    };
  }, []);


        const onReady = useCallback((e) => {
        try {
          const p = e?.target;
            if (!p) {
              console.warn("🔧 播放器對象無效");
              return;
            }
            
            // 檢查播放器基本功能
            if (typeof p.playVideo !== 'function' || typeof p.pauseVideo !== 'function') {
              console.warn("🔧 播放器缺少必要功能");
              return;
            }
            
            // console.log("🔧 YouTube 播放器 onReady 觸發:", {
            //   hasPlayer: !!p,
            //   videoId,
            //   hasGetDuration: typeof p.getDuration === 'function',
            //   hasPlayVideo: typeof p.playVideo === 'function'
            // });
            
            // 初始化 duration
            if (progressStateRef.current && typeof p.getDuration === 'function') {
              const duration = p.getDuration() || 0;
              if (duration > 0) {
                progressStateRef.current.duration = duration;
                // console.log("🔧 播放器 duration 設置:", duration);
              }
            }
            
            // 檢查是否已經有播放器實例
            if (ytRef.current) {
              // 播放器已經存在，但我們仍然需要設置外部控制器
              // console.log("🔧 播放器已存在，重新設置外部控制器");
              
              // 檢查是否需要自動播放
              const savedAutoPlayTriggered = window.__AUTO_PLAY_TRIGGERED__;
              const persistentAutoPlay = window.__PERSISTENT_AUTO_PLAY__;
              const shouldAutoPlay = player?.autoPlayAfterBridge || savedAutoPlayTriggered || persistentAutoPlay;
              
              // 檢查播放器引用是否仍然有效
              let isPlayerValid = false;
              if (ytRef.current && typeof ytRef.current.getPlayerState === 'function') {
                try {
                  const state = ytRef.current.getPlayerState();
                  isPlayerValid = (state !== null && state !== undefined);
                } catch (error) {
                  ytRef.current = null; // 清除無效引用
                }
              }
              
              if (shouldAutoPlay && !autoPlayTriggeredRef.current && isPlayerValid) {
                // 播放器已存在且有效，準備自動播放
                
                // 設置標記，避免重複觸發
                autoPlayTriggeredRef.current = true;
                
                // 清除全域標記，避免其他播放器觸發
                player?.setAutoPlayAfterBridge?.(false);
                window.__AUTO_PLAY_TRIGGERED__ = false; // 清除標記
                
                // 簡化的自動播放邏輯
                setTimeout(() => {
                  try {
                    // 再次檢查播放器是否仍然有效
                    if (ytRef.current && typeof ytRef.current.playVideo === 'function') {
                      // 檢查播放器狀態
                      if (typeof ytRef.current.getPlayerState === 'function') {
                        try {
                          const playerState = ytRef.current.getPlayerState();
                          
                          if (playerState !== undefined && playerState !== null && playerState !== 1) {
                            ytRef.current.playVideo();
                            // 清除持久標記
                            window.__PERSISTENT_AUTO_PLAY__ = false;
                          } else if (playerState === 1) {
                            window.__PERSISTENT_AUTO_PLAY__ = false;
                          } else if (playerState === null || playerState === undefined) {
                            ytRef.current = null;
                          }
                        } catch (stateError) {
                          ytRef.current = null; // 清除無效引用
                        }
                      } else {
                        // getPlayerState 不可用，播放器可能已失效
                        ytRef.current = null;
                      }
                    }
                  } catch (error) {
                    ytRef.current = null; // 清除無效引用
                  }
                }, 500); // 增加延遲到 500ms
              }
              
              // 不要提前返回，繼續執行外部控制器設置
            } else {
              // 播放器不存在，設置播放器引用
              // console.log("🔧 設置新的播放器引用");
          ytRef.current = p;
              
              // 在 window 標記 ready 狀態
              window.__YT_READY__ = true;
              
              
              // 重置播放器狀態
              player?.setExternalPlaying?.(false);
            }
            
            // console.log("🔧 播放器就緒，準備自動播放檢查");
            
            // 音量設置：使用 postMessage 方式（更可靠）
            setTimeout(() => {
              try {
                const currentVolume = player?.volume;
                
                console.log('🔊 [onReady音量同步]', {
                  PlayerContext音量: currentVolume,
                  轉換後: currentVolume ? Math.round(currentVolume * 100) : 'undefined',
                  視頻ID: videoId
                });
                
                if (typeof currentVolume === 'number' && !isNaN(currentVolume) && isFinite(currentVolume)) {
                  const volume = Math.round(currentVolume * 100);
                  
                  // ✅ 優先使用 postMessage（避免 null.src 錯誤）
                  const youtubeIframes = document.querySelectorAll('iframe[src*="youtube.com"]');
                  if (youtubeIframes.length > 0) {
                    const iframe = youtubeIframes[youtubeIframes.length - 1];
                    if (iframe && iframe.contentWindow) {
                      try {
                        iframe.contentWindow.postMessage(JSON.stringify({
                          event: 'command',
                          func: 'setVolume',
                          args: [volume]
                        }), '*');
                        console.log('✅ [onReady音量同步] postMessage 設置成功:', volume);
                      } catch (postError) {
                        console.warn('⚠️ [onReady音量同步] postMessage 失敗:', postError.message);
                      }
                    }
                  }
                  
                  // 備用：嘗試直接 API（可能失敗但不影響）
                  if (ytRef.current && typeof ytRef.current.setVolume === 'function') {
                    try {
                      ytRef.current.setVolume(volume);
                      console.log('✅ [onReady音量同步] API 設置成功:', volume);
                    } catch (setError) {
                      // 靜默處理，postMessage 已經設置過了
                    }
                  }
                } else {
                  console.warn('⚠️ [onReady音量同步] 音量值無效:', currentVolume);
                }
              } catch (error) {
                console.error('❌ [onReady音量同步] 錯誤:', error.message);
              }
            }, 500); // ✅ 增加延遲到 500ms，確保播放器完全初始化
      
      // 設置外部播放器控制（移到條件檢查之前，確保總是執行）
      // console.log("🔧 設置外部播放器控制器");
          player?.setExternalControls?.({
        play: () => {
          // 嘗試播放
          
          // 如果播放器引用為 null，嘗試重新初始化
          if (!ytRef.current) {
            console.warn("🔧 播放器引用為 null，嘗試重新初始化");
            // 使用防抖機制避免過度重新初始化
            if (reinitTimeoutRef.current) {
              clearTimeout(reinitTimeoutRef.current);
            }
            reinitTimeoutRef.current = setTimeout(() => {
              setPlayerKey(prev => prev + 1);
              reinitTimeoutRef.current = null;
            }, 200);
            return;
          }
          
          // 使用 DOM 操作來播放，避免直接調用 YouTube API
          try {
            // 找到 YouTube iframe 並使用 postMessage 來控制
            const youtubeIframes = document.querySelectorAll('iframe[src*="youtube.com"]');
            if (youtubeIframes.length > 0) {
              const iframe = youtubeIframes[youtubeIframes.length - 1]; // 使用最後一個 iframe
              if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
                // console.log("🔧 使用 postMessage 播放成功");
                return;
              }
            }
            
            // 如果 postMessage 失敗，嘗試直接調用 API（但用更安全的方式）
            try {
              // 先檢查播放器是否真的有效
              const playerState = ytRef.current.getPlayerState();
              // console.log("🔧 播放器狀態檢查:", { playerState, ytRef: !!ytRef.current });
              
              if (playerState !== null && playerState !== undefined) {
                // 添加延遲，確保播放器完全準備好
                setTimeout(() => {
                  try {
                    ytRef.current.playVideo();
                    // console.log("🔧 YouTube 直接播放成功");
                  } catch (playError) {
                    console.error("🔧 playVideo 調用失敗:", playError);
                  }
                }, 100);
              } else {
                console.warn("🔧 播放器狀態無效，跳過播放");
              }
            } catch (directError) {
              console.warn("🔧 直接播放失敗:", directError.message);
            }
          } catch (error) {
            console.warn("🔧 播放失敗:", error.message);
          }
        },
        pause: () => {
          // 嘗試暫停
          
          // 如果播放器引用為 null，嘗試重新初始化
          if (!ytRef.current) {
            console.warn("🔧 播放器引用為 null，嘗試重新初始化");
            // 使用防抖機制避免過度重新初始化
            if (reinitTimeoutRef.current) {
              clearTimeout(reinitTimeoutRef.current);
            }
            reinitTimeoutRef.current = setTimeout(() => {
              setPlayerKey(prev => prev + 1);
              reinitTimeoutRef.current = null;
            }, 200);
            return;
          }
          
          // 使用 DOM 操作來暫停，避免直接調用 YouTube API
          try {
            // 找到 YouTube iframe 並使用 postMessage 來控制
            const youtubeIframes = document.querySelectorAll('iframe[src*="youtube.com"]');
            if (youtubeIframes.length > 0) {
              const iframe = youtubeIframes[youtubeIframes.length - 1]; // 使用最後一個 iframe
              if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
                // console.log("🔧 使用 postMessage 暫停成功");
                return;
              }
            }
            
            // 如果 postMessage 失敗，嘗試直接調用 API（但用更安全的方式）
            try {
              // 先檢查播放器是否真的有效
              const playerState = ytRef.current.getPlayerState();
              if (playerState !== null && playerState !== undefined) {
                ytRef.current.pauseVideo();
                // console.log("🔧 YouTube 直接暫停成功");
              } else {
                console.warn("🔧 播放器狀態無效，跳過暫停");
              }
            } catch (directError) {
              console.warn("🔧 直接暫停失敗:", directError.message);
            }
          } catch (error) {
            console.warn("🔧 暫停失敗:", error.message);
          }
        },
        setVolume: (vol0to1) => {
          // 確保音量值是有效的數字
          if (typeof vol0to1 !== 'number' || isNaN(vol0to1) || !isFinite(vol0to1)) {
            console.warn("🔧 無效的音量值:", vol0to1);
            return;
          }
          
          // 確保音量值在有效範圍內 (0-1)
          const validVolume = Math.max(0, Math.min(1, vol0to1));
          
          // ✅ 監測音量變化
          console.log('🔊 [音量監測]', {
            設置音量: `${Math.floor(validVolume * 100)}%`,
            原始值: vol0to1,
            視頻ID: videoId
          });
          
          // 使用 postMessage 控制 YouTube iframe 音量
          try {
            const youtubeIframes = document.querySelectorAll('iframe[src*="youtube.com"]');
            if (youtubeIframes.length > 0) {
              const iframe = youtubeIframes[youtubeIframes.length - 1];
              if (iframe && iframe.contentWindow) {
                const volume = Math.round(validVolume * 100);
                // 使用正確的 postMessage 格式
                iframe.contentWindow.postMessage(JSON.stringify({
                  event: 'command',
                  func: 'setVolume',
                  args: [volume]
                }), '*');
              }
            }
            
            // 備用：嘗試直接 API 調用
            if (ytRef.current && typeof ytRef.current.setVolume === 'function') {
              try {
                const volume = Math.round(validVolume * 100);
                ytRef.current.setVolume(volume);
              } catch (apiError) {
                // 靜默處理 API 錯誤
              }
            }
          } catch (error) {
            console.warn("🔧 YouTube 音量設置失敗:", error.message);
          }
        },
        seekTo: (time) => {
          // 如果播放器引用為 null，嘗試重新初始化
          if (!ytRef.current) {
            console.warn("🔧 播放器引用為 null，嘗試重新初始化");
            // 使用防抖機制避免過度重新初始化
            if (reinitTimeoutRef.current) {
              clearTimeout(reinitTimeoutRef.current);
            }
            reinitTimeoutRef.current = setTimeout(() => {
              setPlayerKey(prev => prev + 1);
              reinitTimeoutRef.current = null;
            }, 200);
            return;
          }
          
          // 使用 DOM 操作來跳轉，避免直接調用 YouTube API
          try {
            // 找到 YouTube iframe 並使用 postMessage 來控制
            const youtubeIframes = document.querySelectorAll('iframe[src*="youtube.com"]');
            if (youtubeIframes.length > 0) {
              const iframe = youtubeIframes[youtubeIframes.length - 1]; // 使用最後一個 iframe
              if (iframe && iframe.contentWindow) {
                // ✅ 修正：args 應該是數組格式
                iframe.contentWindow.postMessage(JSON.stringify({
                  event: 'command',
                  func: 'seekTo',
                  args: [time, true] // true = 允許在未緩衝區域跳轉
                }), '*');
                console.log("🎯 [seekTo] 使用 postMessage 跳轉:", time);
                return;
              }
            }
            
            // 如果 postMessage 失敗，嘗試直接調用 API（但用更安全的方式）
            try {
              // 先檢查播放器是否真的有效
              const playerState = ytRef.current.getPlayerState();
              if (playerState !== null && playerState !== undefined) {
                ytRef.current.seekTo(time, true);
                console.log("✅ [seekTo] YouTube 直接跳轉成功:", time);
              } else {
                console.warn("⚠️ [seekTo] 播放器狀態無效，跳過跳轉");
              }
            } catch (directError) {
              console.warn("🔧 直接跳轉失敗:", directError.message);
            }
          } catch (error) {
            console.warn("🔧 跳轉失敗:", error.message);
          }
        },
        next: () => {
          // console.log("🔧 YouTube 下一首");
        },
        prev: () => {
          // console.log("🔧 YouTube 上一首");
        }
      });
      
      // 保存自動播放標記，防止被清除
      const savedAutoPlayTriggered = window.__AUTO_PLAY_TRIGGERED__;
      const persistentAutoPlay = window.__PERSISTENT_AUTO_PLAY__;
      
      // 檢查是否需要自動播放
      const shouldAutoPlay = player?.autoPlayAfterBridge || savedAutoPlayTriggered || persistentAutoPlay;
      
      if (!shouldAutoPlay || autoPlayTriggeredRef.current) {
        return;
      }
      
      // 設置標記，避免重複觸發
        autoPlayTriggeredRef.current = true;
        
        // 清除全域標記，避免其他播放器觸發
        player?.setAutoPlayAfterBridge?.(false);
        window.__AUTO_PLAY_TRIGGERED__ = false; // 清除標記
        
        // 增加延遲時間，確保播放器完全準備好
        setTimeout(() => {
          try {
            console.log("🔧 開始執行自動播放方法");
            
            // 檢查播放器狀態
            if (ytRef.current && typeof ytRef.current.getPlayerState === 'function') {
              try {
                const playerState = ytRef.current.getPlayerState();
                console.log("🔧 當前播放器狀態:", playerState);
                
                // 檢查播放器是否已經在播放
                if (playerState === 1) {
                  console.log("🔧 播放器已經在播放，跳過自動播放");
                  window.__PERSISTENT_AUTO_PLAY__ = false;
                  return;
                }
              } catch (stateError) {
                console.warn("🔧 獲取播放器狀態失敗:", stateError.message);
              }
            }
            
            // 嘗試播放
            let playSuccess = false;
            
            // 方法1: 直接調用 YouTube API
            if (ytRef.current && typeof ytRef.current.playVideo === 'function') {
              try {
                ytRef.current.playVideo();
                playSuccess = true;
                console.log("🔧 YouTube API 播放調用成功");
              } catch (error) {
                console.warn("🔧 YouTube API 播放失敗:", error.message);
              }
            }
            
            // 方法2: postMessage 作為備用
            if (!playSuccess) {
              const youtubeIframes = document.querySelectorAll('iframe[src*="youtube.com"]');
              if (youtubeIframes.length > 0) {
                const iframe = youtubeIframes[youtubeIframes.length - 1];
                if (iframe && iframe.contentWindow) {
                  try {
                    iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
                    console.log("🔧 postMessage 播放調用成功");
                  } catch (error) {
                    console.warn("🔧 postMessage 播放失敗:", error.message);
                  }
                }
              }
            }
            
            // 清除持久標記
            window.__PERSISTENT_AUTO_PLAY__ = false;
            
          } catch (playError) {
            console.warn("🔧 自動播放失敗:", playError.message);
          }
        }, 500); // 增加延遲到 500ms，確保播放器完全準備好
      
      
    } catch (error) {
      console.error("🔧 GlobalYouTubeBridge onReady 失敗:", error);
    }
  }, [videoId, player?.setExternalControls, player?.setExternalPlaying, player?.autoPlayAfterBridge, player?.setAutoPlayAfterBridge]);

  const onStateChange = useCallback((e) => {
    try {
      const code = e?.data;
      
      // 檢查播放器是否仍然有效
      if (!ytRef.current) {
        return;
      }
      
      // ✅ 監測狀態變化
      const stateNames = {
        '-1': 'UNSTARTED',
        0: 'ENDED',
        1: 'PLAYING',
        2: 'PAUSED',
        3: 'BUFFERING',
        5: 'CUED'
      };
      console.log(`🎬 [YouTube狀態]`, {
        狀態: stateNames[code] || `未知(${code})`,
        視頻ID: videoId,
        當前音量: Math.floor((ytRef.current.getVolume?.() || 0)),
        播放時間: Math.floor(ytRef.current.getCurrentTime?.() || 0)
      });
      
      if (code === 1) {
        // 播放中
        player?.setExternalPlaying?.(true);
        
        // ✅ 確保音量正確（在 PLAYING 狀態時再次設置）
        if (ytRef.current && player?.volume) {
          const volume = Math.round(player.volume * 100);
          try {
            ytRef.current.setVolume(volume);
            console.log('🔊 [PLAYING狀態] 同步音量:', volume);
          } catch (volError) {
            // 嘗試 postMessage
            const youtubeIframes = document.querySelectorAll('iframe[src*="youtube.com"]');
            if (youtubeIframes.length > 0) {
              const iframe = youtubeIframes[youtubeIframes.length - 1];
              if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage(JSON.stringify({
                  event: 'command',
                  func: 'setVolume',
                  args: [volume]
                }), '*');
                console.log('🔊 [PLAYING狀態] postMessage 同步音量:', volume);
              }
            }
          }
        }
        
        // 記錄播放開始時間（從暫停位置繼續）
        if (progressStateRef.current) {
          progressStateRef.current.isPlaying = true;
          progressStateRef.current.startTime = Date.now() - (progressStateRef.current.pausedAt * 1000);
        }
      } else if (code === 2) {
        // 暫停
        console.log('⏸️ [YouTube暫停]', {
          視頻ID: videoId,
          當前曲目: player?.trackTitle,
          當前時間: ytRef.current?.getCurrentTime?.() || 0,
          總時長: ytRef.current?.getDuration?.() || 0,
          當前索引: player?.activeIndex,
          歌單長度: player?.playlist?.length
        });
        
        player?.setExternalPlaying?.(false);
        
        // 保存暫停位置
        if (progressStateRef.current && progressStateRef.current.isPlaying) {
          const elapsed = (Date.now() - progressStateRef.current.startTime) / 1000;
          progressStateRef.current.pausedAt = Math.min(elapsed, progressStateRef.current.duration);
          progressStateRef.current.isPlaying = false;
        }
      } else if (code === 0) {
        // 播放結束
        console.log('🎵 [播放結束]', {
          視頻ID: videoId,
          當前曲目: player?.trackTitle,
          歌單長度: player?.playlist?.length,
          當前索引: player?.activeIndex,
          是否循環: player?.isLooping
        });
        
        player?.setExternalPlaying?.(false);
        
        // 重置進度狀態
        if (progressStateRef.current) {
          progressStateRef.current.isPlaying = false;
          progressStateRef.current.startTime = null;
          progressStateRef.current.pausedAt = 0;
        }
        
        // 播放結束，觸發下一首
        console.log('⏭️ [自動下一首] 準備播放下一首', {
          當前分頁: document.hidden ? '後台' : '前台'
        });
        
        // 直接觸發下一首，不管是否在後台
        // YouTube 允許用戶已互動過的頁面在後台自動播放下一首
        player?.next?.();
        
        // 如果在後台分頁，標記需要在前台時確保播放
        if (document.hidden) {
          console.log('🌙 [後台播放] 標記前台恢復播放');
          shouldResumeOnVisibleRef.current = true;
        }
      } else if (code === 3) {
        // 緩衝中
        // console.log("🔧 YouTube 緩衝中");
      } else if (code === 5) {
        // 視頻已載入
        // console.log("🔧 YouTube 視頻已載入");
      }
    } catch (error) {
      console.error("🔧 GlobalYouTubeBridge onStateChange 失敗:", error.message);
    }
  }, [player?.setExternalPlaying, player?.next, videoId, player?.setExternalProgress]);


  // ✅ 監聽 player.isPlaying 變化，同步控制 YouTube 播放器
  useEffect(() => {
    const currentIsPlaying = player?.isPlaying;
    
    // 如果播放狀態沒有變化，跳過
    if (currentIsPlaying === lastIsPlayingRef.current) {
      return;
    }
    
    // 更新上次的狀態
    lastIsPlayingRef.current = currentIsPlaying;
    
    if (!videoId) {
      return;
    }
    
    // 使用 postMessage 方式更安全，不會直接調用可能有問題的 YouTube API
    const controlPlayer = () => {
      try {
        const iframes = document.querySelectorAll('iframe[src*="youtube.com"]');
        if (iframes.length === 0) return;
        
        const iframe = iframes[iframes.length - 1];
        if (!iframe || !iframe.contentWindow) return;
        
        if (currentIsPlaying) {
          iframe.contentWindow.postMessage(JSON.stringify({
            event: 'command',
            func: 'playVideo',
            args: []
          }), '*');
        } else {
          iframe.contentWindow.postMessage(JSON.stringify({
            event: 'command',
            func: 'pauseVideo',
            args: []
          }), '*');
        }
      } catch (error) {
        console.error('❌ [YouTube同步] 失敗:', error.message);
      }
    };
    
    controlPlayer();
  }, [player?.isPlaying, videoId]);

  // 播放器健康檢查
  useEffect(() => {
    const healthCheck = () => {
      // 如果在後台分頁，跳過健康檢查
      if (document.hidden) {
        console.log('🌙 [健康檢查] 後台分頁，跳過檢查');
        return;
      }
      
      if (ytRef.current && typeof ytRef.current.getPlayerState === 'function') {
        try {
          const state = ytRef.current.getPlayerState();
          // state 可能是 -1 (UNSTARTED), 0 (ENDED), 1 (PLAYING), 2 (PAUSED), 3 (BUFFERING), 5 (CUED)
          // 只有當 state 真正無效（null/undefined）且播放器應該存在時才重置
          if (state === null || state === undefined) {
            // 再次確認：如果有 videoId，說明應該有播放器，但狀態無效
            if (videoId) {
              console.warn("🔧 播放器健康檢查失敗，重新初始化", {
                state,
                videoId,
                hasYtRef: !!ytRef.current
              });
              // 重新設置播放器引用
              ytRef.current = null;
            }
          } else {
            console.log('✅ [健康檢查] 播放器正常，狀態:', state, 'videoId:', videoId);
          }
        } catch (error) {
          console.warn("🔧 播放器健康檢查錯誤:", error.message);
          // 不要立即重置，給播放器一次機會
          // ytRef.current = null;
        }
      }
    };
    
    const healthCheckInterval = setInterval(healthCheck, 60000); // 改為每60秒檢查一次，減少干擾
    return () => clearInterval(healthCheckInterval);
  }, [videoId]);

  // 使用定時器來定期更新進度
  useEffect(() => {
    if (!player?.setExternalProgress) {
      return;
    }
    
    
    const updateProgress = () => {
      try {
        const state = progressStateRef.current;
        
        // 獲取時長
        if (ytRef.current && typeof ytRef.current.getDuration === 'function') {
          const duration = ytRef.current.getDuration() || 0;
          if (duration > 0 && state.duration === 0) {
            state.duration = duration;
          }
        }
        
        // 計算當前時間
        let currentTime = 0;
        if (state.isPlaying && state.startTime && state.duration > 0) {
          const elapsed = (Date.now() - state.startTime) / 1000;
          currentTime = Math.min(elapsed, state.duration);
        } else if (!state.isPlaying && state.pausedAt > 0) {
          // 暫停時顯示暫停位置
          currentTime = state.pausedAt;
        } else if (!state.isPlaying && state.pausedAt === 0 && state.duration > 0) {
          // 剛開始播放但還未設置 startTime，使用上一次的 currentTime
          // 這樣可以避免進度條閃爍回 0
          return; // 跳過這次更新，等待下一次 interval
        }
        
        // 嘗試從 YouTube API 校準（如果可用）
        try {
          if (ytRef.current && typeof ytRef.current.getCurrentTime === 'function') {
            const apiTime = ytRef.current.getCurrentTime();
            if (apiTime > 0 && state.isPlaying) {
              // API 返回有效時間，使用它來校準
              state.startTime = Date.now() - (apiTime * 1000);
              currentTime = apiTime;
            }
          }
        } catch (e) {
          // YouTube API 不可用，繼續使用本地時間
        }
        
        // 只在有有效 duration 時才更新進度
        if (state.duration > 0) {
          // 添加調試日誌（僅在數值異常時輸出）
          if (currentTime === 0 && state.isPlaying) {
            console.log("🔧 GlobalYouTubeBridge 進度異常:", {
              currentTime,
              duration: state.duration,
              isPlaying: state.isPlaying,
              startTime: state.startTime,
              pausedAt: state.pausedAt,
              elapsed: state.startTime ? (Date.now() - state.startTime) / 1000 : 0
            });
          }
          player.setExternalProgress(currentTime, state.duration);
          
          // 檢查是否播放到最後（防止後台分頁時 onStateChange 不觸發）
          // ✅ 加入防抖：避免進度條跳轉時誤觸發
          const isNearEnd = currentTime >= state.duration - 0.5;
          const shouldTriggerNext = state.isPlaying && isNearEnd && !isTransitioningRef.current;
          
          if (shouldTriggerNext) {
            console.log('🎵 [備用播放結束檢測] 檢測到播放結束', {
              currentTime,
              duration: state.duration,
              當前索引: player?.activeIndex,
              歌單長度: player?.playlist?.length,
              是否轉換中: isTransitioningRef.current
            });
            
            // 設置轉換標記，防止重複觸發
            isTransitioningRef.current = true;
            
            // 播放結束，觸發下一首
            player?.setExternalPlaying?.(false);
            
            // 重置進度狀態
            state.isPlaying = false;
            state.startTime = null;
            state.pausedAt = 0;
            
            // 如果在後台分頁，標記需要在前台時繼續播放
            if (document.hidden) {
              shouldResumeOnVisibleRef.current = true;
            }
            
            // 觸發下一首
            console.log('⏭️ [備用播放結束檢測] 準備觸發下一首');
            player?.next?.();
            
            // 1秒後重置轉換標記
            setTimeout(() => {
              isTransitioningRef.current = false;
            }, 1000);
          }
        }
      } catch (error) {
        console.warn("🔧 進度更新失敗:", error);
      }
    };
    
    // 每 1 秒更新一次進度（更頻繁的更新）
    const interval = setInterval(updateProgress, 1000);
    
    // 移除手動播放按鈕，專注於進度條修復
    
    return () => {
      // console.log("🔧 清理進度更新定時器");
      clearInterval(interval);
    };
  }, [player?.setExternalProgress]);

  // 使用 YouTube API 的 onProgress 事件來更新進度
  const onProgress = useCallback((e) => {
    try {
      const currentTime = e?.target?.getCurrentTime?.() || 0;
      const duration = e?.target?.getDuration?.() || 0;
      
      if (currentTime > 0 && duration > 0) {
        player?.setExternalProgress?.(currentTime, duration);
        console.log("🔧 YouTube onProgress 進度更新:", { currentTime, duration });
      }
    } catch (error) {
      console.warn("🔧 onProgress 進度更新失敗:", error);
    }
  }, [player?.setExternalProgress]);

  // 當 videoId 變化時，重置自動播放觸發標記
  useEffect(() => {
    autoPlayTriggeredRef.current = false;
    // 不要重置 window.__AUTO_PLAY_TRIGGERED__，讓它保持到播放器初始化
        // console.log("🔧 重置自動播放觸發標記");
    
    // 設置播放器源
    if (player?.setSrc && player?.originUrl) {
      player.setSrc(player.originUrl);
    }
    
    // 如果播放器已經存在，嘗試快速切換視頻
    if (ytRef.current && typeof ytRef.current.loadVideoById === 'function') {
      // console.log("🔧 嘗試快速切換視頻:", videoId);
      try {
        ytRef.current.loadVideoById(videoId);
        // 設置自動播放
        if (window.__AUTO_PLAY_TRIGGERED__ || window.__PERSISTENT_AUTO_PLAY__) {
          setTimeout(() => {
            if (ytRef.current && typeof ytRef.current.playVideo === 'function') {
              ytRef.current.playVideo();
              // console.log("🔧 快速切換後自動播放");
            }
          }, 500);
        }
        return; // 如果快速切換成功，不需要重新創建播放器
      } catch (error) {
        // console.warn("🔧 快速切換失敗，重新創建播放器:", error.message);
      }
    }
    
    // 檢查是否需要強制重新創建播放器
    if (window.__FORCE_RECREATE_PLAYER__) {
      console.log("🔧 強制重新創建播放器");
      window.__FORCE_RECREATE_PLAYER__ = false;
      
      // 清理所有播放器引用
      ytRef.current = null;
      
      // 強制重新創建播放器
      setPlayerKey(prev => prev + 1);
    } else {
      // 保存當前的播放器引用，避免清理新播放器
      const oldPlayerRef = ytRef.current;
      
      // 延遲清理舊播放器，避免在初始化過程中清理
      const cleanupTimer = setTimeout(() => {
        // 只清理舊的播放器引用，不影響新的播放器
        if (oldPlayerRef && oldPlayerRef !== ytRef.current) {
          try {
            // 檢查播放器是否仍然有效
            if (typeof oldPlayerRef.getPlayerState === 'function') {
              try {
                const state = oldPlayerRef.getPlayerState();
                if (state !== undefined) {
                  // 播放器仍然有效，嘗試停止
                  if (typeof oldPlayerRef.pauseVideo === 'function') {
                    oldPlayerRef.pauseVideo();
                  }
                  if (typeof oldPlayerRef.stopVideo === 'function') {
                    oldPlayerRef.stopVideo();
                  }
                }
              } catch (stateError) {
                // 播放器已經無效，直接清理
                console.log("🔧 舊播放器狀態檢查失敗，直接清理");
              }
            }
          } catch (error) {
            console.warn("🔧 停止舊播放器失敗:", error.message);
          }
        }
      }, 500); // 延遲 500ms 清理
      
      // 強制重新創建播放器
      setPlayerKey(prev => prev + 1);
      
      return () => {
        clearTimeout(cleanupTimer);
      };
    }
  }, [videoId]);

  // 監聽 originUrl 變化，確保播放器能正確初始化
  useEffect(() => {
    if (player?.originUrl && videoId) {
      // console.log("🔧 GlobalYouTubeBridge 檢測到 originUrl 變化:", {
      //   originUrl: player.originUrl,
      //   videoId,
      //   hasPlayer: !!player,
      //   hasSetExternalControls: typeof player.setExternalControls === 'function'
      // });
      
      // 重置播放器狀態，確保能正確初始化
      setPlayerKey(prev => prev + 1);
    }
  }, [player?.originUrl, videoId]);

  // 組件卸載時的清理
  useEffect(() => {
    return () => {
      // 清理播放器引用
      safeCleanupPlayer(ytRef);
    };
  }, []);


  // 條件檢查移到所有 Hooks 之後
  if (!player?.originUrl || !videoId) {
    return null;
  }

  return (
    <YoutubeFallback
      key={playerKey} // 使用 playerKey，而不是 videoId
      videoId={videoId}
      onReady={onReady}
      onStateChange={onStateChange}
      onProgress={onProgress}
    />
  );
}