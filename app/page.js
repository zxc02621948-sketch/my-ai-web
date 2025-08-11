"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import ImageModal from "@/components/image/ImageModal";
import { useRouter, useSearchParams } from "next/navigation";
import ImageGrid from "@/components/image/ImageGrid";
import AdminPanel from "@/components/homepage/AdminPanel";
import BackToTopButton from "@/components/common/BackToTopButton";
import { useFilterContext, labelToRating } from "@/components/context/FilterContext";
import useLikeHandler from "@/hooks/useLikeHandler";
import SortSelect from "@/components/common/SortSelect";

export default function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const PAGE_SIZE = 20; // 與 API 的 limit 對齊

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [likeUpdateTrigger, setLikeUpdateTrigger] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // ✅ 排序（預設：popular 加權分數）
  const [sort, setSort] = useState("popular");

  // ✅ 搜尋字由 URL 主導（唯一資料源）
  const [search, setSearch] = useState("");
  const lastUrlSearchRef = useRef(null);
  const fetchedOnceRef = useRef(false); // ✅ 首次載入已抓

  const [images, setImages] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [currentUser, setCurrentUser] = useState(undefined);
  const [searchKeyReset, setSearchKeyReset] = useState(0);
  const loadMoreRef = useRef(null);

  const {
    levelFilters,
    categoryFilters,
    viewMode,
    setViewMode,
    resetFilters,
  } = useFilterContext();

  // --- 點擊回報（打開大圖就 +1），含 30 秒本地節流，避免灌水 ---
  const reportClick = (id) => {
    if (!id) return;
    const key = `click:${id}`;
    const now = Date.now();
    const last = Number(localStorage.getItem(key) || 0);
    if (now - last < 30 * 1000) return; // 30 秒內同一張不重複回報
    localStorage.setItem(key, String(now));
    fetch(`/api/images/${id}/click`, { method: "POST" }).catch(() => {});
  };

  const fetchImages = async (pageToFetch = 1) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(pageToFetch),
        limit: String(PAGE_SIZE),
        sort, // 🔹 帶入排序
      });
      const res = await fetch(`/api/images?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();

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
        // 沒有 totalPages 時，用回傳數量判定是否還有下一頁
        setHasMore(newImages.length >= PAGE_SIZE);
        setPage(pageToFetch);
      } else {
        console.warn("資料格式錯誤", data);
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

  // 共用愛心 hook
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

  // ✅ URL -> search（唯一資料源）
  // 首次載入抓一次列表；清空搜尋回首頁；有關鍵字時用前端 filter。
  useEffect(() => {
    const val = (searchParams.get("search") || "").trim();
    const byLogo = sessionStorage.getItem("homepageReset") === "1";

    if (val === lastUrlSearchRef.current && fetchedOnceRef.current) {
      if (byLogo && val === "") {
        fetchImages(1);
        resetFilters();
        sessionStorage.removeItem("homepageReset");
        setLikeUpdateTrigger((n) => n + 1);
        setSearchKeyReset((n) => n + 1);
      }
      return;
    }

    lastUrlSearchRef.current = val;
    setSearch(val);

    if (!fetchedOnceRef.current) {
      fetchedOnceRef.current = true;
      fetchImages(1); // 首次必抓一次列表
      setPage(1);
      return; // 🔸 不在首次做 resetFilters —— 刷新需保留篩選
    }

    if (val === "") {
      fetchImages(1);
      if (byLogo) {
        resetFilters();
        sessionStorage.removeItem("homepageReset");
        setLikeUpdateTrigger((n) => n + 1);
        setSearchKeyReset((n) => n + 1);
      }
    } else {
      setPage(1); // 有關鍵字：使用前端 filter，不重抓
    }
  }, [searchParams, resetFilters]);

  // ✅ 切換排序時：重抓第一頁
  useEffect(() => {
    if (!fetchedOnceRef.current) return;
    fetchImages(1);
    setPage(1);
  }, [sort]);

  // ✅ 只抓使用者（避免與上面 effect 同時抓圖）
  useEffect(() => {
    fetchCurrentUser();
  }, []);

  // 訪問紀錄（非關鍵）
  useEffect(() => {
    fetch("/api/track-visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pathname: window.location.pathname }),
    }).catch(() => {});
  }, []);

  // 🔔 後台編輯後就地同步首頁清單 & 已開啟的大圖
  useEffect(() => {
    const onImageUpdated = (e) => {
      const updated = e.detail?.image;
      if (!updated?._id) return;

      // 替換列表同 ID 的圖片資料
      setImages((prev) =>
        prev.map((it) => (String(it._id) === String(updated._id) ? { ...it, ...updated } : it))
      );

      // 若大圖正打開同一張，也一併同步
      setSelectedImage((prev) =>
        prev?._id && String(prev._id) === String(updated._id) ? { ...prev, ...updated } : prev
      );
    };

    window.addEventListener("image-updated", onImageUpdated);
    return () => window.removeEventListener("image-updated", onImageUpdated);
  }, []);

  // 無限滾動：保持同一排序下的續頁
  useEffect(() => {
    if (!hasMore || isLoading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) fetchImages(page + 1);
      },
      { root: null, rootMargin: "0px", threshold: 1.0 }
    );
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => {
      if (loadMoreRef.current) observer.unobserve(loadMoreRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, isLoading, page, sort]);

  const filteredImages = useMemo(() => {
    if (!Array.isArray(images)) return [];
    const keyword = search.trim().toLowerCase();
    const selectedRatings = levelFilters.map((label) => labelToRating[label]);

    return images.filter((img) => {
      const rating = img.rating || "all";
      const matchLevel =
        selectedRatings.length === 0 ? rating !== "18" : selectedRatings.includes(rating);

      const matchCategory =
        categoryFilters.length === 0 || categoryFilters.includes(img.category);

      const matchSearch =
        keyword === "" ||
        (img.title?.toLowerCase() || "").includes(keyword) ||
        (img.user?.username?.toLowerCase() || "").includes(keyword) ||
        (Array.isArray(img.tags)
          ? img.tags.some((tag) => tag.toLowerCase().includes(keyword))
          : false);

      return matchLevel && matchCategory && matchSearch;
    });
  }, [images, levelFilters, categoryFilters, search, likeUpdateTrigger, searchKeyReset]);

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-4">
      {currentUser?.isAdmin && (
        <div className="mb-4">
          <AdminPanel />
        </div>
      )}

      {/* 排序選單 */}
      <div className="max-w-6xl mx-auto mb-3 flex items-center justify-end">
        <SortSelect value={sort} onChange={setSort} />
      </div>

      <ImageGrid
        images={filteredImages}
        viewMode={viewMode}
        isLoading={isLoading}
        hasMore={hasMore}
        onSelectImage={(img) => {
          setSelectedImage(img);
          if (img?._id) reportClick(img._id); // 👈 打開大圖就回報點擊
        }}
        loadMoreRef={loadMoreRef}
        currentUser={currentUser}
        isLikedByCurrentUser={isLikedByCurrentUser}
        onToggleLike={handleToggleLike}
        onLikeUpdate={(updated) => {
          onLikeUpdateHook(updated);
          setLikeUpdateTrigger((n) => n + 1);
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
            // 為了測試「熱門」排序的即時感受：關閉大圖時重抓首頁
            fetchImages(1);
            setPage(1);
          }}
          currentUser={currentUser}
          onLikeUpdate={(updated) => {
            onLikeUpdateHook(updated);
            setLikeUpdateTrigger((n) => n + 1);
          }}
        />
      )}
      <BackToTopButton />
    </main>
  );
}
