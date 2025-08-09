"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import ImageModal from "@/components/image/ImageModal";
import { useRouter, useSearchParams } from "next/navigation";
import ImageGrid from "@/components/image/ImageGrid";
import AdminPanel from "@/components/homepage/AdminPanel";
import BackToTopButton from "@/components/common/BackToTopButton";
import { useFilterContext, labelToRating } from "@/components/context/FilterContext";
import useLikeHandler from "@/hooks/useLikeHandler";

export default function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [likeUpdateTrigger, setLikeUpdateTrigger] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

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

  const fetchImages = async (pageToFetch = 1) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/cloudflare-images?page=${pageToFetch}&limit=20`);
      const data = await res.json();

      if (res.ok && Array.isArray(data.images)) {
        const newImages = data.images;
        if (pageToFetch === 1) {
          setImages(newImages);
        } else {
          setImages((prev) => {
            const existingIds = new Set(prev.map((img) => img._id));
            const uniqueNewImages = newImages.filter((img) => !existingIds.has(img._id));
            return [...prev, ...uniqueNewImages];
          });
        }
        setHasMore(pageToFetch < data.totalPages);
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
  // 規則：
  // 1) 首次進來：抓一次列表，但「不重置篩選」（刷新也要保留）
  // 2) search 清空：重抓首頁列表；只有當 sessionStorage.homepageReset === "1" 才 resetFilters（點 Logo）
  // 3) 有關鍵字：不重抓，用前端過濾
  useEffect(() => {
    const val = (searchParams.get("search") || "").trim();
    const byLogo = sessionStorage.getItem("homepageReset") === "1";

    console.log("[HOME] effect hit:", { val, last: lastUrlSearchRef.current, fetchedOnce: fetchedOnceRef.current, byLogo });

    // 若 search 值沒變，但這次是點 Logo（有旗標），仍要執行清篩選
    if (val === lastUrlSearchRef.current && fetchedOnceRef.current) {
      if (byLogo && val === "") {
        console.log("[HOME] reset by logo (early-return branch)");
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
      fetchImages(1);      // 首次必抓一次列表
      setPage(1);
      return;              // 🔸 不在首次做 resetFilters —— 刷新需保留篩選
    }

    if (val === "") {
      // 清空搜尋：回首頁列表
      fetchImages(1);

      // 只有按 Logo（Header 會寫入這個旗標）才清篩選
      if (byLogo) {
        resetFilters();
        sessionStorage.removeItem("homepageReset");
        setLikeUpdateTrigger((n) => n + 1);
        setSearchKeyReset((n) => n + 1);
      }
    } else {
      // 有關鍵字：使用前端 filter，不重抓
      setPage(1);
    }
  }, [searchParams, resetFilters]);

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

  // 無限滾動
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
  }, [hasMore, isLoading, page]);

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

      <ImageGrid
        images={filteredImages}
        viewMode={viewMode}
        isLoading={isLoading}
        hasMore={hasMore}
        onSelectImage={setSelectedImage}
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
          onClose={() => setSelectedImage(null)}
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
