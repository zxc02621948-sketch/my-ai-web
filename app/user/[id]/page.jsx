"use client";

import Header from "@/components/common/Header";
import React, { useEffect, useState, useMemo, useCallback } from "react";
import axios from "axios";
import { useParams } from "next/navigation";
import { getTokenFromCookie } from "@/lib/cookie";
import ImageModal from "@/components/image/ImageModal";
import UserHeader from "@/components/user/UserHeader";
import UserImageGrid from "@/components/user/UserImageGrid";
import UserModals from "@/components/user/UserModals";
import UserEditModal from "@/components/user/UserEditModal";

export default function UserProfilePage() {
  const { id } = useParams();

  const [currentUser, setCurrentUser] = useState(undefined);
  const [userData, setUserData] = useState(null);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [likedImages, setLikedImages] = useState([]);
  const [activeTab, setActiveTab] = useState("uploads");
  const [selectedImage, setSelectedImage] = useState(null);
  const [isUploadOpen, setUploadOpen] = useState(false);
  const [isLoginOpen, setLoginOpen] = useState(false);
  const [isRegisterOpen, setRegisterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [levelFilters, setLevelFilters] = useState([]);
  const [categoryFilters, setCategoryFilters] = useState([]);
  const [viewMode, setViewMode] = useState("default");
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [isEditModalOpen, setEditModalOpen] = useState(false); // ✅ 加這行
  const [avatarFile, setAvatarFile] = useState(null);

  const handleSearch = useCallback((q) => {
    setSearchQuery(q);
  }, []);

  const isOwnProfile = currentUser && (currentUser._id === id || currentUser.id === id);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const res = await axios.get("/api/current-user");
        setCurrentUser(res.data);
      } catch (err) {
        if (err.response?.status === 401) {
          setCurrentUser(null);
        } else {
          console.error("⚠️ 無法取得登入使用者", err);
          setCurrentUser(null);
        }
      }
    };
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    const handler = () => setFilterMenuOpen((prev) => !prev);
    document.addEventListener("toggle-filter-panel", handler);
    return () => document.removeEventListener("toggle-filter-panel", handler);
  }, []);

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
    const base = activeTab === "uploads" ? uploadedImages : likedImages;
    return base.filter((img) => {
      const rating = typeof img.rating === "string" ? img.rating : "all";
      const matchLevel =
        (levelFilters.length === 0 && rating !== "18") ||
        (levelFilters.includes("一般圖片") && rating === "all") ||
        (levelFilters.includes("15+ 圖片") && rating === "15") ||
        (levelFilters.includes("18+ 圖片") && rating === "18");

      const safeCategory = typeof img.category === "string" ? img.category : "";
      const matchCategory = categoryFilters.length === 0 || categoryFilters.includes(safeCategory);

      const safeTitle = typeof img.title === "string" ? img.title.toLowerCase() : "";
      const keyword = searchQuery.toLowerCase().trim();
      const matchSearch = keyword === "" || safeTitle.includes(keyword);

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
        list.map((img) => (img._id === updatedImage._id ? { ...img, likes: updatedImage.likes } : img));
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

  const handleToggleLevelFilter = (label) => {
    if (label === "18+ 圖片" && currentUser === null) {
      alert("請先登入才能查看 18+ 圖片");
      return;
    }
    setLevelFilters((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  const handleToggleCategoryFilter = (label) => {
    setCategoryFilters((prev) =>
      prev.includes(label) ? prev.filter((c) => c !== label) : [...prev, label]
    );
  };

  if (!userData) {
    return <div className="text-white p-4">載入中...</div>;
  }

  return (
    <>
      <Header
        currentUser={currentUser}
        onLogout={async () => {
          try {
            await axios.get("/api/auth/logout");
            location.reload();
          } catch (err) {
            console.error("❌ 登出失敗", err);
          }
        }}
        onLoginOpen={() => setLoginOpen(true)}
        onRegisterOpen={() => setRegisterOpen(true)}
        onUploadClick={() => setUploadOpen(true)}
        onGuideClick={() => window.open("/install-guide", "_blank")}
        onSearch={handleSearch}
        onFilterToggle={() => setFilterMenuOpen((prev) => !prev)}
        showFilterButton={true}
        isUserPage={true}
        toggleLevelFilter={handleToggleLevelFilter}
        toggleCategoryFilter={handleToggleCategoryFilter}
        levelFilters={levelFilters}
        categoryFilters={categoryFilters}
      />

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
          onEditOpen={() => setEditModalOpen(true)} // ✅ 加這行
        />

        <div className="flex gap-4 mb-6">
          <button
            className={`px-4 py-2 rounded ${activeTab === "uploads" ? "bg-white text-black" : "bg-zinc-700 text-white"}`}
            onClick={() => setActiveTab("uploads")}
          >
            上傳作品
          </button>
          <button
            className={`px-4 py-2 rounded ${activeTab === "likes" ? "bg-white text-black" : "bg-zinc-700 text-white"}`}
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

        <UserModals
          currentUser={currentUser}
          isUploadOpen={isUploadOpen}
          onUploadClose={() => setUploadOpen(false)}
          isLoginOpen={isLoginOpen}
          onLoginClose={() => setLoginOpen(false)}
          isRegisterOpen={isRegisterOpen}
          onRegisterClose={() => setRegisterOpen(false)}
        />
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
