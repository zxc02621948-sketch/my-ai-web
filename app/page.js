"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import ImageGrid from "@/components/image/ImageGrid";
import ImageModal from "@/components/image/ImageModal";
import AdminPanel from "@/components/homepage/AdminPanel";
import BackToTopButton from "@/components/common/BackToTopButton";
import SortSelect from "@/components/common/SortSelect";
import { useFilterContext, labelToRating } from "@/components/context/FilterContext";
import useLikeHandler from "@/hooks/useLikeHandler";

/** ====== 超精簡資料流：去掉預覽/快取/一次性旗標，只保留 inFlightId ====== */

const PAGE_SIZE = 20;

export default function HomePage() {
  const searchParams = useSearchParams();
  const userCacheRef = useRef(new Map()); // userId -> userObject（保留）

  const [images, setImages] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [sort, setSort] = useState("popular");
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

  const { levelFilters, categoryFilters, viewMode } = useFilterContext();
  const selectedRatings = Array.isArray(levelFilters)
    ? levelFilters.map((label) => labelToRating[label]).filter(Boolean)
    : [];
  const selectedCategories = Array.isArray(categoryFilters)
    ? categoryFilters.filter(Boolean)
    : [];

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

  // 排序參數對應後端
  const mapSortForApi = (s) => {
    const v = (s || "").toLowerCase();
    return v === "likes" || v === "mostlikes" ? "mostlikes" : v;
  };

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
  }, []);

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

      const r = await fetch(`/api/images?${params.toString()}`, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));

      if (myId !== inFlightId.current) return; // 只採用最新請求

      const listRaw = Array.isArray(j?.images) ? j.images : [];
      const list = listRaw.map(normalizeImage);
      setHasMore(list.length >= PAGE_SIZE);

      if (pageToFetch === 1) {
        setImages(list);
      } else {
        // 追加前記錄當前 scroll 位置與總高度，避免 layout shift 意外回頂
        const prevScroll = window.scrollY;
        const prevHeight = document.documentElement.scrollHeight;
        setImages((prev) => {
          const exists = new Set(prev.map((x) => String(x._id)));
          const uniq = list.filter((x) => !exists.has(String(x._id)));
          return [...prev, ...uniq];
        });
        // 下一個 frame 檢查是否被意外拉回頂部；若是，按高度差補償
        requestAnimationFrame(() => {
          const nextHeight = document.documentElement.scrollHeight;
          if (window.scrollY < prevScroll && nextHeight > prevHeight) {
            const delta = nextHeight - prevHeight;
            window.scrollTo({ top: prevScroll + delta, behavior: "auto" });
          }
        });
      }
      setPage(pageToFetch);
      setFetchedOnce(true);
    } catch (e) {
      console.error("載入圖片失敗", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // —— 首頁的第 1 頁載入（搜尋/排序/篩選變更時） ——
  useEffect(() => {
    const q = (searchParams.get("search") || "").trim();
    setFetchedOnce(false);
    setImages([]);
    setPage(1);
    setHasMore(true);
    fetchImages(1, q, selectedCategories, selectedRatings);
  }, [searchParams, sort, JSON.stringify(selectedCategories), JSON.stringify(selectedRatings), fetchImages]);

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
        if (entries[0].isIntersecting) handleLoadMore();
      },
      { root: null, rootMargin: "900px 0px", threshold: 0.01 }
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

  const applyUpdatedImage = (updated) => {
    if (!updated?._id) return;
    setImages((prev) => (Array.isArray(prev) ? prev.map((it) => mergeImage(it, updated)) : prev));
    setSelectedImage((prev) => mergeImage(prev, updated));
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
        isLoading={isLoading}
        hasMore={hasMore}
        onSelectImage={openImage}
        loadMoreRef={loadMoreRef}
        currentUser={currentUser}
        isLikedByCurrentUser={isLikedByCurrentUser}
        onToggleLike={handleToggleLike}
        gutter={15}
        onLikeUpdate={(updated) => onLikeUpdateHook(updated)}
      />

      {/* sentinel：避免錨點導致的捲動錨定（overflow-anchor） */}
      <div
        ref={loadMoreRef}
        style={{ overflowAnchor: "none" }}
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
