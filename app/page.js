"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import ImageGrid from "@/components/image/ImageGrid";
import ImageModal from "@/components/image/ImageModal";
import AdminPanel from "@/components/homepage/AdminPanel";
import BackToTopButton from "@/components/common/BackToTopButton";
import SortSelect from "@/components/common/SortSelect";
import { useFilterContext, labelToRating } from "@/components/context/FilterContext";
import useLikeHandler from "@/hooks/useLikeHandler";
import { usePlayer } from "@/components/context/PlayerContext";
import { useCurrentUser } from "@/contexts/CurrentUserContext";
import { notify } from "@/components/common/GlobalNotificationManager";
import usePinnedPlayerBootstrap from "@/hooks/usePinnedPlayerBootstrap";
import usePaginatedResource from "@/hooks/usePaginatedResource";


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

export default function HomePage() {
  const player = usePlayer();
  const searchParams = useSearchParams();
  const { currentUser, setCurrentUser } = useCurrentUser(); // 使用 Context
  
  // 從 FilterContext 獲取狀態
  const {
    levelFilters,
    categoryFilters,
    viewMode,
  } = useFilterContext();

  // 本地狀態
  const [sort, setSort] = useState("popular");
  
  // ✅ 記住用戶偏好（避免 hydration 錯誤）
  const [displayMode, setDisplayMode] = useState('gallery');
  
  // ✅ 首次訪問引導（避免 hydration 錯誤）
  const [showGuide, setShowGuide] = useState(false);
  
  // ✅ 客戶端初始化
  const [isClient, setIsClient] = useState(false);
  
  // ✅ 手機檢測（避免 hydration 錯誤）
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
    // 從 localStorage 讀取偏好
    const savedMode = localStorage.getItem('galleryMode');
    if (savedMode) {
      setDisplayMode(savedMode);
    }
    // 檢查是否顯示引導
    const guideShown = localStorage.getItem('galleryGuideShown');
    if (!guideShown) {
      setShowGuide(true);
    }
    // 檢測手機裝置
    setIsMobile(window.innerWidth < 768);
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 保存模式偏好
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('galleryMode', displayMode);
    }
  }, [displayMode]);

  // 計算衍生狀態（使用 useMemo 避免無限循環）
  const selectedCategories = useMemo(() => categoryFilters, [categoryFilters]);
  const selectedRatings = useMemo(() => 
    levelFilters.map(label => labelToRating[label]).filter(Boolean), 
    [levelFilters]
  );
  
  const [selectedImage, setSelectedImage] = useState(null);

  const loadMoreRef = useRef(null);
  usePinnedPlayerBootstrap({ player, currentUser });

  // 雙軌制訪問追蹤 - 同時記錄防刷量統計和廣告收益統計
  useEffect(() => {
    let isLogging = false; // 防止並發請求
    
    const logDualTrackVisit = async () => {
      try {
        // 防止並發請求
        if (isLogging) {
          return;
        }

        isLogging = true;
        const currentPath = window.location.pathname;
        
        // 🛡️ 防刷量統計 - 保持原有的嚴格防重複機制
        const logAntiSpamVisit = async () => {
          try {
            // 檢查是否已經在此會話中記錄過訪問
            const sessionKey = `visit_logged_${currentPath}`;
            const hasLoggedThisSession = sessionStorage.getItem(sessionKey);
            
            if (hasLoggedThisSession) {
              return { success: true, skipped: true, reason: 'session' };
            }

            // 檢查最近是否剛記錄過（防抖機制）
            const lastLogTime = sessionStorage.getItem('last_visit_log_time');
            const now = Date.now();
            if (lastLogTime && (now - parseInt(lastLogTime)) < 1000) { // 1秒內不重複記錄
              return { success: true, skipped: true, reason: 'debounce' };
            }
            
            const response = await fetch('/api/log-visit', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              credentials: 'include',
              body: JSON.stringify({
                path: currentPath
              })
            });

            if (response.ok) {
              // 標記此會話已記錄過訪問
              sessionStorage.setItem(sessionKey, 'true');
              sessionStorage.setItem('last_visit_log_time', now.toString());
              return { success: true, skipped: false };
            } else {
              throw new Error(`HTTP ${response.status}`);
            }
          } catch (error) {
            console.warn('🛡️ [防刷量] 訪問記錄失敗:', error);
            return { success: false, error };
          }
        };

        // 💰 廣告收益統計 - 更寬鬆的防重複機制
        const logAdRevenueVisit = async () => {
          try {
            // 廣告統計只檢查很短時間內的重複（避免同一次點擊產生多次記錄）
            const adLastLogTime = sessionStorage.getItem('last_ad_visit_log_time');
            const now = Date.now();
            if (adLastLogTime && (now - parseInt(adLastLogTime)) < 200) { // 200ms內不重複記錄
              return { success: true, skipped: true, reason: 'rapid_click' };
            }

            const response = await fetch('/api/log-ad-visit', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              credentials: 'include',
              body: JSON.stringify({
                path: currentPath
              })
            });

            if (response.ok) {
              sessionStorage.setItem('last_ad_visit_log_time', now.toString());
              const result = await response.json();
              return { success: true, skipped: false, isDuplicate: result.isDuplicate };
            } else {
              throw new Error(`HTTP ${response.status}`);
            }
          } catch (error) {
            console.warn('💰 [廣告統計] 訪問記錄失敗:', error);
            return { success: false, error };
          }
        };

        // 並行執行兩個統計
        const [antiSpamResult, adRevenueResult] = await Promise.allSettled([
          logAntiSpamVisit(),
          logAdRevenueVisit()
        ]);

        // 記錄結果

      } catch (error) {
        console.warn('📊 [雙軌統計] 整體失敗:', error);
      } finally {
        isLogging = false;
      }
    };

    // 使用 setTimeout 延遲執行，確保頁面完全加載
    const timeoutId = setTimeout(logDualTrackVisit, 100);
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, []); // 只在組件掛載時執行一次

  // 調試信息已移除

  // 排序參數對應後端
  const mapSortForApi = (s) => {
    const v = (s || "").toLowerCase();
    return v === "likes" || v === "mostlikes" ? "mostlikes" : v;
  };

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
      const timeoutId = setTimeout(() => controller.abort(), 15000);

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
    enabled: filtersReady,
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
                  _id: prev.user?._id || prev.user?.id || prev.user?.userId,
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
                const userObj = typeof img.user === "object" ? img.user : { _id: uid };
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
        if (!isFollowing && exists) nextList = list.filter((x) => getId(x) !== uid);
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
            const exists = prev.some((x) => String(x._id) === String(img._id));
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
    return () => window.removeEventListener("openImageModal", onOpenFromNotification);
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

  // —— 無限捲動（共用 hook） ——
  useEffect(() => {
    if (!filtersReady || !hasMore || loading || loadingMore) return;
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
    return img.likes.includes(uid);
  };

  // ImageModal 導航
  const openImage = (img) => setSelectedImage(normalizeImageData(img));
  const idx = selectedImage ? images.findIndex((x) => String(x._id) === String(selectedImage._id)) : -1;
  const prevImage = idx > 0 ? images[idx - 1] : undefined;
  const nextImage = idx >= 0 && idx < images.length - 1 ? images[idx + 1] : undefined;
  const navigateFromSelected = (dir) => {
    if (idx < 0) return;
    const nextIdx = dir === "next" ? idx + 1 : idx - 1;
    if (nextIdx < 0 || nextIdx >= images.length) return;
    setSelectedImage(images[nextIdx]);
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-white px-4 pb-4 pt-0 -mt-2 md:-mt-16">
      {currentUser?.isAdmin && (
        <div className="mb-4">
          <AdminPanel />
        </div>
      )}

      {/* ✅ 畫廊/作品集標籤切換 */}
      <div className="max-w-6xl mx-auto mb-4">
        <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6">
          {/* 左側：模式切換標籤 */}
          <div className="flex gap-3">
                   <button
                     onClick={() => setDisplayMode("gallery")}
                     className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                       displayMode === "gallery"
                         ? "bg-white text-black shadow-md"
                         : "bg-zinc-800 text-gray-300 hover:bg-zinc-700"
                     }`}
                   >
                     🎨 作品展示
                     <span className="text-xs ml-1.5 opacity-60">全部作品</span>
                   </button>
                   <button
                     onClick={() => setDisplayMode("collection")}
                     className={`relative px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                       displayMode === "collection"
                         ? "bg-white text-black shadow-md"
                         : "bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-lg"
                     }`}
                   >
                     <span className="flex items-center gap-1.5">
                       🔧 創作參考
                       <span className="text-xs opacity-75">可學習參數</span>
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

          {/* 中間：關於本站、版本資訊和法律連結（手機版隱藏） */}
          <div className="hidden md:flex items-center gap-4 text-xs text-gray-400 flex-1 justify-center flex-wrap">
                <div className="flex items-center gap-2">
                  <a href="/about" className="hover:text-white transition text-sm font-medium text-blue-400">我們的故事</a>
              <span className="text-gray-600">•</span>
              <span className="text-sm text-yellow-400">版本 v0.8.0（2025-10-15）🎉</span>
              <a href="/changelog" className="text-sm underline hover:text-white">
                查看更新內容
              </a>
            </div>
            <div className="flex items-center gap-2">
              <a href="/privacy" className="hover:text-white transition">隱私政策</a>
              <span className="text-gray-600">•</span>
              <a href="/terms" className="hover:text-white transition">服務條款</a>
            </div>
          </div>

          {/* 右側：排序 + 前往創作 */}
          <div className="flex items-center gap-3">
            <SortSelect value={sort} onChange={setSort} />
            <a
              href="/images/create"
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500/90 to-teal-500/90 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 hover:from-emerald-500 hover:to-teal-500 transition"
            >
              <span role="img" aria-label="前往創作圖片">🧪</span>
              前往創作圖片
            </a>
          </div>
        </div>

               {/* ✅ 首次訪問引導橫幅（手機版隱藏） */}
               {showGuide && displayMode === "gallery" && !isMobile && (
                 <div className="mt-3 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/50 rounded-lg p-4 relative">
                   <button
                     onClick={() => {
                       setShowGuide(false);
                       if (typeof window !== 'undefined') {
                         localStorage.setItem('galleryGuideShown', 'true');
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
                       <h3 className="text-white font-semibold mb-1">探索 AI 創作技巧</h3>
                       <p className="text-gray-300 text-sm mb-3">
                         這裡有 <span className="text-yellow-400 font-bold">98 個</span> 包含完整生成參數的優質作品！
                         查看 Prompt、模型、採樣器等設置，快速提升你的 AI 繪圖技巧。
                       </p>
                       <button
                         onClick={() => {
                           setDisplayMode('collection');
                           setShowGuide(false);
                           if (typeof window !== 'undefined') {
                             localStorage.setItem('galleryGuideShown', 'true');
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
        onLocalLikeChange={(updated) => onLikeUpdateHook(updated)}
      />

      {/* sentinel：啟用錨點捲動錨定 */}
      <div
        ref={loadMoreRef}
        style={{ overflowAnchor: "auto" }}
        className="py-6 text-center text-zinc-400 text-sm"
      >
        {(!filtersReady || (loading && images.length === 0)) && "載入中..."}
        {filtersReady && loadingMore && "載入更多中..."}
        {filtersReady && !loading && !loadingMore && hasMore && images.length > 0 && "載入更多中..."}
        {filtersReady && !loading && !hasMore && images.length === 0 && "目前沒有符合條件的圖片"}
        {filtersReady && !loading && !hasMore && images.length > 0 && "已經到底囉"}
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
