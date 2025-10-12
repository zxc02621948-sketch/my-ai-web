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


/** ====== 超精簡資料流：去掉預覽/快取/一次性旗標，只保留 inFlightId ====== */

const PAGE_SIZE = 20;

export default function HomePage() {
  const player = usePlayer();
  const searchParams = useSearchParams();
  
  // 從 FilterContext 獲取狀態
  const {
    levelFilters,
    categoryFilters,
    viewMode,
  } = useFilterContext();

  // 本地狀態
  const [sort, setSort] = useState("popular");

  // 計算衍生狀態（使用 useMemo 避免無限循環）
  const selectedCategories = useMemo(() => categoryFilters, [categoryFilters]);
  const selectedRatings = useMemo(() => 
    levelFilters.map(label => labelToRating[label]).filter(Boolean), 
    [levelFilters]
  );
  
  const [images, setImages] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [currentUser, setCurrentUser] = useState(undefined);
  const [fetchedOnce, setFetchedOnce] = useState(false);

  // —— 追蹤狀態同步（父層處理器，提供給 ImageModal） ——
  const handleFollowChange = (targetUserId, isFollowing) => {
    // 1) 同步正在開啟的大圖
    setSelectedImage((prev) => {
      if (!prev) return prev;
      const uid =
        typeof prev.user === "object"
          ? (prev.user?._id || prev.user?.id || prev.user?.userId)
          : prev.user;
      if (uid && String(uid) === String(targetUserId)) {
        const userObj =
          typeof prev.user === "object"
            ? { ...prev.user, _id: prev.user?._id || prev.user?.id || prev.user?.userId }
            : { _id: uid };
        return { ...prev, user: { ...userObj, isFollowing } };
      }
      return prev;
    });

    // 2) 同步首頁列表卡片
    setImages((prev) =>
      Array.isArray(prev)
        ? prev.map((img) => {
            const uid =
              typeof img.user === "object"
                ? (img.user?._id || img.user?.id || img.user?.userId)
                : img.user;
            if (uid && String(uid) === String(targetUserId)) {
              const userObj = typeof img.user === "object" ? img.user : { _id: uid };
              return { ...img, user: { ...userObj, isFollowing } };
            }
            return img;
          })
        : prev
    );

    // 3) 同步 currentUser.following
    setCurrentUser((prev) => {
      if (!prev) return prev;
      const uid = String(targetUserId);
      const list = Array.isArray(prev.following) ? [...prev.following] : [];
      const getId = (x) => (typeof x === "object" && x !== null ? String(x.userId) : String(x));
      const exists = list.some((x) => getId(x) === uid);
      let nextList = list;
      if (isFollowing && !exists) nextList = [...list, uid];
      if (!isFollowing && exists) nextList = list.filter((x) => getId(x) !== uid);
      return { ...prev, following: nextList };
    });
  };

  // ===== Refs（用於避免 IntersectionObserver 的閉包舊值問題） =====
  const inFlightId = useRef(0);
  const loadMoreRef = useRef(null);
  const isFetchingRef = useRef(false); // 並發鎖

  const pageRef = useRef(1);
  const qRef = useRef("");
  const catsRef = useRef([]);
  const ratsRef = useRef([]);
  const sortRef = useRef("popular");


  // 回到首頁：關閉並隱藏全域迷你播放器，避免佔位與殘留播放
  useEffect(() => {
    // ✅ 立即禁用播放器，避免閃現
    player?.setMiniPlayerEnabled?.(false);
    
    const checkPinnedPlayer = async () => {
      try {
        // 檢查是否有釘選播放器
        const res = await fetch('/api/current-user');
        const userData = await res.json();
        const pinnedPlayer = userData?.user?.pinnedPlayer || userData?.pinnedPlayer;
        
        const hasPinnedPlayer = pinnedPlayer?.userId && 
          pinnedPlayer?.expiresAt && 
          new Date(pinnedPlayer.expiresAt) > new Date();
        
        // ✅ 首頁必須禁用 MiniPlayer（除非有釘選且未過期）
        if (!hasPinnedPlayer) {
          player?.pause?.();
          player?.setExternalControls?.(null);
          player?.setExternalPlaying?.(false);
          // ✅ 清空播放器狀態，確保 GlobalYouTubeBridge 不會渲染
          player?.setSrc?.('');
          player?.setOriginUrl?.('');
          player?.setTrackTitle?.('');
          player?.setPlaylist?.([]);
        } else {
          // ✅ 載入釘選的播放清單
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
          }
          
          // 確保 MiniPlayer 是啟用的
          player?.setMiniPlayerEnabled?.(true);
        }
        
        player?.setShareMode?.("global");
      } catch (error) {
        console.error('🏠 首頁檢查釘選播放器失敗:', error);
        // ✅ 如果檢查失敗，預設禁用 MiniPlayer（安全起見）
        player?.setMiniPlayerEnabled?.(false);
        player?.setShareMode?.("global");
      }
    };
    
    checkPinnedPlayer();
    
    // 監聽釘選變更事件，重新檢查並載入播放清單
    const handlePinnedChange = () => {
      checkPinnedPlayer();
    };
    
    window.addEventListener('pinnedPlayerChanged', handlePinnedChange);
    
    return () => {
      window.removeEventListener('pinnedPlayerChanged', handlePinnedChange);
    };
  }, []); // 只在組件掛載時執行一次，避免重複禁用播放器

  // 雙軌制訪問追蹤 - 同時記錄防刷量統計和廣告收益統計
  useEffect(() => {
    let isLogging = false; // 防止並發請求
    
    const logDualTrackVisit = async () => {
      try {
        // 防止並發請求
        if (isLogging) {
          console.log('🔄 訪問記錄正在進行中，跳過重複請求');
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
              console.log('🛡️ [防刷量] 此會話已記錄過訪問，跳過重複記錄');
              return { success: true, skipped: true, reason: 'session' };
            }

            // 檢查最近是否剛記錄過（防抖機制）
            const lastLogTime = sessionStorage.getItem('last_visit_log_time');
            const now = Date.now();
            if (lastLogTime && (now - parseInt(lastLogTime)) < 1000) { // 1秒內不重複記錄
              console.log('🛡️ [防刷量] 最近剛記錄過訪問，跳過重複記錄');
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
              console.log('✅ [防刷量] 訪問記錄成功');
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
              console.log('💰 [廣告統計] 200ms內重複請求，跳過');
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
              console.log('💰 [廣告統計] 訪問記錄成功:', result.isDuplicate ? '(後端判定為重複)' : '(新記錄)');
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
        console.log('📊 [雙軌統計] 結果:', {
          防刷量: antiSpamResult.status === 'fulfilled' ? antiSpamResult.value : antiSpamResult.reason,
          廣告統計: adRevenueResult.status === 'fulfilled' ? adRevenueResult.value : adRevenueResult.reason
        });

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

  // 取得目前登入者
  useEffect(() => {
    const getMe = async () => {
      try {
        const r = await fetch(`/api/current-user?ts=${Date.now()}`, { cache: "no-store" });
        if (!r.ok) throw 0;
        const u = await r.json();
        setCurrentUser(u);
      } catch {
        setCurrentUser(null);
      }
    };
    getMe();
  }, []);

  // 調試信息已移除

  // 排序參數對應後端
  const mapSortForApi = (s) => {
    const v = (s || "").toLowerCase();
    return v === "likes" || v === "mostlikes" ? "mostlikes" : v;
  };

  // 圖片合併和更新函數
  const mergeImage = (oldImg, updated) => {
    if (!oldImg || !updated?._id) return oldImg;
    if (String(oldImg._id) !== String(updated._id)) return oldImg;
    const nextUser =
      updated.user ||
      (typeof oldImg.user === "object"
        ? oldImg.user
        : (oldImg.user ? { _id: oldImg.user } : undefined));
    return { ...oldImg, ...updated, ...(nextUser ? { user: nextUser } : {}) };
  };

  const applyUpdatedImage = useCallback((updated) => {
    if (!updated?._id) return;
    setImages((prev) => (Array.isArray(prev) ? prev.map((it) => mergeImage(it, updated)) : prev));
    setSelectedImage((prev) => mergeImage(prev, updated));
  }, []);

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
          setImages((prev) => {
            const exists = Array.isArray(prev) && prev.some((x) => String(x._id) === String(img._id));
            return exists ? prev : [normalizeImage(img), ...(Array.isArray(prev) ? prev : [])];
          });
          setSelectedImage(normalizeImage(img));
        } else {
          alert("找不到該圖片，可能已被刪除");
        }
      } catch (err) {
        console.warn("⚠️ 找不到該圖片，可能已被刪除", err);
        alert("找不到該圖片，可能已被刪除");
      }
    };
    window.addEventListener("openImageModal", onOpenFromNotification);
    return () => window.removeEventListener("openImageModal", onOpenFromNotification);
  }, []);

  // —— 單張圖片更新（從子元件或外部事件） ——
  useEffect(() => {
    const onUpdated = (e) => {
      const updated = e?.detail?.updated;
      if (updated?._id) applyUpdatedImage(updated);
    };
    window.addEventListener("image-updated", onUpdated);
    return () => window.removeEventListener("image-updated", onUpdated);
  }, [applyUpdatedImage]);

  // —— 同步最新的查詢條件到 refs（避免閉包舊值） ——
  useEffect(() => {
    qRef.current = (searchParams.get("search") || "").trim();
  }, [searchParams]);
  useEffect(() => { catsRef.current = selectedCategories; }, [selectedCategories]);
  useEffect(() => { ratsRef.current = selectedRatings; }, [selectedRatings]);
  useEffect(() => { sortRef.current = sort; }, [sort]);
  useEffect(() => { pageRef.current = page; }, [page]);

  // —— 核心資料抓取（只以 inFlightId 防舊回應） ——
  const fetchImages = useCallback(async (pageToFetch, q, cats, rats) => {
    // 調試信息已移除
    
    setIsLoading(true);
    const myId = ++inFlightId.current;
    
    try {
      const params = new URLSearchParams({
        page: String(pageToFetch),
        limit: String(PAGE_SIZE),
        sort: mapSortForApi(sortRef.current),
      });
      if (Array.isArray(cats) && cats.length) params.set("categories", cats.join(","));
      if (Array.isArray(rats) && rats.length) params.set("ratings", rats.join(","));
      if (q) params.set("search", q);

      const url = `/api/images?${params.toString()}`;
      // 調試信息已移除

      // 添加超时控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

      const r = await fetch(url, { 
        cache: "no-store",
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      clearTimeout(timeoutId);

      if (!r.ok) {
        throw new Error(`HTTP ${r.status}: ${r.statusText}`);
      }

      const j = await r.json();

      // 調試信息已移除

      if (myId !== inFlightId.current) return; // 只採用最新請求

      const listRaw = Array.isArray(j?.images) ? j.images : [];
      const list = listRaw.map(normalizeImage);
      setHasMore(list.length >= PAGE_SIZE);

      console.log('🔍 [fetchImages] Setting images:', { 
        pageToFetch, 
        listLength: list.length,
        firstImageId: list[0]?._id || 'none'
      });

      if (pageToFetch === 1) {
        console.log('🔥 [fetchImages] Setting images for page 1:', list.length, 'images');
        setImages(list);
        console.log('🔥 [fetchImages] Images set for page 1');
      } else {
        // 直接添加新圖片，不做任何滾動位置干預
        setImages((prev) => {
          const exists = new Set(prev.map((x) => String(x._id)));
          const uniq = list.filter((x) => !exists.has(String(x._id)));
          return [...prev, ...uniq];
        });
      }
      setPage(pageToFetch);
      setFetchedOnce(true);
    } catch (e) {
      if (myId !== inFlightId.current) return; // 忽略已取消的請求
      
      console.error("🚨 [fetchImages] 載入圖片失敗:", e.message || e);
      
      // 如果是超時或網路錯誤，可以考慮重試
      if (e.name === 'AbortError') {
        console.warn("⏰ [fetchImages] 請求超時");
      } else if (e.message?.includes('Failed to fetch')) {
        console.warn("🌐 [fetchImages] 網路連接失敗");
      }
    } finally {
      if (myId === inFlightId.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // —— 初始載入圖片 ——
  useEffect(() => {
    if (selectedRatings.length > 0 && !fetchedOnce) {
      console.log('🔥 [INITIAL LOAD] Loading images on mount');
      fetchImages(1, qRef.current, selectedCategories, selectedRatings);
    }
  }, [selectedRatings, fetchedOnce, selectedCategories, fetchImages]);

  // —— 首頁的第 1 頁載入（搜尋/排序/篩選變更時） ——
  useEffect(() => {
    const q = (searchParams.get("search") || "").trim();
    setFetchedOnce(false);
    setImages([]);
    setPage(1);
    setHasMore(true);
    fetchImages(1, q, selectedCategories, selectedRatings);
  }, [fetchImages, selectedCategories, selectedRatings, searchParams]);





  // —— 無限捲動（最小依賴 + 使用 refs 讀最新狀態） ——
  useEffect(() => {
    if (!hasMore || isLoading || !fetchedOnce) return;
    const el = loadMoreRef.current;
    if (!el) return;

    const handleLoadMore = () => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      const q = qRef.current;
      const cats = catsRef.current;
      const rats = ratsRef.current;
      const nextPage = (pageRef.current || 1) + 1;
      fetchImages(nextPage, q, cats, rats).finally(() => {
        isFetchingRef.current = false;
      });
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          handleLoadMore();
        }
      },
      { root: null, rootMargin: "500px 0px", threshold: 0.01 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, isLoading, fetchedOnce, fetchImages]);

  // Like hook
  const { handleToggleLike, onLikeUpdate: onLikeUpdateHook } = useLikeHandler({
    setUploadedImages: setImages,
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

  const normalizeImage = (img) => {
    if (!img) return img;
    const raw = img.user ?? img.userId ?? null;
    const uid = typeof raw === "object"
      ? (raw?._id || raw?.id || raw?.userId || null)
      : (raw || null);
    const userObj = (typeof raw === "object")
      ? { ...raw, _id: uid }
      : (uid ? { _id: uid } : { _id: null });
    const isFollowingVal =
      (typeof raw === "object" ? raw?.isFollowing : img?.isFollowing) ?? false;
    return { ...img, user: { ...userObj, isFollowing: Boolean(isFollowingVal) } };
  };

  // ImageModal 導航
  const openImage = (img) => setSelectedImage(normalizeImage(img));
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

      <div className="max-w-6xl mx-auto mb-3 flex items-center justify-between">
        {/* 左邊：版本資訊 */}
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span>版本 v0.7.6（2025-08-11）</span>
          <a href="/changelog" className="underline hover:text-white">
            查看更新內容
          </a>
        </div>

        {/* 右邊：排序下拉 */}
        <SortSelect value={sort} onChange={setSort} />
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
        {!fetchedOnce && isLoading && "載入中..."}
        {fetchedOnce && hasMore && "載入更多中..."}
        {fetchedOnce && !isLoading && images.length === 0 && "目前沒有符合條件的圖片"}
        {fetchedOnce && !hasMore && images.length > 0 && "已經到底囉"}
      </div>

      {selectedImage && currentUser !== undefined && (
        <ImageModal
          imageData={selectedImage}
          prevImage={prevImage}
          nextImage={nextImage}
          onClose={() => setSelectedImage(null)}
          currentUser={currentUser}
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
