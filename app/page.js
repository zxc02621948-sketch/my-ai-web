"use client";

import { useEffect, useState, useMemo, useRef, Suspense } from "react";
import ImageModal from "@/components/image/ImageModal";
import { useRouter } from "next/navigation";
import { jwtDecode } from "jwt-decode";
import FilterPanel from "@/components/common/FilterPanel";
import ImageGrid from "@/components/image/ImageGrid";
import AdminPanel from "@/components/homepage/AdminPanel";
import BackToTopButton from "@/components/common/BackToTopButton";
import axios from "axios";
import SearchParamsProvider from "@/components/homepage/SearchParamsProvider";
import NotificationBell from "@/components/common/NotificationBell";
import { useFilterContext, labelToRating } from "@/components/context/FilterContext";

function getTokenFromCookie() {
  const match = document.cookie.match(/token=([^;]+)/);
  return match ? match[1] : "";
}

export default function HomePage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [likeUpdateTrigger, setLikeUpdateTrigger] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [images, setImages] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showProcessingCard, setShowProcessingCard] = useState(false);
  const [currentUser, setCurrentUser] = useState(undefined);
  const [suggestions, setSuggestions] = useState([]);
  const [searchKeyReset, setSearchKeyReset] = useState(0);
  const loadMoreRef = useRef(null);

  const {
    levelFilters,
    toggleLevelFilter,
    categoryFilters,
    toggleCategoryFilter,
    viewMode,
    setViewMode,
    resetFilters, // ✅ 加這一行
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
        const allStrings = newImages.flatMap((img) => [
          img.title ?? "",
          img.author ?? "",
          ...(Array.isArray(img.tags) ? img.tags : []),
        ]);
        setSuggestions((prev) => {
          const set = new Set([...prev, ...allStrings.map((s) => s.trim()).filter(Boolean)]);
          return Array.from(set);
        });
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
    } catch (err) {
      console.warn("⚠️ 無法取得使用者資訊", err);
      setCurrentUser(null);
    }
  };

  const handleToggleLike = async (imageId, shouldLike) => {
    try {
      const token = getTokenFromCookie();
      const res = await axios.put(
        `/api/like-image?id=${imageId}`,
        { shouldLike }, // ✅ 傳最後狀態
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const updatedImage = res.data;

      setImages((prevImages) => {
        const newImages = prevImages.map((img) =>
          img._id === updatedImage._id
            ? { ...img, likes: updatedImage.likes }
            : img
        );
        return [...newImages];
      });

      if (selectedImage?._id === updatedImage._id) {
        setSelectedImage((prev) => ({ ...prev, likes: updatedImage.likes }));
      }
    } catch (error) {
      console.error("❌ 更新愛心失敗", error.response?.data || error.message);
      alert("更新愛心失敗：" + (error.response?.data?.message || "未知錯誤"));
    }
  };

  const isLikedByCurrentUser = (img) => {
    if (!currentUser || !img.likes) return false;
    const userId = currentUser._id || currentUser.id;
    return img.likes.includes(userId);
  };

  useEffect(() => {
    const handleGlobalSearch = (e) => {
      const keyword = e.detail?.keyword ?? "";
      setSearch(keyword);
      setSearchKeyReset((n) => n + 1);
    };

    window.addEventListener("global-search", handleGlobalSearch);
    return () => window.removeEventListener("global-search", handleGlobalSearch);
  }, []);

  useEffect(() => {
    fetchImages();
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    const handleHomepageReset = () => {
      setSearch("");
      fetchImages(1);
      setLikeUpdateTrigger((n) => n + 1);
      setSearchKeyReset((n) => n + 1);
      resetFilters(); // ✅ 要加這一行才會清空篩選
    };

    window.addEventListener("reset-homepage", handleHomepageReset);
    return () => {
      window.removeEventListener("reset-homepage", handleHomepageReset);
    };
  }, []);

  useEffect(() => {
    const handleImageLiked = (event) => {
      const updatedImage = event.detail;
      setImages((prevImages) =>
        prevImages.map((img) =>
          img._id === updatedImage._id ? { ...img, likes: updatedImage.likes } : img
        )
      );
    };

    window.addEventListener("image-liked", handleImageLiked);
    return () => {
      window.removeEventListener("image-liked", handleImageLiked);
    };
  }, []);

  useEffect(() => {
    fetch("/api/track-visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pathname: window.location.pathname }),
    }).catch((err) => {
      console.warn("⚠️ 訪問紀錄上傳失敗", err);
    });
  }, []);

  useEffect(() => {
    if (!hasMore || isLoading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchImages(page + 1);
        }
      },
      { root: null, rootMargin: "0px", threshold: 1.0 }
    );
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => {
      if (loadMoreRef.current) observer.unobserve(loadMoreRef.current);
    };
  }, [hasMore, isLoading, page]);

  const handleLogout = () => {
    document.cookie = "token=; path=/; max-age=0";
    setCurrentUser(null);
    alert("您已登出");
    location.reload();
  };

  const filteredImages = useMemo(() => {
    if (!Array.isArray(images)) return [];

    const keyword = search.trim().toLowerCase();
    const selectedRatings = levelFilters.map((label) => labelToRating[label]);

    return images.filter((img) => {
      const rating = img.rating || "all";
      const matchLevel =
        selectedRatings.length === 0
          ? rating !== "18" // 預設不顯示 18+
          : selectedRatings.includes(rating);

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
      <Suspense fallback={null}>
        <SearchParamsProvider
          onSearchChange={(val) => {
            const keyword = val.trim();
            setSearch(keyword);

            const urlSearchParams = new URLSearchParams(window.location.search);
            const hasSearchQuery = urlSearchParams.has("search");

            if (keyword === "" && window.location.pathname === "/") {

              fetchImages(1);
              setLikeUpdateTrigger((n) => n + 1);
              setSearchKeyReset((n) => n + 1);
              resetFilters(); // ✅ 重設篩選條件
            }
          }}
        />
      </Suspense>

      {currentUser?.isAdmin && (
        <div className="mb-4">
          <AdminPanel />
        </div>
      )}

      <ImageGrid
        images={filteredImages}
        viewMode={viewMode}
        showProcessingCard={showProcessingCard}
        isLoading={isLoading}
        hasMore={hasMore}
        onSelectImage={setSelectedImage}
        loadMoreRef={loadMoreRef}
        currentUser={currentUser}
        isLikedByCurrentUser={isLikedByCurrentUser}
        onToggleLike={handleToggleLike}
      />

      <div ref={loadMoreRef} className="py-6 text-center text-zinc-400 text-sm">
        {hasMore ? "載入更多中..." : "已經到底囉"}
      </div>

      {selectedImage && currentUser !== undefined && (
        <ImageModal
          key={selectedImage?._id + "_" + selectedImage?._forceSync}
          imageData={selectedImage} // ✅ 傳整個物件進去
          onClose={() => setSelectedImage(null)}
          currentUser={currentUser}
          onLikeUpdate={(updated) => {
            setImages((prev) =>
              prev.map((img) => (img._id === updated._id ? updated : img))
            );
            setSelectedImage(updated); // ✅ 也更新 selectedImage 自身
            setLikeUpdateTrigger((n) => n + 1);
          }}
        />
      )}
      <BackToTopButton />
    </main>
  );
}
