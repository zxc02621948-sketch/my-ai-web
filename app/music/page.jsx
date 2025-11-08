"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
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
import {
  MUSIC_TYPE_MAP,
  MUSIC_LANGUAGES,
  LANGUAGE_MAP,
} from "@/constants/musicCategories";

const MusicPage = () => {
  const [music, setMusic] = useState([]);
  const [loading, setLoading] = useState(true);
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

  const loadMusic = useCallback(async () => {
    try {
      // 獲取搜尋參數
      const searchQuery = searchParams.get("search") || "";

      // 構建 API URL
      // 將前端的排序值轉換為 API 接受的格式
      const apiSort = sort.toLowerCase() === "mostlikes" ? "mostlikes" : sort.toLowerCase();
      
      const params = new URLSearchParams({
        page: "1",
        limit: "20",
        sort: apiSort,
        live: sort === "popular" ? "1" : "0", // 只有熱門度排序使用即時計算
      });

      if (searchQuery.trim()) {
        params.append("search", searchQuery.trim());
      }

      // ✅ 添加篩選參數
      if (selectedRatings.length > 0) {
        params.append("ratings", selectedRatings.join(","));
      }
      if (categoryFilters.length > 0) {
        params.append("categories", categoryFilters.join(","));
      }
      if (typeFilters.length > 0) {
        params.append("types", typeFilters.join(","));
      }
      if (languageFilters.length > 0) {
        params.append("languages", languageFilters.join(","));
      }

      const response = await fetch(`/api/music?${params}`);
      const data = await response.json();

      if (data.success) {
        setMusic(data.music || []);
      }
      setLoading(false);
    } catch (error) {
      console.error("載入音樂失敗:", error);
      setLoading(false);
    }
  }, [
    searchParams,
    selectedRatings,
    categoryFilters,
    typeFilters,
    languageFilters,
    sort,
  ]);

  // 監聽篩選條件變化
  useEffect(() => {
    if (!isInitialized) return;
    loadMusic();
  }, [isInitialized, loadMusic]);

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

        // ✅ 無論播放清單是否為空，都設置 playerOwner（用於顯示釘選按鈕）
        player?.setPlayerOwner?.({
          userId: pinnedPlayer.userId,
          username: pinnedPlayer.username,
          allowShuffle: !!pinnedPlayer.allowShuffle,
        });

        // ✅ 設置播放清單（即使是空的）
        player?.setPlaylist?.(playlist);

        if (playlist.length > 0) {
          const currentIndex = pinnedPlayer.currentIndex || 0;
          const currentTrack = playlist[currentIndex];

          player?.setActiveIndex?.(currentIndex);

          if (currentTrack) {
            player?.setSrc?.(currentTrack.url);
            player?.setOriginUrl?.(currentTrack.url);
            player?.setTrackTitle?.(currentTrack.title || currentTrack.url);
          }
        } else {
          // ✅ 播放清單為空時，清空當前曲目
          player?.setSrc?.('');
          player?.setOriginUrl?.('');
          player?.setTrackTitle?.('');
          player?.setActiveIndex?.(0);
        }

        player?.setMiniPlayerEnabled?.(true);

        player?.setShareMode?.("global");
      } else {
        // 用戶取消釘選，清空播放器
        player?.setMiniPlayerEnabled?.(false);
        player?.pause?.();
        player?.setExternalControls?.(null);
        player?.setExternalPlaying?.(false);
        player?.setSrc?.("");
        player?.setOriginUrl?.("");
        player?.setTrackTitle?.("");
        player?.setPlaylist?.([]);
        player?.setShareMode?.("global");
      }
    };

    // 註冊事件監聽器
    window.addEventListener("pinnedPlayerChanged", handlePinnedChange);

    // 檢查釘選播放器（參考首頁邏輯）
    const pinnedPlayer =
      currentUser?.user?.pinnedPlayer || currentUser?.pinnedPlayer;
    const hasPinnedPlayer =
      pinnedPlayer?.userId &&
      pinnedPlayer?.expiresAt &&
      new Date(pinnedPlayer.expiresAt) > new Date();

    if (hasPinnedPlayer) {
      // 恢復釘選播放器
      const playlist = pinnedPlayer.playlist || [];
      
      // ✅ 無論播放清單是否為空，都設置 playerOwner（用於顯示釘選按鈕）
      player?.setPlayerOwner?.({
        userId: pinnedPlayer.userId,
        username: pinnedPlayer.username,
        allowShuffle: !!pinnedPlayer.allowShuffle,
      });

      // ✅ 設置播放清單（即使是空的）
      player?.setPlaylist?.(playlist);

      if (playlist.length > 0) {
        const currentIndex = pinnedPlayer.currentIndex || 0;
        const currentTrack = playlist[currentIndex];

        player?.setActiveIndex?.(currentIndex);

        if (currentTrack) {
          player?.setSrc?.(currentTrack.url);
          player?.setOriginUrl?.(currentTrack.url);
          player?.setTrackTitle?.(currentTrack.title || currentTrack.url);
        }
      } else {
        // ✅ 播放清單為空時，清空當前曲目
        player?.setSrc?.('');
        player?.setOriginUrl?.('');
        player?.setTrackTitle?.('');
        player?.setActiveIndex?.(0);
      }

      player?.setMiniPlayerEnabled?.(true);
    } else {
      // 沒有釘選數據，設定為全局模式但不顯示播放器
      player?.setShareMode?.("global");
      player?.setMiniPlayerEnabled?.(false);
    }

    return () => {
      window.removeEventListener("pinnedPlayerChanged", handlePinnedChange);
    };
  }, [currentUser]); // 移除 player 依賴，避免無限循環

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
              {/* 右側：提示文字（桌面端） */}
              <div className="hidden md:block text-yellow-400 text-sm">
                <div>💡 受瀏覽器播放限制影響，若無法預覽或停留播放，</div>
                <div>請點擊頁面任意區域後即可啟用音樂試聽。</div>
              </div>
              {/* 移動端：提示文字（顯示在標題下方） */}
              <div className="md:hidden text-yellow-400 text-sm">
                <div>💡 受瀏覽器播放限制影響，若無法預覽或停留播放，</div>
                <div>請點擊頁面任意區域後即可啟用音樂試聽。</div>
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
            <SortSelect value={sort} onChange={setSort} />
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
          <MusicGrid
            music={music}
            onSelectMusic={(track) => {
              // ✅ 只打開 Modal，不設置播放器
              // MusicModal 有自己的播放功能，不應該影響到網站播放器
              setSelectedMusic(track);
              setShowMusicModal(true);
            }}
          />
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
