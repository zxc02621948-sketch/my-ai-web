"use client";

import { useEffect, useState, useRef } from "react";
import ImageModal from "@/components/image/ImageModal";
import { useRouter, useSearchParams } from "next/navigation";
import ImageGrid from "@/components/image/ImageGrid";
import AdminPanel from "@/components/homepage/AdminPanel";
import BackToTopButton from "@/components/common/BackToTopButton";
import { useFilterContext, labelToRating } from "@/components/context/FilterContext";
import useLikeHandler from "@/hooks/useLikeHandler";
import SortSelect from "@/components/common/SortSelect";

/* 使用者快取：開彈窗前補齊 user 物件 */
const userCache = new Map();
async function fetchUserById(id) {
  if (!id) return null;
  if (userCache.has(id)) return userCache.get(id);
  try {
    const res = await fetch(`/api/user/${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    const user = data?.user || data?.data || null;
    if (user) userCache.set(id, user);
    return user;
  } catch {
    return null;
  }
}
async function ensureUserOnImage(img) {
  if (!img) return img;
  const u = img.user ?? img.userId;
  if (u && typeof u === "string") {
    const user = await fetchUserById(u);
    if (user) return { ...img, user };
  }
  return img;
}

export default function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const PAGE_SIZE = 20;

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [images, setImages] = useState([]);
  const [sort, setSort] = useState("popular");
  const [selectedImage, setSelectedImage] = useState(null);
  const [currentUser, setCurrentUser] = useState(undefined);

  const fetchedOnceRef = useRef(false);
  const lastUrlSearchRef = useRef(null);
  const lastSortRef = useRef("popular");
  const lastCatsRef = useRef("[]");
  const lastRatsRef = useRef("[]");
  const loadMoreRef = useRef(null);
  const inFlight = useRef(0);

  // 從 Context 讀值（含 viewMode）
  const { levelFilters, categoryFilters, resetFilters, viewMode } = useFilterContext();

  const selectedRatings = Array.isArray(levelFilters)
    ? levelFilters.map((label) => labelToRating[label]).filter(Boolean)
    : [];
  const selectedCategories = Array.isArray(categoryFilters)
    ? categoryFilters.filter(Boolean)
    : [];

  const reportClick = (id) => {
    if (!id) return;
    const key = `click:${id}`;
    const now = Date.now();
    const last = Number(localStorage.getItem(key) || 0);
    if (now - last < 30 * 1000) return;
    localStorage.setItem(key, String(now));
    fetch(`/api/images/${id}/click`, { method: "POST" }).catch(() => {});
  };

  // ✅ 樂觀預過濾：先用現有 images 立即套用篩選，提升體感
  const optimisticFilter = () => {
    setImages((prev) => {
      if (!Array.isArray(prev) || prev.length === 0) return prev;
      const wantCats = new Set(selectedCategories);
      const wantRates = new Set(selectedRatings.map(String)); // "all" | "15" | "18"
      return prev.filter((img) => {
        const okCat = wantCats.size ? wantCats.has(img.category) : true;
        const okRate = wantRates.size ? wantRates.has(String(img.rating)) : true;
        return okCat && okRate;
      });
    });
  };

  const fetchImages = async (pageToFetch = 1, q = "", categories = [], ratings = []) => {
    setIsLoading(true);
    try {
      const cats = Array.isArray(categories) ? categories.filter(Boolean) : [];
      const rats = Array.isArray(ratings) ? ratings.filter(Boolean) : [];
      const myCall = ++inFlight.current;

      const params = new URLSearchParams({
        page: String(pageToFetch),
        limit: String(PAGE_SIZE),
        sort,
        ...(q ? { q } : {}),
        ...(cats.length ? { categories: cats.join(",") } : {}),
        ...(rats.length ? { ratings: rats.join(",") } : {}),
      });

      const res = await fetch(`/api/images?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (myCall !== inFlight.current) return;

      if (res.ok && Array.isArray(data.images)) {
        const newImages = data.images;
        if (pageToFetch === 1) {
          setImages(newImages);
        } else {
          setImages((prev) => {
            const existingIds = new Set(prev.map((img) => String(img._id)));
            const uniqueNewImages = newImages.filter((img) => !existingIds.has(String(img._id)));
            return [...prev, ...uniqueNewImages];
          });
        }
        setHasMore(newImages.length >= PAGE_SIZE);
        setPage(pageToFetch);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error("載入圖片失敗：", err);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch("/api/current-user");
      if (!res.ok) throw new Error("未登入");
      const user = await res.json();
      setCurrentUser(user);
    } catch {
      setCurrentUser(null);
    }
  };

  const { handleToggleLike, onLikeUpdate: onLikeUpdateHook } = useLikeHandler({
    setUploadedImages: setImages,
    setLikedImages: null,
    selectedImage,
    setSelectedImage,
    currentUser,
  });

  const isLikedByCurrentUser = (img) => {
    if (!currentUser || !img.likes) return false;
    const userId = currentUser._id || currentUser.id;
    return img.likes.includes(userId);
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  // 🔁 搜尋 / 排序 / 分類 / 分級：任何一項變動都觸發
  useEffect(() => {
    const q = (searchParams.get("search") || "").trim();
    const byLogo = sessionStorage.getItem("homepageReset") === "1";

    const catsStr = JSON.stringify(selectedCategories);
    const ratsStr = JSON.stringify(selectedRatings);

    const nothingChanged =
      fetchedOnceRef.current &&
      q === lastUrlSearchRef.current &&
      sort === lastSortRef.current &&
      catsStr === lastCatsRef.current &&
      ratsStr === lastRatsRef.current;

    if (nothingChanged) {
      if (byLogo && q === "") {
        fetchImages(1, "", selectedCategories, selectedRatings);
        resetFilters();
        sessionStorage.removeItem("homepageReset");
      }
      return;
    }

    lastUrlSearchRef.current = q;
    lastSortRef.current = sort;
    lastCatsRef.current = catsStr;
    lastRatsRef.current = ratsStr;

    // ⭐ 先做一次本地樂觀過濾 → 畫面立即變
    optimisticFilter();

    if (!fetchedOnceRef.current) {
      fetchedOnceRef.current = true;
      fetchImages(1, "", selectedCategories, selectedRatings);
      setPage(1);
      return;
    }

    if (q === "") {
      fetchImages(1, "", selectedCategories, selectedRatings);
    } else {
      const h = setTimeout(() => {
        fetchImages(1, q, selectedCategories, selectedRatings);
      }, 250);
      return () => clearTimeout(h);
    }
  }, [searchParams, sort, selectedCategories, selectedRatings]);

  // 無限滾動
  useEffect(() => {
    if (!hasMore || isLoading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          const q = (searchParams.get("search") || "").trim();
          fetchImages(page + 1, q, selectedCategories, selectedRatings);
        }
      },
      { root: null, rootMargin: "0px", threshold: 1.0 }
    );
    const el = loadMoreRef.current;
    if (el) observer.observe(el);
    return () => {
      if (el) observer.unobserve(el);
    };
  }, [hasMore, isLoading, page, sort, searchParams, selectedCategories, selectedRatings]);

  // 造訪追蹤
  useEffect(() => {
    fetch("/api/track-visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pathname: window.location.pathname }),
    }).catch(() => {});
  }, []);

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-4">
      {currentUser?.isAdmin && (
        <div className="mb-4">
          <AdminPanel />
        </div>
      )}

      {/* 工具列：只保留排序（篩選面板在 Header） */}
      <div className="max-w-6xl mx-auto mb-3 flex items-center justify-end">
        <SortSelect value={sort} onChange={setSort} />
      </div>

      <ImageGrid
        images={images}
        viewMode={viewMode} // "default" = 常駐標題；"compact" = hover 顯示
        isLoading={isLoading}
        hasMore={hasMore}
        onSelectImage={async (img) => {
          const enriched = await ensureUserOnImage(img);
          setSelectedImage(enriched);
          if (enriched?._id) reportClick(enriched._id);
        }}
        loadMoreRef={loadMoreRef}
        currentUser={currentUser}
        isLikedByCurrentUser={isLikedByCurrentUser}
        onToggleLike={handleToggleLike}
        onLikeUpdate={(updated) => {
          onLikeUpdateHook(updated);
        }}
      />

      <div ref={loadMoreRef} className="py-6 text-center text-zinc-400 text-sm">
        {hasMore ? "載入更多中..." : "已經到底囉"}
      </div>

      {selectedImage && currentUser !== undefined && (
        <ImageModal
          key={selectedImage?._id + "_" + selectedImage?._forceSync}
          imageData={selectedImage}
          onClose={() => {
            setSelectedImage(null);
            const q = (searchParams.get("search") || "").trim();
            fetchImages(1, q, selectedCategories, selectedRatings);
            setPage(1);
          }}
          currentUser={currentUser}
          onLikeUpdate={(updated) => {
            onLikeUpdateHook(updated);
          }}
        />
      )}

      <BackToTopButton />
    </main>
  );
}
