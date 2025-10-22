'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import MusicGrid from '@/components/music/MusicGrid';
import { usePlayer } from '@/components/context/PlayerContext';
import { useCurrentUser } from '@/contexts/CurrentUserContext';

const MusicPage = () => {
  const [music, setMusic] = useState([]);
  const [loading, setLoading] = useState(true);
  const player = usePlayer();
  const { currentUser } = useCurrentUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  // 監聽搜尋參數變化（包括清空）
  useEffect(() => {
    loadMusic();
  }, [searchParams]);

  // 播放器邏輯（參考首頁）
  useEffect(() => {
    // 等待 currentUser 載入完成
    if (currentUser === undefined) {
      return;
    }
    
    // 監聽釘選事件
    const handlePinnedChange = (e) => {
      if (e.detail.isPinned) {
        // 用戶剛釘選播放器，使用事件中的數據
        const pinnedPlayer = e.detail.pinnedPlayer;
        const playlist = pinnedPlayer?.playlist || [];
        
        if (playlist.length > 0) {
          const currentIndex = pinnedPlayer.currentIndex || 0;
          const currentTrack = playlist[currentIndex];
          
          player?.setPlaylist?.(playlist);
          player?.setActiveIndex?.(currentIndex);
          player?.setPlayerOwner?.({ 
            userId: pinnedPlayer.userId, 
            username: pinnedPlayer.username 
          });
          
          if (currentTrack) {
            player?.setSrc?.(currentTrack.url);
            player?.setOriginUrl?.(currentTrack.url);
            player?.setTrackTitle?.(currentTrack.title || currentTrack.url);
          }
          
          player?.setMiniPlayerEnabled?.(true);
        }
        
        player?.setShareMode?.("global");
      } else {
        // 用戶取消釘選，清空播放器
        player?.setMiniPlayerEnabled?.(false);
        player?.pause?.();
        player?.setExternalControls?.(null);
        player?.setExternalPlaying?.(false);
        player?.setSrc?.('');
        player?.setOriginUrl?.('');
        player?.setTrackTitle?.('');
        player?.setPlaylist?.([]);
        player?.setShareMode?.("global");
      }
    };
    
    // 註冊事件監聽器
    window.addEventListener('pinnedPlayerChanged', handlePinnedChange);

    // 檢查釘選播放器（參考首頁邏輯）
    const pinnedPlayer = currentUser?.user?.pinnedPlayer || currentUser?.pinnedPlayer;
    const hasPinnedPlayer = pinnedPlayer?.userId && 
      pinnedPlayer?.expiresAt && 
      new Date(pinnedPlayer.expiresAt) > new Date();
    
    if (hasPinnedPlayer) {
      // 恢復釘選播放器
      const playlist = pinnedPlayer.playlist || [];
      if (playlist.length > 0) {
        const currentIndex = pinnedPlayer.currentIndex || 0;
        const currentTrack = playlist[currentIndex];
        
        player?.setPlaylist?.(playlist);
        player?.setActiveIndex?.(currentIndex);
        player?.setPlayerOwner?.({ 
          userId: pinnedPlayer.userId, 
          username: pinnedPlayer.username 
        });
        
        if (currentTrack) {
          player?.setSrc?.(currentTrack.url);
          player?.setOriginUrl?.(currentTrack.url);
          player?.setTrackTitle?.(currentTrack.title || currentTrack.url);
        }
        
        player?.setMiniPlayerEnabled?.(true);
      }
    } else {
      // 沒有釘選數據，設定為全局模式但不顯示播放器
      player?.setShareMode?.("global");
      player?.setMiniPlayerEnabled?.(false);
    }
    
    return () => {
      window.removeEventListener('pinnedPlayerChanged', handlePinnedChange);
    };
  }, [currentUser]); // 移除 player 依賴，避免無限循環

  const loadMusic = async () => {
    try {
      // 獲取搜尋參數
      const searchQuery = searchParams.get('search') || '';
      
      // 構建 API URL
      const params = new URLSearchParams({
        page: '1',
        limit: '20',
        sort: 'popular',
        live: '1'
      });
      
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }
      
      const response = await fetch(`/api/music?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setMusic(data.music || []);
      }
      setLoading(false);
    } catch (error) {
      console.error('載入音樂失敗:', error);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* 頁面標題 */}
      <div className="bg-zinc-900 shadow-sm border-b border-zinc-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div>
            <h1 className="text-3xl font-bold text-white">🎵 音樂專區</h1>
            <p className="mt-2 text-gray-400">探索精彩的 AI 生成音樂</p>
          </div>
        </div>
      </div>

      {/* 音樂列表 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
            <p className="mt-4 text-gray-400">載入中...</p>
          </div>
        ) : music.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎵</div>
            <h3 className="text-xl font-semibold text-white mb-2">還沒有音樂</h3>
            <p className="text-gray-400 mb-6">成為第一個上傳音樂的人吧！</p>
            <button
              onClick={() => window.dispatchEvent(new Event('openMusicUploadModal'))}
              className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              🎵 上傳第一首音樂
            </button>
          </div>
        ) : (
          <MusicGrid
            music={music}
            onSelectMusic={(track) => {
              // 這裡可以打開音樂播放 Modal 或直接播放
              console.log('播放音樂:', track.title);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default MusicPage;

