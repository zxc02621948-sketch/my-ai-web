"use client";

import { useEffect, useState, useRef } from "react";
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

  const [images, setImages] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [sort, setSort] = useState("popular");
  const [selectedImage, setSelectedImage] = useState(null);
  const [currentUser, setCurrentUser] = useState(undefined);
  const [fetchedOnce, setFetchedOnce] = useState(false);

  const inFlightId = useRef(0);
  const loadMoreRef = useRef(null);
  const isFetchingRef = useRef(false);

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

  // 核心資料抓取（只以 inFlightId 防舊回應）
  const fetchImages = async (pageToFetch, q, cats, rats) => {
    setIsLoading(true);
    const myId = ++inFlightId.current;
    try {
      const params = new URLSearchParams({
        page: String(pageToFetch),
        limit: String(PAGE_SIZE),
        sort: mapSortForApi(sort),
      });
      if (Array.isArray(cats) && cats.length) params.set("categories", cats.join(","));
      if (Array.isArray(rats) && rats.length) params.set("ratings", rats.join(","));
      if (q) params.set("search", q);

      const r = await fetch(`/api/images?${params.toString()}`, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));

      if (myId !== inFlightId.current) return; // 只採用最新請求

      const list = Array.isArray(j?.images) ? j.images : [];
      setHasMore(list.length >= PAGE_SIZE);

      if (pageToFetch === 1) {
        setImages(list);
      } else {
        setImages((prev) => {
          const exists = new Set(prev.map((x) => String(x._id)));
          const uniq = list.filter((x) => !exists.has(String(x._id)));
          return [...prev, ...uniq];
        });
      }
      setPage(pageToFetch);
      setFetchedOnce(true);
    } catch (e) {
      console.error("載入圖片失敗", e);
    } finally {
      setIsLoading(false);
    }
  };

  // 當 search / sort / filters 變 → 清畫面、抓第 1 頁
  useEffect(() => {
    const q = (searchParams.get("search") || "").trim();
    setFetchedOnce(false);
    setImages([]);
    setPage(1);
    setHasMore(true);
    fetchImages(1, q, selectedCategories, selectedRatings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, sort, JSON.stringify(selectedCategories), JSON.stringify(selectedRatings)]);

  // 無限捲動
  useEffect(() => {
    if (!hasMore || isLoading || !fetchedOnce) return;
    const el = loadMoreRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingRef.current) {
          isFetchingRef.current = true;
          const q = (searchParams.get("search") || "").trim();
          Promise.resolve(fetchImages(page + 1, q, selectedCategories, selectedRatings))
            .finally(() => {
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  isFetchingRef.current = false;
                });
              });
            });
        }
      },
      { root: null, rootMargin: "1200px 0px", threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, isLoading, fetchedOnce, page, searchParams, JSON.stringify(selectedCategories), JSON.stringify(selectedRatings)]);

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

  // ImageModal 導航
  const openImage = (img) => setSelectedImage(img);
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

      <div className="max-w-6xl mx-auto mb-3 flex items-center justify-end">
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

      <div ref={loadMoreRef} className="py-6 text-center text-zinc-400 text-sm">
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
        />
      )}

      <BackToTopButton />
    </main>
  );
}
