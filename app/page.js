"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import UploadModal from "@/components/upload/UploadModal";
import ImageModal from "@/components/image/ImageModal";
import LoginModal from "@/components/auth/LoginModal";
import RegisterModal from "@/components/auth/RegisterModal";
import { useRouter, useSearchParams } from "next/navigation";
import { jwtDecode } from "jwt-decode";
import Header from "@/components/common/Header";
import FilterPanel from "@/components/common/FilterPanel";
import ImageGrid from "@/components/image/ImageGrid";
import AdminPanel from "@/components/homepage/AdminPanel";
import BackToTopButton from "@/components/common/BackToTopButton";
import axios from "axios";

function getTokenFromCookie() {
  const match = document.cookie.match(/token=([^;]+)/);
  return match ? match[1] : "";
}

export default function HomePage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [levelFilters, setLevelFilters] = useState([]);
  const [categoryFilters, setCategoryFilters] = useState([]);
  const [viewMode, setViewMode] = useState("default");
  const [search, setSearch] = useState("");
  const [images, setImages] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showProcessingCard, setShowProcessingCard] = useState(false);
  const [currentUser, setCurrentUser] = useState(undefined);
  const [suggestions, setSuggestions] = useState([]);
  const loadMoreRef = useRef(null);
  const searchParams = useSearchParams();
  const searchFromUrl = searchParams.get("q");

  useEffect(() => {
    if (searchFromUrl && typeof searchFromUrl === "string") {
      setSearch(searchFromUrl);
    }
  }, [searchFromUrl]);

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
          setImages((prev) => [...prev, ...newImages]);
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

  const handleToggleLike = async (imageId) => {
    try {
      const token = getTokenFromCookie();
      const res = await axios.put(
        `/api/like-image?id=${imageId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const updatedImage = res.data;
      setImages((prevImages) =>
        prevImages.map((img) =>
          img._id === updatedImage._id ? { ...img, likes: updatedImage.likes } : img
        )
      );
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
    fetchImages();
    fetchCurrentUser();
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

  const toggleLevelFilter = (label) => {
    if (label === "18+ 圖片" && currentUser === null) {
      alert("請先登入才能查看 18+ 圖片");
      return;
    }
    setLevelFilters((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  const toggleCategoryFilter = (label) => {
    setCategoryFilters((prev) =>
      prev.includes(label) ? prev.filter((c) => c !== label) : [...prev, label]
    );
  };

  const handleLogout = () => {
    document.cookie = "token=; path=/; max-age=0";
    setCurrentUser(null);
    alert("您已登出");
    location.reload();
  };

  const filteredImages = useMemo(() => {
    return images.filter((img) => {
      const rating = typeof img.rating === "string" ? img.rating : "all";
      const matchLevel =
        (levelFilters.length === 0 && rating !== "18") || 
        (levelFilters.includes("一般圖片") && rating === "all") ||
        (levelFilters.includes("15+ 圖片") && rating === "15") ||
        (levelFilters.includes("18+ 圖片") && rating === "18");
      const safeCategory = typeof img.category === "string" ? img.category : "";
      const matchCategory = categoryFilters.length === 0 || categoryFilters.includes(safeCategory);
      const safeTitle = typeof img.title === "string" ? img.title.toLowerCase() : "";
      const safeAuthor = typeof img.author === "string" ? img.author.toLowerCase() : "";
      const tagsArray = Array.isArray(img.tags) ? img.tags.map((t) => t.toLowerCase()) : [];
      const keyword = search.toLowerCase().trim();
      const matchSearch =
        keyword === "" ||
        safeTitle.includes(keyword) ||
        safeAuthor.includes(keyword) ||
        tagsArray.some((tag) => tag.includes(keyword));
      return matchLevel && matchCategory && matchSearch;
    });
  }, [images, levelFilters, categoryFilters, search]);
  console.log("🐞 currentUser:", currentUser);
  return (
    <main className="min-h-screen bg-zinc-950 text-white p-4">
      <Header
        currentUser={currentUser}
        onSearch={(q) => setSearch(q)}
        onLogout={handleLogout}
        onLoginOpen={() => setIsLoginOpen(true)}
        onRegisterOpen={() => setIsRegisterOpen(true)}
        suggestions={suggestions}
        onUploadClick={() => setIsModalOpen(true)}
        onGuideClick={() => router.push("/install-guide")}
        showFilterButton={true}
        levelFilters={levelFilters}
        categoryFilters={categoryFilters}
        viewMode={viewMode}
        toggleLevelFilter={toggleLevelFilter}
        toggleCategoryFilter={toggleCategoryFilter}
        setViewMode={setViewMode}
      />

      {currentUser?.isAdmin && (
        <div className="mb-4">
          <AdminPanel />
        </div>
      )}

      <ImageGrid
        filteredImages={filteredImages}
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

      <BackToTopButton />
      <UploadModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onUpload={() => fetchImages(1)} />
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} onSuccess={fetchCurrentUser} />
      <RegisterModal isOpen={isRegisterOpen} onClose={() => setIsRegisterOpen(false)} onSuccess={fetchCurrentUser} />

      {selectedImage && currentUser !== undefined && (
        <ImageModal
          key={selectedImage?._id}
          image={selectedImage}
          onClose={() => setSelectedImage(null)}
          currentUser={currentUser}
          isLikedByCurrentUser={isLikedByCurrentUser}
          onToggleLike={handleToggleLike}
        />
      )}
    </main>
  );
}
