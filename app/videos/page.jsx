'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import VideoModal from '@/components/video/VideoModal';
import EditVideoModal from '@/components/video/EditVideoModal';
import VideoGrid from '@/components/video/VideoGrid';
import SortSelect from '@/components/common/SortSelect';
import { usePlayer } from '@/components/context/PlayerContext';

const PAGE_SIZE = 20;

const VideosPage = () => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [sort, setSort] = useState('popular');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchedOnce, setFetchedOnce] = useState(false);
  
  const player = usePlayer();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Refs for infinite scroll
  const loadMoreRef = useRef(null);
  const isFetchingRef = useRef(false);
  const lastFetchParamsRef = useRef(null);
  const pageRef = useRef(1);
  const sortRef = useRef('popular');
  const searchRef = useRef('');

  // 載入當前用戶（只在初始化時）
  useEffect(() => {
    loadCurrentUser();
  }, []);

  // 同步最新的查詢條件到 refs（避免閉包舊值）
  useEffect(() => {
    searchRef.current = (searchParams.get('search') || '').trim();
  }, [searchParams]);
  
  useEffect(() => {
    sortRef.current = sort;
  }, [sort]);
  
  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  // fetchVideos 函數（使用 useCallback 避免重複創建）
  const fetchVideos = useCallback(async (pageNum, searchQuery, sortType) => {
    if (isLoading) return;
    
    setIsLoading(true);
    
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: PAGE_SIZE.toString(),
        sort: sortType,
        live: '1'
      });
      
      if (searchQuery) {
        params.append('search', searchQuery);
      }
      
      const response = await fetch(`/api/videos?${params}`);
      const data = await response.json();
      
      if (data.success) {
        const newVideos = data.videos || [];
        
        if (pageNum === 1) {
          setVideos(newVideos);
        } else {
          setVideos(prev => [...prev, ...newVideos]);
        }
        
        setPage(pageNum);
        setHasMore(newVideos.length === PAGE_SIZE);
        setFetchedOnce(true);
      }
    } catch (error) {
      console.error('載入影片失敗:', error);
    } finally {
      setIsLoading(false);
      setLoading(false);
    }
  }, [isLoading]);

  // 監聽搜尋或排序變化
  useEffect(() => {
    const searchQuery = (searchParams.get('search') || '').trim();
    
    // 檢查參數是否與上次相同
    const currentParams = JSON.stringify({
      search: searchQuery,
      sort: sort
    });
    
    if (lastFetchParamsRef.current === currentParams) {
      return;
    }
    
    lastFetchParamsRef.current = currentParams;
    
    // 重置狀態並載入第一頁
    setFetchedOnce(false);
    setVideos([]);
    setPage(1);
    setHasMore(true);
    fetchVideos(1, searchQuery, sort);
  }, [searchParams, sort, fetchVideos]);

  // 無限滾動
  useEffect(() => {
    if (!hasMore || isLoading || !fetchedOnce) return;
    const el = loadMoreRef.current;
    if (!el) return;

    const handleLoadMore = () => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      const searchQuery = searchRef.current;
      const sortType = sortRef.current;
      const nextPage = (pageRef.current || 1) + 1;
      fetchVideos(nextPage, searchQuery, sortType).finally(() => {
        isFetchingRef.current = false;
      });
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          handleLoadMore();
        }
      },
      { root: null, rootMargin: '500px 0px', threshold: 0.01 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, isLoading, fetchedOnce, fetchVideos]);

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

  const loadCurrentUser = async () => {
    try {
      const response = await fetch('/api/current-user', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setCurrentUser(data?.user || null);
      } else {
        setCurrentUser(null);
      }
    } catch (error) {
      console.error('載入用戶失敗:', error);
      setCurrentUser(null);
    }
  };


  const handleVideoDelete = async (videoId) => {
    try {
      const response = await fetch(`/api/videos/${videoId}/delete`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        // 從列表中移除已刪除的影片
        setVideos(prevVideos => prevVideos.filter(v => v._id !== videoId));
        // 關閉 Modal
        setShowVideoModal(false);
        setSelectedVideo(null);
        console.log('✅ 影片刪除成功');
      } else {
        const error = await response.json();
        console.error('❌ 刪除影片失敗:', error);
        alert('刪除失敗：' + (error.error || '未知錯誤'));
      }
    } catch (error) {
      console.error('❌ 刪除影片錯誤:', error);
      alert('刪除失敗，請稍後再試');
    }
  };

  const handleToggleLike = async (videoId) => {
    try {
      const response = await fetch(`/api/videos/${videoId}/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        
        // 樂觀更新：立即更新點讚數
        setVideos(prev => prev.map(video => 
          video._id === videoId 
            ? { 
                ...video, 
                likes: data.likes,
                likesCount: data.likes.length 
              }
            : video
        ));
        
        // 重新抓取資料以更新熱門度排序
        // 使用小延遲確保資料庫已更新
        setTimeout(() => {
          const searchQuery = searchParams.get('search') || '';
          fetchVideos(1, searchQuery, sort);
        }, 500);
      }
    } catch (error) {
      console.error('愛心切換失敗:', error);
    }
  };

  // 使用 useMemo 保護 videos 數據，防止不必要的重新渲染
  const memoizedVideos = useMemo(() => {
    return videos;
  }, [videos]);

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* 頁面標題 */}
      <div className="bg-zinc-900 shadow-sm border-b border-zinc-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">🎬 影片專區</h1>
              <p className="mt-2 text-gray-400">探索精彩的 AI 生成影片</p>
            </div>
            {/* 排序選擇器 */}
            <div className="flex-shrink-0">
              <SortSelect value={sort} onChange={setSort} />
            </div>
          </div>
        </div>
      </div>

      {/* 影片網格 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
            <p className="mt-4 text-gray-400">載入中...</p>
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎬</div>
            <h3 className="text-xl font-semibold text-white mb-2">還沒有影片</h3>
            <p className="text-gray-400 mb-6">成為第一個上傳影片的人吧！</p>
            <button
              onClick={() => window.dispatchEvent(new Event('openVideoUploadModal'))}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              🎬 上傳第一個影片
            </button>
          </div>
        ) : (
          <>
            <VideoGrid
              videos={memoizedVideos}
              onSelectVideo={(video) => {
                setSelectedVideo(video);
                setShowVideoModal(true);
              }}
              currentUser={currentUser}
              onToggleLike={handleToggleLike}
            />
            
            {/* 無限滾動觸發器 */}
            {hasMore && (
              <div ref={loadMoreRef} className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>
                <p className="mt-2 text-gray-400 text-sm">載入更多影片...</p>
              </div>
            )}
            
            {/* 沒有更多內容時的提示 */}
            {!hasMore && videos.length > 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500">已經到底了 🎬</p>
              </div>
            )}
          </>
        )}
      </div>
      
      {/* 影片播放 Modal */}
      {showVideoModal && selectedVideo && (
        <VideoModal
          video={selectedVideo}
          currentUser={currentUser}
          displayMode="gallery"
          onClose={() => {
            setShowVideoModal(false);
            setSelectedVideo(null);
          }}
          onUserClick={() => {
            const authorId = selectedVideo?.author?._id || selectedVideo?.author;
            if (authorId) {
              router.push(`/user/${authorId}`);
            }
          }}
          onDelete={handleVideoDelete}
          canEdit={currentUser && selectedVideo?.author?._id && String(currentUser._id) === String(selectedVideo.author._id)}
          onEdit={() => {
            setShowEditModal(true);
          }}
          isLiked={Array.isArray(selectedVideo?.likes) && currentUser?._id ? selectedVideo.likes.includes(currentUser._id) : false}
          onToggleLike={handleToggleLike}
        />
      )}

      {/* 編輯影片 Modal */}
      {showEditModal && selectedVideo && (
        <EditVideoModal
          video={selectedVideo}
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSuccess={(updatedVideo) => {
            // 更新影片列表中的資料
            setVideos(prev => prev.map(v => 
              v._id === updatedVideo._id ? updatedVideo : v
            ));
            // 更新選中的影片
            setSelectedVideo(updatedVideo);
            // 關閉編輯 Modal
            setShowEditModal(false);
          }}
        />
      )}
    </div>
  );
};

export default VideosPage;
