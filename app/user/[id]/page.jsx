"use client";

import React, { useEffect, useState, useMemo, Suspense } from "react";
import axios from "axios";
import { useParams, useSearchParams } from "next/navigation";
import { getTokenFromCookie } from "@/lib/cookie";
import ImageModal from "@/components/image/ImageModal";
import UserHeader from "@/components/user/UserHeader";
import UserImageGrid from "@/components/user/UserImageGrid";
import UserEditModal from "@/components/user/UserEditModal";
import SearchParamsProvider from "@/components/homepage/SearchParamsProvider";
import { useFilterContext } from "@/components/context/FilterContext";

const labelToRating = {
  "一般圖片": "all",
  "15+ 圖片": "15",
  "18+ 圖片": "18",
};

export default function UserProfilePage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const {
    levelFilters,
    categoryFilters,
    toggleLevelFilter,
    toggleCategoryFilter,
    viewMode,
    setViewMode,
    filterMenuOpen,
    setFilterMenuOpen,
  } = useFilterContext();

  const [currentUser, setCurrentUser] = useState(undefined);
  const [userData, setUserData] = useState(null);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [likedImages, setLikedImages] = useState([]);
  const [activeTab, setActiveTab] = useState("uploads");
  const [selectedImage, setSelectedImage] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);

  const isOwnProfile = currentUser && (currentUser._id === id || currentUser.id === id);

  useEffect(() => {
    const q = searchParams.get("q")?.trim() || "";
    setSearchQuery(q);
  }, [searchParams]);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const res = await axios.get("/api/current-user");
        setCurrentUser(res.data);
      } catch {
        setCurrentUser(null);
      }
    };
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    const handler = () => setFilterMenuOpen((prev) => !prev);
    document.addEventListener("toggle-filter-panel", handler);
    return () => document.removeEventListener("toggle-filter-panel", handler);
  }, [setFilterMenuOpen]);

  useEffect(() => {
    if (!id || id === "undefined") return;
    const fetchData = async () => {
      try {
        const token = getTokenFromCookie();
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const [userRes, uploadsRes, likesRes] = await Promise.all([
          axios.get(`/api/user-info?id=${id}`, { headers }),
          axios.get(`/api/user-images?id=${id}`, { headers }),
          axios.get(`/api/user-liked-images?id=${id}`, { headers }),
        ]);
        setUserData(userRes.data);
        setUploadedImages(uploadsRes.data);
        setLikedImages(likesRes.data);
      } catch (err) {
        console.error("❌ 讀取用戶資料失敗", err);
      }
    };
    fetchData();
  }, [id]);

  const filteredImages = useMemo(() => {
    const selectedRatings = levelFilters.map((label) => labelToRating[label]);
    const base = activeTab === "uploads" ? uploadedImages : likedImages;

    return base.filter((img) => {
      const rating = img.rating || "all";
      const matchLevel =
        selectedRatings.length === 0
          ? rating !== "18"
          : selectedRatings.includes(rating);

      const matchCategory =
        categoryFilters.length === 0 || categoryFilters.includes(img.category);

      const keyword = searchQuery.toLowerCase().trim();
      const matchSearch =
        keyword === "" ||
        (img.title?.toLowerCase() || "").includes(keyword) ||
        (img.user?.username?.toLowerCase() || "").includes(keyword) ||
        (Array.isArray(img.tags)
          ? img.tags.some((tag) => tag.toLowerCase().includes(keyword))
          : false);

      return matchLevel && matchCategory && matchSearch;
    });
  }, [activeTab, uploadedImages, likedImages, levelFilters, categoryFilters, searchQuery]);

  const handleToggleLike = async (imageId) => {
    try {
      const token = getTokenFromCookie();
      const res = await axios.put(
        `/api/like-image?id=${imageId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const updatedImage = res.data;
      const updateList = (list) =>
        list.map((img) =>
          img._id === updatedImage._id ? { ...img, likes: updatedImage.likes } : img
        );
      setUploadedImages((prev) => updateList(prev));
      setLikedImages((prev) => updateList(prev));
      if (selectedImage?._id === updatedImage._id) {
        setSelectedImage({ ...selectedImage, likes: [...updatedImage.likes] });
      }
    } catch (err) {
      console.error("點愛心失敗", err);
    }
  };

  const isLikedByCurrentUser = (image) => image.likes?.includes(currentUser?._id);

  const handleToggleLevelFilter = (label) => {
    if (label === "18+ 圖片" && currentUser === null) {
      alert("請先登入才能查看 18+ 圖片");
      return;
    }
    toggleLevelFilter(label);
  };

  const handleToggleCategoryFilter = (label) => {
    toggleCategoryFilter(label);
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleUploadAvatar = async () => {
    if (!avatarFile) return;
    try {
      const formData = new FormData();
      formData.append("file", avatarFile);
      const res = await axios.post(`/api/upload-avatar?id=${id}`, formData);
      setUserData((prev) => ({ ...prev, image: res.data.image }));
      setIsAvatarModalOpen(false);
    } catch (err) {
      console.error("上傳頭貼失敗", err);
    }
  };

  if (!userData) {
    return <div className="text-white p-4">載入中...</div>;
  }

  return (
    <>
      <Suspense fallback={null}>
        <SearchParamsProvider
          onSearchChange={(val) => {
            setSearchQuery(val);
          }}
        />
      </Suspense>

      <main className="min-h-screen bg-zinc-950 text-white p-4 mt-[80px]">
        <UserHeader
          userData={userData}
          currentUser={currentUser}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onAvatarClick={() => setIsAvatarModalOpen(true)}
          onUpdate={() => {
            axios.get(`/api/user-info?id=${id}`).then((res) => {
              setUserData(res.data);
            });
          }}
          onEditOpen={() => setEditModalOpen(true)}
        />

        <div className="flex gap-4 mb-6">
          <button
            className={`px-4 py-2 rounded ${
              activeTab === "uploads"
                ? "bg-white text-black"
                : "bg-zinc-700 text-white"
            }`}
            onClick={() => setActiveTab("uploads")}
          >
            上傳作品
          </button>
          <button
            className={`px-4 py-2 rounded ${
              activeTab === "likes"
                ? "bg-white text-black"
                : "bg-zinc-700 text-white"
            }`}
            onClick={() => setActiveTab("likes")}
          >
            ❤️ 收藏圖片
          </button>
        </div>

        {filterMenuOpen && (
          <div className="mb-4">
            <p className="text-sm text-gray-400">篩選中...</p>
          </div>
        )}

        <UserImageGrid
          images={filteredImages}
          currentUser={currentUser}
          onToggleLike={handleToggleLike}
          onSelectImage={setSelectedImage}
          isLikedByCurrentUser={isLikedByCurrentUser}
          viewMode={viewMode}
        />

        {selectedImage && (
          <ImageModal
            imageId={selectedImage._id}
            currentUser={currentUser}
            isLikedByCurrentUser={isLikedByCurrentUser}
            onToggleLike={handleToggleLike}
            onClose={() => setSelectedImage(null)}
          />
        )}
      </main>

      <UserEditModal
        isOpen={isEditModalOpen}
        onClose={() => setEditModalOpen(false)}
        currentUser={currentUser}
        onUpdate={(updated) => {
          setUserData((prev) => ({ ...prev, ...updated }));
        }}
      />
    </>
  );
}