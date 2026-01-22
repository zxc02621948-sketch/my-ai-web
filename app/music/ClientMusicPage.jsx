"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import MusicGrid from "@/components/music/MusicGrid";
import MusicModal from "@/components/music/MusicModal";
import EditMusicModal from "@/components/music/EditMusicModal";
import SortSelect from "@/components/common/SortSelect";
import BackToTopButton from "@/components/common/BackToTopButton";
import { usePlayer } from "@/components/context/PlayerContext";
import { useCurrentUser } from "@/contexts/CurrentUserContext";
import {
  useFilterContext,
  musicLabelToRating,
} from "@/components/context/FilterContext";
import usePinnedPlayerBootstrap from "@/hooks/usePinnedPlayerBootstrap";
import usePaginatedResource from "@/hooks/usePaginatedResource";
import useVisitTracking from "@/hooks/useVisitTracking";
import { audioManager } from "@/utils/audioManager";
import { warmupAudioBatch } from "@/utils/audioWarmup";
import {
  MUSIC_TYPE_MAP,
  MUSIC_LANGUAGES,
  LANGUAGE_MAP,
} from "@/constants/musicCategories";

const MusicPage = () => {
  const [selectedMusic, setSelectedMusic] = useState(null);
  const [showMusicModal, setShowMusicModal] = useState(false);
  const [editingMusic, setEditingMusic] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [sort, setSort] = useState("popular");
  
  // ✅ 修復：使用 useCallback 穩定 onClose 函數引用，避免 MusicModal 重新掛載
  const handleMusicModalClose = useCallback(() => {
    setShowMusicModal(false);
    setSelectedMusic(null);
    // 確保恢復 body 滾動
    document.body.style.overflow = "";
    document.body.style.position = "";
  }, []);
  
  // ✅ 訪問記錄追蹤
  useVisitTracking();
  
  const player = usePlayer();
  const { currentUser } = useCurrentUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const prevPathnameRef = useRef(pathname); // ✅ 記錄上次的 pathname，用於檢測真正的頁面切換
  
  // ✅ 修復：組件掛載時強制檢查並恢復 body 狀態（防止殘留狀態）
  useEffect(() => {
    // ✅ 修復：組件掛載時，如果彈窗沒有打開，但 body 被鎖定，強制恢復
    if (!showMusicModal) {
      const currentOverflow = document.body.style.overflow;
      const currentComputedOverflow = typeof window !== 'undefined' ? window.getComputedStyle(document.body).overflow : '';
      if (currentOverflow === "hidden" || currentComputedOverflow === "hidden" || document.body.style.position === "fixed") {
        document.body.style.overflow = "";
        document.body.style.position = "";
        document.body.style.width = "";
        document.body.style.height = "";
      }
    }
    
    // ✅ 組件卸載時的清理
    return () => {
      // ✅ 組件卸載時，如果彈窗還開著，強制關閉並恢復 body 狀態
      if (showMusicModal) {
        document.body.style.overflow = "";
        document.body.style.position = "";
        document.body.style.width = "";
        document.body.style.height = "";
      }
    };
    
    // 檢查 body 狀態，如果被設置為 hidden，強制恢復
    const currentOverflow = document.body.style.overflow;
    const currentPosition = document.body.style.position;
    
    // 如果 body 被鎖定但彈窗沒有打開，強制恢復
    if ((currentOverflow === "hidden" || currentPosition === "fixed") && !showMusicModal) {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.height = "";
    }
  }, []); // 只在組件掛載時執行一次
  
  const {
    levelFilters,
    categoryFilters,
    typeFilters,
    languageFilters,
    toggleTypeFilter,
    toggleLanguageFilter,
    isInitialized,
  } = useFilterContext();

  // 計算選中的評級
  const selectedRatings = useMemo(
    () =>
      levelFilters.map((label) => musicLabelToRating[label]).filter(Boolean),
    [levelFilters],
  );

  const searchQuery = searchParams.get("search") || "";

  const ratingsKey = useMemo(
    () => selectedRatings.join(","),
    [selectedRatings],
  );
  const categoriesKey = useMemo(
    () => categoryFilters.join(","),
    [categoryFilters],
  );
  const typesKey = useMemo(
    () => typeFilters.join(","),
    [typeFilters],
  );
  const languagesKey = useMemo(
    () => languageFilters.join(","),
    [languageFilters],
  );

  const paginationDeps = useMemo(
    () => [
      sort,
      searchQuery,
      ratingsKey,
      categoriesKey,
      typesKey,
      languagesKey,
      isInitialized ? "ready" : "pending",
    ],
    [
      sort,
      searchQuery,
      ratingsKey,
      categoriesKey,
      typesKey,
      languagesKey,
      isInitialized,
    ],
  );

  const fetchMusicPage = useCallback(
    async (targetPage = 1) => {
      if (!isInitialized) {
        return { items: [], hasMore: false };
      }

      const apiSort =
        sort.toLowerCase() === "mostlikes" ? "mostlikes" : sort.toLowerCase();

      const params = new URLSearchParams({
        page: String(targetPage),
        limit: "20",
        sort: apiSort,
        live: sort === "popular" ? "1" : "0",
      });

      if (searchQuery.trim()) {
        params.append("search", searchQuery.trim());
      }
      if (ratingsKey) params.append("ratings", ratingsKey);
      if (categoriesKey) params.append("categories", categoriesKey);
      if (typesKey) params.append("types", typesKey);
      if (languagesKey) params.append("languages", languagesKey);

      const response = await fetch(`/api/music?${params.toString()}`);
      const data = await response.json();

      const incoming = Array.isArray(data?.music) ? data.music : [];
      const sortedIncoming = [...incoming]
        .filter((item) => {
          const valid =
            item && typeof item.livePopScore === "number" && !Number.isNaN(item.livePopScore);
          return valid;
        })
        .sort((a, b) => {
        const scoreA = typeof a.livePopScore === "number" ? a.livePopScore : 0;
        const scoreB = typeof b.livePopScore === "number" ? b.livePopScore : 0;
        if (scoreB !== scoreA) return scoreB - scoreA;
        const timeA = new Date(a.createdAt || a.uploadDate || 0).getTime();
        const timeB = new Date(b.createdAt || b.uploadDate || 0).getTime();
        if (timeB !== timeA) return timeB - timeA;
        const idA = (a._id || a.id || "").toString();
        const idB = (b._id || b.id || "").toString();
        return idB.localeCompare(idA);
        });
      return {
        items: sortedIncoming,
        hasMore: sortedIncoming.length === 20,
      };
    },
    [
      sort,
      searchQuery,
      ratingsKey,
      categoriesKey,
      typesKey,
      languagesKey,
      isInitialized,
    ],
  );

  const {
    items: music,
    hasMore,
    loading,
    loadingMore,
    loadMore,
    refresh,
  } = usePaginatedResource({
    fetchPage: fetchMusicPage,
    deps: paginationDeps,
    enabled: isInitialized,
    orderComparator: (a, b) => {
      const scoreA = typeof a.livePopScore === "number" ? a.livePopScore : 0;
      const scoreB = typeof b.livePopScore === "number" ? b.livePopScore : 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      const timeA = new Date(a.createdAt || a.uploadDate || 0).getTime();
      const timeB = new Date(b.createdAt || b.uploadDate || 0).getTime();
      if (timeB !== timeA) return timeB - timeA;
      const idA = (a._id || a.id || "").toString();
      const idB = (b._id || b.id || "").toString();
      return idB.localeCompare(idA);
    },
    mergeStrategy: ({ incoming, existing, append }) => {
      const normalizedIncoming = Array.isArray(incoming) ? incoming : [];
      if (!append) {
        return normalizedIncoming;
      }
      const seen = new Map();
      const merged = normalizedIncoming
        .concat(existing)
        .filter((item) => {
          const id = item?._id || item?.id;
          if (!id) return true;
          if (seen.has(id)) return false;
          seen.set(id, true);
          return true;
        });
      return merged;
    },
  });

  const loadMoreRef = useRef(null);

  // ✅ 預熱音樂列表中的前 5 首音頻（減少首次播放延遲）
  useEffect(() => {
    if (music.length > 0 && !loading) {
      const urlsToWarmup = music
        .slice(0, 5)
        .map(item => item.musicUrl)
        .filter(Boolean);
      if (urlsToWarmup.length > 0) {
        warmupAudioBatch(urlsToWarmup).catch(() => {
          // 靜默處理預熱失敗，不影響正常播放
        });
      }
    }
  }, [music, loading]);

  // 當篩選條件變化時，清理所有正在播放的預覽
  useEffect(() => {
    // 停止所有正在播放的預覽音頻
    if (typeof document !== "undefined") {
      const allPreviews = document.querySelectorAll("audio[data-music-preview=\"true\"]");
      allPreviews.forEach((audioElement) => {
        if (audioElement && !audioElement.paused) {
          try {
            audioElement.pause();
            audioElement.currentTime = 0;
            audioElement.removeAttribute("data-music-preview");
            if (audioManager && typeof audioManager.release === "function") {
              audioManager.release(audioElement);
            }
            // 觸發事件通知組件停止預覽
            audioElement.dispatchEvent(new CustomEvent("preview-stopped", { bubbles: true }));
          } catch (err) {
            console.warn("清理預覽失敗:", err);
          }
        }
      });
      // 強制清理 audioManager 狀態
      audioManager.release();
      // 觸發全局事件，通知所有 MusicPreview 組件檢查狀態
      window.dispatchEvent(new CustomEvent("music-preview-switched"));
    }
  }, [ratingsKey, categoriesKey, typesKey, languagesKey, sort, searchQuery]);

  useEffect(() => {
    if (!isInitialized || !hasMore || loading || loadingMore) return;
    const el = loadMoreRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { root: null, rootMargin: "500px 0px", threshold: 0.01 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [isInitialized, hasMore, loadMore, loading, loadingMore]);

  const isInitialLoading = (!isInitialized && music.length === 0) || (loading && music.length === 0);

  // 播放器邏輯（參考首頁）
  usePinnedPlayerBootstrap({ player, currentUser, shareMode: "global" });

  // ✅ 修復：監聽路由變化，只在真正切換到不同頁面時關閉彈窗
  useEffect(() => {
    const prevPath = prevPathnameRef.current;
    const currentPath = pathname;
    const isPathChanged = prevPath !== currentPath;
    
    // 只在 pathname 真正變化時（切換到不同頁面）才清理
    // 首次掛載時，prevPathnameRef.current === pathname，不會觸發清理
    if (isPathChanged) {
      prevPathnameRef.current = currentPath;
      
      // ✅ 無論切換到哪個頁面，都先確保恢復 body 狀態（防止頁面卡死）
      // 這是關鍵修復：即使彈窗狀態還沒更新，也要先恢復 body
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.height = "";
      
      // ✅ 強制清理：移除所有可能的彈窗遮罩層
      const allModals = document.querySelectorAll('[class*="fixed"][class*="inset-0"][class*="z-[1200]"]');
      allModals.forEach((modal) => {
        if (modal.style.display !== 'none') {
          modal.style.display = 'none';
        }
      });
      
      // ✅ 強制清理：確保彈窗狀態被重置
      setShowMusicModal(false);
      setSelectedMusic(null);
      
      // ✅ 使用多個時機確保 body 狀態被恢復（防止頁面卡死）
      requestAnimationFrame(() => {
        document.body.style.overflow = "";
        document.body.style.position = "";
        document.body.style.width = "";
        document.body.style.height = "";
      });
      
      setTimeout(() => {
        document.body.style.overflow = "";
        document.body.style.position = "";
        document.body.style.width = "";
        document.body.style.height = "";
      }, 0);
      
      setTimeout(() => {
        document.body.style.overflow = "";
        document.body.style.position = "";
        document.body.style.width = "";
        document.body.style.height = "";
      }, 100);
      
      // ✅ 額外保險：延遲再次檢查並恢復
      setTimeout(() => {
        const finalOverflow = window.getComputedStyle(document.body).overflow;
        if (finalOverflow === 'hidden') {
          document.body.style.overflow = "";
          document.body.style.position = "";
          document.body.style.width = "";
          document.body.style.height = "";
        }
      }, 200);
    }
  }, [pathname]); // ✅ 移除 showMusicModal 依賴，避免在彈窗打開時觸發
  
  // ✅ 修復：每次 pathname 變化時，都檢查並恢復 body 狀態（防止殘留）
  useEffect(() => {
    // 如果彈窗沒有打開，但 body 被鎖定，強制恢復
    if (!showMusicModal) {
      const currentOverflow = document.body.style.overflow;
      const currentPosition = document.body.style.position;
      
      if (currentOverflow === "hidden" || currentPosition === "fixed") {
        document.body.style.overflow = "";
        document.body.style.position = "";
        document.body.style.width = "";
        document.body.style.height = "";
      }
    }
  }, [pathname, showMusicModal]);

  // 監聽查詢參數中的 id，如果存在則打開音樂彈窗
  useEffect(() => {
    const musicId = searchParams.get("id");
    if (musicId && !showMusicModal) {
      // 嘗試從當前音樂列表中查找
      const foundMusic = music.find((m) => String(m._id) === String(musicId));
      if (foundMusic) {
        setSelectedMusic(foundMusic);
        setShowMusicModal(true);
        // 清除查詢參數，避免刷新後再次打開
        router.replace("/music", { scroll: false });
      } else {
        // 如果列表中沒有，從 API 獲取
        fetch(`/api/music/${musicId}`)
          .then((res) => res.json())
          .then((data) => {
            if (data && data._id) {
              setSelectedMusic(data);
              setShowMusicModal(true);
              // 清除查詢參數
              router.replace("/music", { scroll: false });
            }
          })
          .catch((err) => {
            console.error("獲取音樂失敗:", err);
          });
      }
    }
  }, [searchParams, music, showMusicModal, router]);

  return (
    <div className="min-h-screen bg-zinc-950 -mt-2 md:-mt-16">
      {/* 頁面標題 */}
      <div className="bg-zinc-900 shadow-sm border-b border-zinc-700">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row items-center gap-6 md:gap-40 justify-center w-full">
            {/* 左邊區塊：標題和描述 */}
            <div className="flex flex-col items-center md:items-start text-center md:text-left shrink-0">
              <h1 className="text-3xl font-bold text-white">🎵 音樂專區</h1>
              <p className="mt-1 text-gray-400">探索精彩的 AI 生成音樂</p>
            </div>

            {/* 中間區塊：提示文字 */}
            <div className="text-yellow-400 text-sm text-center shrink-0">
              <div className="md:hidden">
                💡 點擊「播放」或「預覽」按鈕即可開始試聽。
              </div>
              <div className="hidden md:block">
                💡 點擊「播放」或「預覽」按鈕即可開始試聽。<br />
                滑鼠移開卡片時預覽會立即結束。
              </div>
            </div>

            {/* 右邊區塊：版本資訊和法律連結（手機版隱藏） */}
            <div className="hidden md:flex flex-col items-center gap-2 text-xs text-gray-400 shrink-0 text-center">
              <div className="flex items-center gap-2 justify-center">
                <a
                  href="/about"
                  className="hover:text-white transition text-sm font-medium text-blue-400"
                >
                  我們的故事
                </a>
                <span className="text-gray-600">•</span>
                <span className="text-sm text-yellow-400">
                  版本 v0.8.0（2025-11-05）🎉
                </span>
              </div>
              <div className="flex items-center gap-2 justify-center">
                <a
                  href="/changelog"
                  className="text-sm underline hover:text-white"
                >
                  查看更新內容
                </a>
                <span className="text-gray-600">•</span>
                <a href="/privacy" className="hover:text-white transition">
                  隱私政策
                </a>
                <span className="text-gray-600">•</span>
                <a href="/terms" className="hover:text-white transition">
                  服務條款
                </a>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* 音樂類型與語言篩選 */}
      <div className="bg-zinc-900 border-b border-zinc-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <span className="text-sm font-medium text-gray-300">
              音樂類型：
            </span>
            <div className="flex gap-2 flex-wrap">
              {Object.keys(MUSIC_TYPE_MAP).map((type) => (
                <button
                  key={type}
                  onClick={() => toggleTypeFilter(type)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                    typeFilters.includes(type)
                      ? "bg-purple-600 text-white border-purple-600"
                      : "bg-zinc-800 text-gray-300 border-zinc-600 hover:bg-zinc-700"
                  }`}
                >
                  {MUSIC_TYPE_MAP[type]}
                </button>
              ))}
            </div>
            <div className="h-8 w-px bg-zinc-700 mx-2"></div>
            <span className="text-sm font-medium text-gray-300">語言：</span>
            <div className="flex gap-2 flex-wrap">
              {MUSIC_LANGUAGES.map((lang) => (
                <button
                  key={lang}
                  onClick={() => toggleLanguageFilter(lang)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                    languageFilters.includes(lang)
                      ? "bg-orange-600 text-white border-orange-600"
                      : "bg-zinc-800 text-gray-300 border-zinc-600 hover:bg-zinc-700"
                  }`}
                >
                  {LANGUAGE_MAP[lang]}
                </button>
              ))}
            </div>
            <div className="h-8 w-px bg-zinc-700 mx-2"></div>
            {/* 排序選擇器 */}
            <div className="flex items-center gap-3">
              <SortSelect value={sort} onChange={setSort} />
              <a
                href="/music/create"
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-orange-500/40 hover:from-amber-500 hover:via-orange-500 hover:to-red-500 transition"
              >
                <span role="img" aria-label="前往創作音樂">🎧</span>
                前往創作音樂
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* 音樂列表 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isInitialLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
            <p className="mt-4 text-gray-400">載入中...</p>
          </div>
        ) : music.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎵</div>
            <h3 className="text-xl font-semibold text-white mb-2">
              還沒有音樂
            </h3>
            <p className="text-gray-400 mb-6">成為第一個上傳音樂的人吧！</p>
            <button
              onClick={() =>
                window.dispatchEvent(new Event("openMusicUploadModal"))
              }
              className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              🎵 上傳第一首音樂
            </button>
          </div>
        ) : (
          <>
            <MusicGrid
              music={music}
              onSelectMusic={(track) => {
                // ✅ 只打開 Modal，不設置播放器
                // MusicModal 有自己的播放功能，不應該影響到網站播放器
                // ✅ 如果點擊的是同一首歌，不重新打開（避免閃爍）
                if (showMusicModal && selectedMusic?._id === track?._id) {
                  return;
                }
                
                // ✅ 直接打開新彈窗（React 會自動處理狀態更新）
                setSelectedMusic(track);
                setShowMusicModal(true);
              }}
            />
            {hasMore ? (
              <div ref={loadMoreRef} className="mt-10 flex justify-center">
                {loadingMore ? (
                  <div className="flex flex-col items-center gap-2 text-sm text-gray-400">
                    <span className="h-6 w-6 animate-spin rounded-full border-b-2 border-purple-500"></span>
                    <span>載入更多中...</span>
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">向下捲動以載入更多音樂...</p>
                )}
              </div>
            ) : (
              <div className="mt-10 text-center text-gray-500">已載入全部音樂</div>
            )}
          </>
        )}
      </div>

      {/* 音樂播放 Modal */}
      {/* ✅ 修復：確保彈窗只在狀態正確時才渲染，避免隱形彈窗 */}
      {showMusicModal && selectedMusic && selectedMusic._id && (
        <MusicModal
          music={selectedMusic}
          currentUser={currentUser}
          displayMode="gallery"
          onClose={handleMusicModalClose}
          onUserClick={() => {
            const authorId =
              selectedMusic?.author?._id || selectedMusic?.author;
            if (authorId) {
              router.push(`/user/${authorId}`);
            }
          }}
          onDelete={async (musicId) => {
            // 刪除邏輯
            try {
              const response = await fetch(`/api/music/${musicId}/delete`, {
                method: "DELETE",
              });
              if (response.ok) {
                setShowMusicModal(false);
                setSelectedMusic(null);
                // 重新整理列表，移除已刪除的音樂
                refresh();
              }
            } catch (error) {
              console.error("刪除音樂失敗:", error);
            }
          }}
          canEdit={
            currentUser &&
            selectedMusic?.author?._id &&
            String(currentUser._id) === String(selectedMusic.author._id)
          }
          onEdit={() => {
            // 打開編輯表單
            setEditingMusic(selectedMusic);
            setShowEditModal(true);
          }}
          isLiked={
            Array.isArray(selectedMusic?.likes) && currentUser?._id
              ? selectedMusic.likes.includes(currentUser._id)
              : false
          }
          onToggleLike={async (musicId) => {
            // 愛心邏輯
            try {
              const response = await fetch(`/api/music/${musicId}/like`, {
                method: "POST",
              });
              if (response.ok) {
                const data = await response.json();
                // The usePaginatedResource hook manages the state,
                // so we don't need to update it here directly.
                setSelectedMusic({
                  ...selectedMusic,
                  likes: data.likes,
                  likesCount: data.likesCount,
                });
              }
            } catch (error) {
              console.error("切換愛心失敗:", error);
            }
          }}
        />
      )}

      {/* 編輯音樂 Modal */}
      {showEditModal && editingMusic && (
        <EditMusicModal
          music={editingMusic}
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingMusic(null);
          }}
          onMusicUpdated={(updatedMusic) => {
            // 更新音樂列表
            // The usePaginatedResource hook manages the state,
            // so we don't need to update it here directly.
            // 如果當前選中的音樂就是編輯的音樂，也更新它
            if (selectedMusic && selectedMusic._id === updatedMusic._id) {
              setSelectedMusic(updatedMusic);
            }
            // 關閉編輯表單
            setShowEditModal(false);
            setEditingMusic(null);
          }}
        />
      )}

      <BackToTopButton />
    </div>
  );
};

export default MusicPage;
