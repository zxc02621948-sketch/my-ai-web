'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import VideoModal from '@/components/video/VideoModal';
import EditVideoModal from '@/components/video/EditVideoModal';
import VideoGrid from '@/components/video/VideoGrid';
import SortSelect from '@/components/common/SortSelect';
import { usePlayer } from '@/components/context/PlayerContext';
import { useFilterContext, labelToRating } from '@/components/context/FilterContext';
import usePinnedPlayerBootstrap from '@/hooks/usePinnedPlayerBootstrap';
import usePaginatedResource from '@/hooks/usePaginatedResource';
import { notify } from '@/components/common/GlobalNotificationManager';

const PAGE_SIZE = 20;

const VideosPage = () => {
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [sort, setSort] = useState('popular');
  
  const player = usePlayer();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // ✅ 新增：篩選功能
  const {
    levelFilters,
    categoryFilters,
    isInitialized, // 確保 FilterContext 已從 localStorage 恢復
  } = useFilterContext();
  
  const loadMoreRef = useRef(null);
 
  // 載入當前用戶（只在初始化時）
  const loadCurrentUser = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    loadCurrentUser();
  }, [loadCurrentUser]);

  const selectedRatings = useMemo(
    () => levelFilters.map((label) => labelToRating[label]).filter(Boolean),
    [levelFilters],
  );

  const searchQuery = useMemo(
    () => (searchParams.get('search') || '').trim(),
    [searchParams],
  );

  const categoriesKey = useMemo(
    () => categoryFilters.join(','),
    [categoryFilters],
  );

  const ratingsKey = useMemo(
    () => selectedRatings.join(','),
    [selectedRatings],
  );

  const paginationDeps = useMemo(
    () => [
      sort,
      searchQuery,
      categoriesKey,
      ratingsKey,
      isInitialized ? 'ready' : 'pending',
    ],
    [sort, searchQuery, categoriesKey, ratingsKey, isInitialized],
  );

  const fetchVideosPage = useCallback(
    async (targetPage = 1) => {
      const apiSort = sort.toLowerCase();
      const params = new URLSearchParams({
        page: String(targetPage),
        limit: String(PAGE_SIZE),
        sort: apiSort,
        live: '1',
      });

      if (searchQuery) {
        params.set('search', searchQuery);
      }
      if (categoryFilters.length) {
        params.set('categories', categoriesKey);
      }
      if (selectedRatings.length) {
        params.set('ratings', ratingsKey);
      }

      try {
        const response = await fetch(`/api/videos?${params.toString()}`);
        const data = await response.json();
        const items = Array.isArray(data?.videos) ? data.videos : [];
        return {
          items,
          hasMore: items.length === PAGE_SIZE,
        };
      } catch (error) {
        console.error('載入影片失敗:', error);
        // ✅ 只在首次加載失敗時顯示錯誤提示，避免無限滾動時頻繁提示
        if (targetPage === 1) {
          notify.error('載入失敗', '無法載入影片列表，請稍後再試');
        }
        return {
          items: [],
          hasMore: false,
        };
      }
    },
    [
      sort,
      searchQuery,
      categoryFilters,
      categoriesKey,
      selectedRatings,
      ratingsKey,
    ],
  );

  const {
    items: videos,
    hasMore,
    loading: loadingVideos,
    loadingMore,
    loadMore,
    setItems: setVideoItems,
    refresh,
  } = usePaginatedResource({
    fetchPage: fetchVideosPage,
    deps: paginationDeps,
    enabled: isInitialized,
  });

  // 無限滾動
  useEffect(() => {
    if (!isInitialized || !hasMore || loadingVideos || loadingMore) return;
    const el = loadMoreRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { root: null, rootMargin: '500px 0px', threshold: 0.01 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [isInitialized, hasMore, loadMore, loadingVideos, loadingMore]);

  // 播放器邏輯（參考首頁）
  usePinnedPlayerBootstrap({ player, currentUser, shareMode: "global" });

  const handleVideoDelete = async (videoId) => {
    try {
      const response = await fetch(`/api/videos/${videoId}/delete`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        // 從列表中移除已刪除的影片
        setVideoItems(prevVideos =>
          Array.isArray(prevVideos)
            ? prevVideos.filter((v) => v._id !== videoId)
            : prevVideos
        );
        // 關閉 Modal
        setShowVideoModal(false);
        setSelectedVideo(null);
        console.log('✅ 影片刪除成功');
      } else {
        const error = await response.json();
        console.error('❌ 刪除影片失敗:', error);
        notify.error('刪除失敗', error.error || '未知錯誤');
      }
    } catch (error) {
      console.error('❌ 刪除影片錯誤:', error);
      notify.error('刪除失敗', '請稍後再試');
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
        setVideoItems(prev =>
          Array.isArray(prev)
            ? prev.map(video =>
                video._id === videoId
                  ? {
                      ...video,
                      likes: data.likes,
                      likesCount: data.likes.length,
                    }
                  : video,
              )
            : prev,
        );

        setSelectedVideo(prev =>
          prev && prev._id === videoId
            ? {
                ...prev,
                likes: data.likes,
                likesCount: data.likes.length,
              }
            : prev,
        );

        // 重新抓取資料以更新熱門度排序
        // 使用小延遲確保資料庫已更新
        setTimeout(() => {
          refresh();
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

  const isInitialLoading = (!isInitialized && videos.length === 0) || (loadingVideos && videos.length === 0);

  return (
    <div className="min-h-screen bg-zinc-950 -mt-2 md:-mt-16">
      {/* 頁面標題 */}
      <div className="bg-zinc-900 shadow-sm border-b border-zinc-700">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-3 sm:gap-6">
            {/* 左側：標題和描述 */}
            <div>
              <h1 className="text-3xl font-bold text-white">🎬 影片專區</h1>
              <p className="mt-1 text-gray-400">探索精彩的 AI 生成影片</p>
            </div>
            
            {/* 中間：版本資訊和法律連結（手機版隱藏） */}
            <div className="hidden md:flex items-center gap-4 text-xs text-gray-400 flex-1 justify-center flex-wrap">
                <div className="flex items-center gap-2">
                  <a href="/about" className="hover:text-white transition text-sm font-medium text-blue-400">我們的故事</a>
              <span className="text-gray-600">•</span>
              <span className="text-sm text-yellow-400">版本 v0.8.0（2025-11-05）🎉</span>
            </div>
              <div className="flex items-center gap-2">
                <a href="/changelog" className="text-sm underline hover:text-white">
                  查看更新內容
                </a>
                <span className="text-gray-600">•</span>
                <a href="/privacy" className="hover:text-white transition">隱私政策</a>
                <span className="text-gray-600">•</span>
                <a href="/terms" className="hover:text-white transition">服務條款</a>
              </div>
            </div>
            
            {/* 右側：排序選擇器 */}
            <div className="flex items-center gap-3">
              <SortSelect value={sort} onChange={setSort} />
              <a
                href="/videos/create"
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-purple-500/40 hover:from-purple-500 hover:via-fuchsia-500 hover:to-pink-500 transition"
              >
                <span role="img" aria-label="前往創作影片">🎬</span>
                前往創作影片
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* 影片網格 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isInitialLoading ? (
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
            {hasMore ? (
              <div ref={loadMoreRef} className="text-center py-8">
                {loadingMore ? (
                  <div>
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>
                    <p className="mt-2 text-gray-400 text-sm">載入更多影片...</p>
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">向下捲動以載入更多影片...</p>
                )}
              </div>
            ) : (
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
            setVideoItems(prev => prev.map(v => 
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
