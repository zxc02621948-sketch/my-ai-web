"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import ImageGrid from "@/components/image/ImageGrid";
import ImageModal from "@/components/image/ImageModal";
import BackToTopButton from "@/components/common/BackToTopButton";
import SortSelect from "@/components/common/SortSelect";
import { useFilterContext, labelToRating } from "@/components/context/FilterContext";
import useLikeHandler from "@/hooks/useLikeHandler";
import { usePlayer } from "@/components/context/PlayerContext";
import { useCurrentUser } from "@/contexts/CurrentUserContext";
import { notify } from "@/components/common/GlobalNotificationManager";
import usePinnedPlayerBootstrap from "@/hooks/usePinnedPlayerBootstrap";
import usePaginatedResource from "@/hooks/usePaginatedResource";
import useVisitTracking from "@/hooks/useVisitTracking";

/** ====== 超精簡資料流：去掉預覽/快取/一次性旗標，只保留 inFlightId ====== */

const PAGE_SIZE = 20;

function normalizeImageData(img) {
  if (!img) return img;
  const raw = img.user ?? img.userId ?? null;
  const uid =
    typeof raw === "object"
      ? raw?._id || raw?.id || raw?.userId || null
      : raw || null;
  const userObj =
    typeof raw === "object"
      ? { ...raw, _id: uid }
      : uid
        ? { _id: uid }
        : { _id: null };
  const isFollowingVal =
    (typeof raw === "object" ? raw?.isFollowing : img?.isFollowing) ?? false;
  return { ...img, user: { ...userObj, isFollowing: Boolean(isFollowingVal) } };
}

function mergeImageData(oldImg, updated) {
  if (!oldImg || !updated?._id) return oldImg;
  if (String(oldImg._id) !== String(updated._id)) return oldImg;
  return normalizeImageData({ ...oldImg, ...updated });
}

