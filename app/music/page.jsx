"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MusicGrid from "@/components/music/MusicGrid";
import MusicModal from "@/components/music/MusicModal";
import EditMusicModal from "@/components/music/EditMusicModal";
import SortSelect from "@/components/common/SortSelect";
import { usePlayer } from "@/components/context/PlayerContext";
import { useCurrentUser } from "@/contexts/CurrentUserContext";
import {
  useFilterContext,
  musicLabelToRating,
} from "@/components/context/FilterContext";
import usePinnedPlayerBootstrap from "@/hooks/usePinnedPlayerBootstrap";
import {
  MUSIC_TYPE_MAP,
  MUSIC_LANGUAGES,
  LANGUAGE_MAP,
} from "@/constants/musicCategories";

const MusicPage = () => {
  const [music, setMusic] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const isFetchingRef = useRef(false);
  const pageRef = useRef(1);
  const [selectedMusic, setSelectedMusic] = useState(null);
  const [showMusicModal, setShowMusicModal] = useState(false);
  const [editingMusic, setEditingMusic] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [sort, setSort] = useState("popular");
  const player = usePlayer();
  const { currentUser } = useCurrentUser();
  const router = useRouter();
  const searchParams = useSearchParams();
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

  const queryKey = useMemo(
    () =>
      [
        sort,
        searchQuery,
        ratingsKey,
        categoriesKey,
        typesKey,
        languagesKey,
      ].join("||"),
    [sort, searchQuery, ratingsKey, categoriesKey, typesKey, languagesKey],
  );

  const loadPage = async (targetPage = 1, append = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setLoading(true);
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

      if (data.success) {
        const incoming = data.music || [];
        setMusic((prev) => {
          if (!append) return incoming;
          const known = new Set(prev.map((item) => String(item?._id)));
          const filtered = incoming.filter(
            (item) => item && !known.has(String(item._id)),
          );
          return [...prev, ...filtered];
        });
        setHasMore(incoming.length === 20);
        setPage(targetPage);
        pageRef.current = targetPage;
      }
    } catch (error) {
      console.error("載入音樂失敗:", error);
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    if (!isInitialized) return;
    pageRef.current = 1;
    setMusic([]);
    setHasMore(true);
    loadPage(1, false);
  }, [isInitialized, queryKey]);

  // 播放器邏輯（參考首頁）
  usePinnedPlayerBootstrap({ player, currentUser, shareMode: "global" });

  return (
    <div className="min-h-screen bg-zinc-950 -mt-2 md:-mt-16">
      {/* 頁面標題 */}
      <div className="bg-zinc-900 shadow-sm border-b border-zinc-700">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-3 sm:gap-6">
            {/* 左側：標題和描述 */}
            <div className="flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-4">
              <div>
                <h1 className="text-3xl font-bold text-white">🎵 音樂專區</h1>
                <p className="mt-1 text-gray-400">探索精彩的 AI 生成音樂</p>
              </div>
              {/* 提示文字 */}
              <div className="text-yellow-400 text-sm">
                <div className="md:hidden">
                  💡 點擊「播放」或「預覽」按鈕即可開始試聽。
                </div>
                <div className="hidden md:block">
                  💡 點擊「播放」或「預覽」按鈕即可開始試聽，滑鼠移開卡片時預覽會立即結束。
                </div>
              </div>
            </div>

            {/* 中間：版本資訊和法律連結（手機版隱藏） */}
            <div className="hidden md:flex items-center gap-4 text-xs text-gray-400 flex-1 justify-center flex-wrap">
              <div className="flex items-center gap-2">
                <a
                  href="/about"
                  className="hover:text-white transition text-sm font-medium text-blue-400"
                >
                  我們的故事
                </a>
                <span className="text-gray-600">•</span>
                <span className="text-sm text-yellow-400">
                  版本 v0.8.0（2025-10-15）🎉
                </span>
                <a
                  href="/changelog"
                  className="text-sm underline hover:text-white"
                >
                  查看更新內容
                </a>
              </div>
              <div className="flex items-center gap-2">
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
        {loading ? (
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
                setSelectedMusic(track);
                setShowMusicModal(true);
              }}
            />
            <div className="mt-10 flex justify-center">
              {hasMore ? (
                <button
                  onClick={() => {
                    if (isFetchingRef.current) return;
                    const nextPage = pageRef.current + 1;
                    loadPage(nextPage, true);
                  }}
                  disabled={isLoadingMore}
                  className="inline-flex items-center gap-2 rounded-full bg-purple-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-purple-600/30 transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoadingMore ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-b-2 border-white"></span>
                      <span>載入更多中...</span>
                    </>
                  ) : (
                    "載入更多"
                  )}
                </button>
              ) : (
                <p className="text-gray-500">已載入全部音樂</p>
              )}
            </div>
          </>
        )}
      </div>

      {/* 音樂播放 Modal */}
      {showMusicModal && selectedMusic && (
        <MusicModal
          music={selectedMusic}
          currentUser={currentUser}
          displayMode="gallery"
          onClose={() => {
            setShowMusicModal(false);
            setSelectedMusic(null);
          }}
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
                setMusic(music.filter((m) => m._id !== musicId));
                setShowMusicModal(false);
                setSelectedMusic(null);
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
                setMusic(
                  music.map((m) =>
                    m._id === musicId
                      ? { ...m, likes: data.likes, likesCount: data.likesCount }
                      : m,
                  ),
                );
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
            setMusic((prevMusic) =>
              prevMusic.map((m) =>
                m._id === updatedMusic._id ? updatedMusic : m
              )
            );
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
    </div>
  );
};

export default MusicPage;