export default function ClientImagesPage() {
  const player = usePlayer();
  const searchParams = useSearchParams();
  const { currentUser, setCurrentUser } = useCurrentUser(); // 使用 Context

  // 從 FilterContext 獲取狀態
  const {
    levelFilters,
    categoryFilters,
    viewMode,
    resetFilters,
  } = useFilterContext();

  // 本地狀態
  const [sort, setSort] = useState("popular");

  // ✅ 記住用戶偏好（避免 hydration 錯誤）
  const [displayMode, setDisplayMode] = useState("gallery");
  const [modeInitialized, setModeInitialized] = useState(false);

  // ✅ 首次訪問引導（避免 hydration 錯誤）
  const [showGuide, setShowGuide] = useState(false);

  // ✅ 客戶端初始化
  const [isClient, setIsClient] = useState(false);

  // ✅ 手機檢測（避免 hydration 錯誤）
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // 從 localStorage 讀取偏好（初始化後才套用，避免 hydration mismatch）
    const savedMode = localStorage.getItem("galleryMode");
    if (savedMode === "gallery" || savedMode === "collection") {
      setDisplayMode(savedMode);
    }
    setModeInitialized(true);
    // 檢查是否顯示引導
    const guideShown = localStorage.getItem("galleryGuideShown");
    if (!guideShown) {
      setShowGuide(true);
    }
    // 檢測手機裝置
    setIsMobile(window.innerWidth < 768);
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 保存模式偏好
  useEffect(() => {
    if (typeof window !== "undefined" && modeInitialized) {
      localStorage.setItem("galleryMode", displayMode);
    }
  }, [displayMode, modeInitialized]);

  // 計算衍生狀態（使用 useMemo 避免無限循環）
  const selectedCategories = useMemo(() => categoryFilters, [categoryFilters]);
  const selectedRatings = useMemo(
    () =>
      levelFilters.map((label) => labelToRating[label]).filter(Boolean),
    [levelFilters],
  );

  const [selectedImage, setSelectedImage] = useState(null);

  const loadMoreRef = useRef(null);
  usePinnedPlayerBootstrap({ player, currentUser });

  // ✅ 訪問記錄追蹤（使用統一的 Hook）
  useVisitTracking();

  // 排序參數對應後端
  const mapSortForApi = (s) => {
    const v = (s || "").toLowerCase();
    return v === "likes" || v === "mostlikes" ? "mostlikes" : v;
  };

  const resetToBaselineRanking = useCallback(() => {
    resetFilters();
    setSort("popular");
    setDisplayMode("gallery");
    if (typeof window !== "undefined") {
      localStorage.setItem("galleryMode", "gallery");
      localStorage.setItem("levelFilters", JSON.stringify(["一般圖片", "15+ 圖片"]));
      localStorage.setItem("categoryFilters", JSON.stringify([]));
      // 一併清掉 URL 上殘留的搜尋參數，避免「看起來沒篩選但其實有 search」
      window.history.replaceState({}, "", window.location.pathname);
    }
    notify.success("已重置條件", "已回到：熱門 + 作品展示 + 預設分級");
  }, [resetFilters]);

  const filtersReady = selectedRatings.length > 0;
  const searchQuery = useMemo(
    () => (searchParams.get("search") || "").trim(),
    [searchParams],
  );

  const paginationDeps = useMemo(
    () => [
      displayMode,
      sort,
      searchQuery,
      selectedCategories.join(","),
      selectedRatings.join(","),
    ],
    [displayMode, sort, searchQuery, selectedCategories, selectedRatings],
  );

  const fetchImagesPage = useCallback(
    async (targetPage = 1) => {
      const params = new URLSearchParams({
        page: String(targetPage),
        limit: String(PAGE_SIZE),
        sort: mapSortForApi(sort),
      });

      // 熱門排序改用即時分數（包含 initialBoost 衰減），避免 DB 快取分數造成新圖長時間卡前排。
      if (mapSortForApi(sort) === "popular") {
        params.set("live", "1");
      }

      if (selectedCategories.length) {
        params.set("categories", selectedCategories.join(","));
      }
      if (selectedRatings.length) {
        params.set("ratings", selectedRatings.join(","));
      }
      if (searchQuery) {
        params.set("search", searchQuery);
      }
      if (displayMode === "collection") {
        params.set("hasMetadata", "true");
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort("Request timeout after 15 seconds");
      }, 15000);

      try {
        const response = await fetch(`/api/images?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const listRaw = Array.isArray(data?.images) ? data.images : [];
        const items = listRaw.map(normalizeImageData);
        return {
          items,
          hasMore: items.length >= PAGE_SIZE,
        };
      } catch (error) {
        clearTimeout(timeoutId);
        // 如果是 AbortError，靜默處理（可能是依賴變更導致的正常中止）
        if (error?.name === "AbortError" || error?.message?.includes("aborted")) {
          throw error; // 重新拋出，讓 usePaginatedResource 處理
        }
        console.error("載入圖片失敗:", error);
        throw error;
      }
    },
    [
      displayMode,
      searchQuery,
      selectedCategories,
      selectedRatings,
      sort,
    ],
  );

  const {
    items: images,
    hasMore,
    loading,
    loadingMore,
    loadMore,
    setItems: setImageItems,
  } = usePaginatedResource({
    fetchPage: fetchImagesPage,
    deps: paginationDeps,
    enabled: filtersReady && modeInitialized,
  });

  // —— 追蹤狀態同步（父層處理器，提供給 ImageModal） ——
  const handleFollowChange = useCallback(
    (targetUserId, isFollowing) => {
      setSelectedImage((prev) => {
        if (!prev) return prev;
        const uid =
          typeof prev.user === "object"
            ? prev.user?._id || prev.user?.id || prev.user?.userId
            : prev.user;
        if (uid && String(uid) === String(targetUserId)) {
          const userObj =
            typeof prev.user === "object"
              ? {
                  ...prev.user,
                  _id:
                    prev.user?._id || prev.user?.id || prev.user?.userId,
                }
              : { _id: uid };
          return { ...prev, user: { ...userObj, isFollowing } };
        }
        return prev;
      });

      setImageItems((prev) =>
        Array.isArray(prev)
          ? prev.map((img) => {
              const uid =
                typeof img.user === "object"
                  ? img.user?._id || img.user?.id || img.user?.userId
                  : img.user;
              if (uid && String(uid) === String(targetUserId)) {
                const userObj =
                  typeof img.user === "object" ? img.user : { _id: uid };
                return { ...img, user: { ...userObj, isFollowing } };
              }
              return img;
            })
          : prev,
      );

      setCurrentUser((prev) => {
        if (!prev) return prev;
        const uid = String(targetUserId);
        const list = Array.isArray(prev.following) ? [...prev.following] : [];
        const getId = (x) =>
          typeof x === "object" && x !== null ? String(x.userId) : String(x);
        const exists = list.some((x) => getId(x) === uid);
        let nextList = list;
        if (isFollowing && !exists) nextList = [...list, uid];
        if (!isFollowing && exists) {
          nextList = list.filter((x) => getId(x) !== uid);
        }
        return { ...prev, following: nextList };
      });
    },
    [setCurrentUser, setImageItems],
  );

  const applyUpdatedImage = useCallback(
    (updated) => {
      if (!updated?._id) return;
      setImageItems((prev) =>
        Array.isArray(prev)
          ? prev.map((item) => mergeImageData(item, updated))
          : prev,
      );
      setSelectedImage((prev) => mergeImageData(prev, updated));
    },
    [setImageItems],
  );

  // —— 通知 → 直接打開指定圖片 ——
  useEffect(() => {
    const onOpenFromNotification = async (e) => {
      const id = String(e?.detail?.imageId || "").trim();
      if (!id) return;
      try {
        const r = await fetch(`/api/images/${id}`, { cache: "no-store" });
        const j = await r.json().catch(() => ({}));
        const img = j?.image || null;
        if (img?._id) {
          setImageItems((prev) => {
            const normalized = normalizeImageData(img);
            if (!Array.isArray(prev)) return [normalized];
            const exists = prev.some(
              (x) => String(x._id) === String(img._id),
            );
            return exists ? prev : [normalized, ...prev];
          });
          setSelectedImage(normalizeImageData(img));
        } else {
          notify.warning("提示", "找不到該圖片，可能已被刪除");
        }
      } catch (err) {
        console.warn("⚠️ 找不到該圖片，可能已被刪除", err);
        notify.warning("提示", "找不到該圖片，可能已被刪除");
      }
    };
    window.addEventListener("openImageModal", onOpenFromNotification);
    return () =>
      window.removeEventListener("openImageModal", onOpenFromNotification);
  }, [setImageItems]);

  // —— 單張圖片更新（從子元件或外部事件） ——
  useEffect(() => {
    const onUpdated = (e) => {
      const updated = e?.detail?.updated;
      if (updated?._id) applyUpdatedImage(updated);
    };
    window.addEventListener("image-updated", onUpdated);
    return () => window.removeEventListener("image-updated", onUpdated);
  }, [applyUpdatedImage]);

  // —— 無限捲動（共用 hook，優化：提前加載） ——
  useEffect(() => {
    if (!filtersReady || !hasMore || loading || loadingMore) return;
    const el = loadMoreRef.current;
    if (!el) return;

    // ✅ 動態計算 rootMargin：根據視窗高度提前加載
    // 提前 2.5 個視窗高度的距離，確保用戶滾動時不會等待
    const calculatePreloadDistance = () => {
      const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
      // 提前 2.5 個視窗高度，至少 1200px，確保快速滾動時也能提前加載
      return Math.max(viewportHeight * 2.5, 1200);
    };
    
    let currentObserver = null;
    let preloadDistance = calculatePreloadDistance();
    
    const createObserver = () => {
      if (currentObserver) {
        currentObserver.disconnect();
      }
      preloadDistance = calculatePreloadDistance();
      currentObserver = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            loadMore();
          }
        },
        { 
          root: null, 
          rootMargin: `${preloadDistance}px 0px`, // ✅ 動態提前距離
          threshold: 0.01 
        },
      );
      currentObserver.observe(el);
      return currentObserver;
    };
    
    createObserver();
    
    // ✅ 監聽窗口大小變化，重新計算提前距離
    const handleResize = () => {
      const newDistance = calculatePreloadDistance();
      if (Math.abs(newDistance - preloadDistance) > 200) {
        // 如果距離變化超過 200px，重新創建 observer
        createObserver();
      }
    };
    
    window.addEventListener('resize', handleResize, { passive: true });
    
    return () => {
      if (currentObserver) {
        currentObserver.disconnect();
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [filtersReady, hasMore, loadMore, loading, loadingMore]);

  // Like hook
  const { handleToggleLike, onLikeUpdate: onLikeUpdateHook } = useLikeHandler({
    setUploadedImages: setImageItems,
    setLikedImages: null,
    selectedImage,
    setSelectedImage,
    currentUser,
  });
  const isLikedByCurrentUser = (img) => {
    if (!currentUser || !img?.likes) return false;
    const uid = currentUser._id || currentUser.id;
    return img.likes.some((id) => String(id) === String(uid));
  };

  // ImageModal 導航
  const openImage = (img) => setSelectedImage(normalizeImageData(img));
  const idx = selectedImage
    ? images.findIndex(
        (x) => String(x._id) === String(selectedImage._id),
      )
    : -1;
  const prevImage = idx > 0 ? images[idx - 1] : undefined;
  const nextImage =
    idx >= 0 && idx < images.length - 1 ? images[idx + 1] : undefined;
  const navigateFromSelected = (dir) => {
    if (idx < 0) return;
    const nextIdx = dir === "next" ? idx + 1 : idx - 1;
    if (nextIdx < 0 || nextIdx >= images.length) return;
    setSelectedImage(images[nextIdx]);
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-white px-4 pb-4 pt-0 -mt-2 md:-mt-16">
      {/* ✅ 畫廊/作品集標籤切換 */}
      <div className="max-w-6xl mx-auto mb-4 px-4">
        {/* 中間資訊區：放在最上方，寬度不足時自動換行 */}
        <div className="flex items-center justify-center gap-4 sm:gap-6 text-xs text-gray-400 px-2 sm:px-8 py-2 mb-3">
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap justify-center text-center">
            <a
              href="/about"
              className="hover:text-white transition text-sm font-medium text-blue-400 whitespace-nowrap"
            >
              我們的故事
            </a>
            <span className="text-gray-600 hidden sm:inline">•</span>
            <span className="text-sm text-yellow-400 whitespace-nowrap">
              版本 v0.8.0（2025-11-05）🎉
            </span>
            <a href="/changelog" className="text-sm underline hover:text-white whitespace-nowrap">
              查看更新內容
            </a>
            <span className="text-gray-600 hidden sm:inline">•</span>
            <a href="/privacy" className="hover:text-white transition whitespace-nowrap">
              隱私政策
            </a>
            <span className="text-gray-600 hidden sm:inline">•</span>
            <a href="/terms" className="hover:text-white transition whitespace-nowrap">
              服務條款
            </a>
          </div>
        </div>

        {/* 第一行：左側按鈕 + 右側按鈕 */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:gap-3 justify-between w-full mb-3 sm:mb-0">
          {/* 左側：模式切換標籤 */}
          <div className="flex gap-3 shrink-0 w-full sm:w-auto justify-center sm:justify-start">
            <button
              onClick={() => setDisplayMode("gallery")}
              className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-all duration-200 text-sm sm:text-base whitespace-nowrap ${
                displayMode === "gallery"
                  ? "bg-white text-black shadow-md"
                  : "bg-zinc-800 text-gray-300 hover:bg-zinc-700"
              }`}
            >
              🎨 作品展示
              <span className="text-xs ml-1.5 opacity-60 hidden sm:inline">全部作品</span>
            </button>
            <button
              onClick={() => setDisplayMode("collection")}
              className={`relative px-3 sm:px-4 py-2 rounded-lg font-medium transition-all duration-200 text-sm sm:text-base whitespace-nowrap ${
                displayMode === "collection"
                  ? "bg-white text-black shadow-md"
                  : "bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-lg"
              }`}
            >
              <span className="flex items-center gap-1.5">
                🔧 創作參考
                <span className="text-xs opacity-75 hidden md:inline">可學習參數</span>
              </span>
              {/* 閃爍提示徽章 */}
              {displayMode !== "collection" && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
                </span>
              )}
            </button>
          </div>

          {/* 右側：排序 + 前往創作 */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 w-full sm:w-auto justify-center sm:justify-end flex-wrap sm:flex-nowrap">
            <div className="flex-shrink-0">
              <SortSelect value={sort} onChange={setSort} />
            </div>
            <button
              onClick={resetToBaselineRanking}
              className="inline-flex items-center rounded-lg bg-zinc-800 hover:bg-zinc-700 px-3 py-2 text-xs sm:text-sm text-gray-100 transition whitespace-nowrap"
              title="重置排序與篩選條件"
            >
              重置條件
            </button>
            <a
              href="/images/create"
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500/90 to-teal-500/90 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 hover:from-emerald-500 hover:to-teal-500 transition whitespace-nowrap flex-shrink-0"
            >
              <span role="img" aria-label="前往創作圖片">
                🧪
              </span>
              <span className="hidden sm:inline">前往創作圖片</span>
              <span className="sm:hidden">創作</span>
            </a>
          </div>
        </div>


        {/* ✅ 首次訪問引導橫幅（手機版隱藏） */}
        {showGuide && displayMode === "gallery" && !isMobile && (
          <div className="mt-3 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/50 rounded-lg p-4 relative">
            <button
              onClick={() => {
                setShowGuide(false);
                if (typeof window !== "undefined") {
                  localStorage.setItem("galleryGuideShown", "true");
                }
              }}
              className="absolute top-2 right-2 text-gray-400 hover:text-white transition"
              title="關閉提示"
            >
              ✕
            </button>
            <div className="flex items-start gap-3">
              <div className="text-3xl">💡</div>
              <div className="flex-1">
                <h3 className="text-white font-semibold mb-1">
                  探索 AI 創作技巧
                </h3>
                <p className="text-gray-300 text-sm mb-3">
                  這裡有{" "}
                  <span className="text-yellow-400 font-bold">98 個</span>{" "}
                  包含完整生成參數的優質作品！
                  查看 Prompt、模型、採樣器等設置，快速提升你的 AI 繪圖技巧。
                </p>
                <button
                  onClick={() => {
                    setDisplayMode("collection");
                    setShowGuide(false);
                    if (typeof window !== "undefined") {
                      localStorage.setItem("galleryGuideShown", "true");
                    }
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  🔧 立即探索創作參考
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <ImageGrid
        images={images}
        viewMode={viewMode}
        onSelectImage={openImage}
        currentUser={currentUser}
        isLikedByCurrentUser={isLikedByCurrentUser}
        onToggleLike={handleToggleLike}
        onLikeUpdate={onLikeUpdateHook}
      />

      {/* sentinel：啟用錨點捲動錨定 */}
      <div
        ref={loadMoreRef}
        style={{ overflowAnchor: "auto" }}
        className="py-6 text-center text-zinc-400 text-sm"
      >
        {(!filtersReady || (loading && images.length === 0)) && "載入中..."}
        {filtersReady && loadingMore && "載入更多中..."}
        {filtersReady &&
          !loading &&
          !loadingMore &&
          hasMore &&
          images.length > 0 &&
          "載入更多中..."}
        {filtersReady &&
          !loading &&
          !hasMore &&
          images.length === 0 &&
          "目前沒有符合條件的圖片"}
        {filtersReady &&
          !loading &&
          !hasMore &&
          images.length > 0 &&
          "已經到底囉"}
      </div>

      {selectedImage && currentUser !== undefined && (
        <ImageModal
          imageData={selectedImage}
          prevImage={prevImage}
          nextImage={nextImage}
          onClose={() => setSelectedImage(null)}
          currentUser={currentUser}
          displayMode={displayMode} // ✅ 傳遞顯示模式
          onLikeUpdate={(updated) => onLikeUpdateHook(updated)}
          onNavigate={(dir) => navigateFromSelected(dir)}
          onFollowChange={handleFollowChange}
          onImageUpdated={applyUpdatedImage}
        />
      )}

      <BackToTopButton />
    </main>
  );
}

