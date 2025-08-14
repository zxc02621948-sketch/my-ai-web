"use client";

import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import ImageModal from "@/components/image/ImageModal";
import UserHeader from "@/components/user/UserHeader";
import UserImageGrid from "@/components/user/UserImageGrid";
import UserEditModal from "@/components/user/UserEditModal";
import { useFilterContext } from "@/components/context/FilterContext";
import useLikeHandler from "@/hooks/useLikeHandler";

const labelToRating = {
  "一般圖片": "all",
  "15+ 圖片": "15",
  "18+ 圖片": "18",
};

export default function UserProfilePage() {
  const { id } = useParams();
  const params = useSearchParams();
  const router = useRouter();

  const {
    levelFilters,
    categoryFilters,
    viewMode,
    filterMenuOpen,
    setFilterMenuOpen,
  } = useFilterContext();

  const [currentUser, setCurrentUser] = useState(undefined);
  const [userData, setUserData] = useState(null);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [likedImages, setLikedImages] = useState([]);

  // ✅ 從 URL 讀取目前分頁（預設 uploads）
  const [activeTab, setActiveTab] = useState(
    params.get("tab") === "likes" ? "likes" : "uploads"
  );

  const [selectedImage, setSelectedImage] = useState(null);
  const [isEditModalOpen, setEditModalOpen] = useState(false);

  // ✅ 讀 URL 的 search 當唯一資料源（就地搜尋）
  const [searchQuery, setSearchQuery] = useState("");
  useEffect(() => {
    setSearchQuery((params.get("search") || "").trim());
  }, [params]);

  // 分頁切換時把 tab 寫回 URL（保留既有的 search 等參數）
  useEffect(() => {
    const sp = new URLSearchParams(params.toString());
    if (activeTab === "likes") sp.set("tab", "likes");
    else sp.delete("tab");
    const href = `${window.location.pathname}${sp.toString() ? `?${sp.toString()}` : ""}`;
    router.replace(href);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // 🔔 編輯後就地同步個人頁（上傳/收藏清單 + 已開啟的大圖）
  useEffect(() => {
    const onImageUpdated = (e) => {
      const updated = e.detail?.image;
      if (!updated?._id) return;

      setUploadedImages((prev) =>
        prev.map((img) =>
          String(img._id) === String(updated._id) ? { ...img, ...updated } : img
        )
      );

      setLikedImages((prev) =>
        prev.map((img) =>
          String(img._id) === String(updated._id) ? { ...img, ...updated } : img
        )
      );

      setSelectedImage((prev) =>
        prev?._id && String(prev._id) === String(updated._id)
          ? { ...prev, ...updated }
          : prev
      );
    };

    window.addEventListener("image-updated", onImageUpdated);
    return () => window.removeEventListener("image-updated", onImageUpdated);
  }, []);

  const isOwnProfile =
    currentUser && (currentUser._id === id || currentUser.id === id);

  // 目前登入者
  useEffect(() => {
    axios
      .get("/api/current-user")
      .then((res) => setCurrentUser(res.data))
      .catch(() => setCurrentUser(null));
  }, []);

  // 篩選面板快捷事件（保留）
  useEffect(() => {
    const handler = () => setFilterMenuOpen((prev) => !prev);
    document.addEventListener("toggle-filter-panel", handler);
    return () => document.removeEventListener("toggle-filter-panel", handler);
  }, [setFilterMenuOpen]);

  // 讀取個人頁資料
  useEffect(() => {
    if (!id || id === "undefined") return;
    const fetchData = async () => {
      try {
        const [userRes, uploadsRes, likesRes] = await Promise.all([
          axios.get(`/api/user-info?id=${id}`),
          axios.get(`/api/user-images?id=${id}`),
          axios.get(`/api/user-liked-images?id=${id}`),
        ]);
        setUserData(userRes.data);
        setUploadedImages(uploadsRes.data || []);
        setLikedImages(likesRes.data || []);
      } catch (err) {
        console.error("❌ 讀取用戶資料失敗", err);
      }
    };
    fetchData();
  }, [id]);

  // 🔔 接收全域的「樂觀更新 - 讚」事件：同步兩個清單 & modal
  useEffect(() => {
    const handleImageLiked = (e) => {
      const updated = e.detail;
      const me = currentUser?._id || currentUser?.id;

      // 上傳清單：只同步 likes
      setUploadedImages((prev) =>
        prev.map((img) => (img._id === updated._id ? { ...img, likes: updated.likes } : img))
      );

      // 收藏清單：若已不再喜歡，移除；否則同步 likes
      setLikedImages((prev) => {
        const stillLiked = Array.isArray(updated.likes) && updated.likes.includes(me);
        return stillLiked
          ? prev.map((img) => (img._id === updated._id ? { ...img, likes: updated.likes } : img))
          : prev.filter((img) => img._id !== updated._id);
      });

      // modal 畫面一起同步
      setSelectedImage((prev) =>
        prev?._id === updated._id ? { ...prev, likes: updated.likes } : prev
      );
    };

    window.addEventListener("image-liked", handleImageLiked);
    return () => window.removeEventListener("image-liked", handleImageLiked);
  }, [currentUser]);

  // ⛓️ 接收全域的「追蹤狀態變更」事件：同步個人頁頭、清單與 modal（關鍵新增）
  useEffect(() => {
    const onFollowChanged = (e) => {
      const targetUserId = e?.detail?.targetUserId;
      const isFollowing = !!e?.detail?.isFollowing;
      if (!targetUserId) return;

      // 1) 若事件目標是此個人頁作者 → 立刻更新頭部按鈕狀態
      if (String(targetUserId) === String(id)) {
        setUserData((prev) => (prev ? { ...prev, isFollowing } : prev));
      }

      // 2) 更新目前登入者的 following 名單（就地同步，避免重整）
      setCurrentUser((prev) => {
        if (!prev) return prev;
        const meList = Array.isArray(prev.following) ? prev.following : [];
        const isObj = meList.some((f) => typeof f === "object" && f !== null);
        if (isFollowing) {
          // 已存在就不重覆加入
          const exists = meList.some((f) => {
            const idVal = typeof f === "object" && f !== null ? f.userId : f;
            return String(idVal) === String(targetUserId);
          });
          if (exists) return prev;
          const nextList = isObj ? [...meList, { userId: String(targetUserId), note: "" }] : [...meList, String(targetUserId)];
          return { ...prev, following: nextList };
        } else {
          const nextList = meList.filter((f) => {
            const idVal = typeof f === "object" && f !== null ? f.userId : f;
            return String(idVal) !== String(targetUserId);
          });
          return { ...prev, following: nextList };
        }
      });

      // 3) 同步清單中屬於該作者的圖片的 user.isFollowing（畫面一致）
      const patchUserFollowFlag = (img) => {
        const uid = typeof img?.user === "object" ? (img.user._id || img.user.id) : img?.user;
        if (uid && String(uid) === String(targetUserId)) {
          const userObj = typeof img.user === "object" ? img.user : { _id: uid };
          return { ...img, user: { ...userObj, isFollowing } };
        }
        return img;
      };
      setUploadedImages((prev) => prev.map(patchUserFollowFlag));
      setLikedImages((prev) => prev.map(patchUserFollowFlag));

      // 4) 若 modal 正顯示同一作者的圖片，也同步裡面的 user.isFollowing
      setSelectedImage((prev) => {
        if (!prev) return prev;
        const uid =
          typeof prev.user === "object" ? (prev.user._id || prev.user.id) : prev.user;
        if (uid && String(uid) === String(targetUserId)) {
          const userObj = typeof prev.user === "object" ? prev.user : { _id: uid };
          return { ...prev, user: { ...userObj, isFollowing } };
        }
        return prev;
      });
    };

    window.addEventListener("follow-changed", onFollowChanged);
    return () => window.removeEventListener("follow-changed", onFollowChanged);
  }, [id]);

  // 取完整圖片資訊並合併（模型/提示詞/生成參數等）
  const enrichImage = async (img) => {
    let full = img;
    try {
      // 1) 取完整 image
      const r = await axios.get(`/api/images/${img._id}`);
      const apiImage = r?.data?.image || r?.data; // 你的 /api 可能包在 {image}
      if (apiImage && apiImage._id) {
        full = { ...full, ...apiImage };
      }
      // 2) 作者資料不足時再補抓
      const authorId =
        typeof full.user === "string" ? full.user : full.user?._id || full.user?.id;
      if (authorId && (!full.user || !full.user.username)) {
        const u = await axios.get(`/api/user-info?id=${authorId}`);
        if (u?.data) full = { ...full, user: u.data };
      }
    } catch {
      // 靜默失敗，保留原資料
    }
    return full;
  };

  const handleSelectImage = async (img) => {
    const enriched = await enrichImage(img);
    setSelectedImage(enriched);
  };

  // 畫面用的過濾清單（左右滑手勢以這份陣列為準 → 與畫面一致）
  const filteredImages = useMemo(() => {
    const base = activeTab === "uploads" ? uploadedImages : likedImages;
    const keyword = searchQuery.toLowerCase();
    const selectedRatings = levelFilters.map((label) => labelToRating[label]);

    return base.filter((img) => {
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
  }, [activeTab, uploadedImages, likedImages, levelFilters, categoryFilters, searchQuery]);

  // Like hook（共用）
  const { handleToggleLike, onLikeUpdate } = useLikeHandler({
    setUploadedImages,
    setLikedImages,
    selectedImage,
    setSelectedImage,
    currentUser,
  });

  // 判斷是否被我按讚（防呆）
  const isLikedByCurrentUser = (image) => {
    const me = currentUser?._id || currentUser?.id;
    return !!(me && Array.isArray(image.likes) && image.likes.includes(me));
    // eslint-disable-next-line no-unreachable
  };

  // 在 filteredImages 陣列中左右移動（切換時也補抓完整欄位）
  const navigateFromSelected = async (dir) => {
    if (!selectedImage) return;
    const list = filteredImages;
    const idx = list.findIndex((img) => String(img._id) === String(selectedImage._id));
    if (idx < 0) return;

    const nextIdx = dir === "next" ? idx + 1 : idx - 1;
    if (nextIdx < 0 || nextIdx >= list.length) return; // 邊界

    const target = list[nextIdx];
    const enriched = await enrichImage(target);
    setSelectedImage(enriched);
  };

  // ✅ 計算前/後一張（給手機拖曳預覽）
  const selectedIndex = selectedImage
    ? filteredImages.findIndex((img) => String(img._id) === String(selectedImage._id))
    : -1;

  const prevImage =
    selectedIndex > 0 ? filteredImages[selectedIndex - 1] : undefined;
  const nextImage =
    selectedIndex >= 0 && selectedIndex < filteredImages.length - 1
      ? filteredImages[selectedIndex + 1]
      : undefined;

  if (!userData) {
    return <div className="text-white p-4">載入中...</div>;
  }

  return (
    <>
      <main className="pt-[var(--header-h,64px)]">
        <UserHeader
          userData={userData}
          currentUser={currentUser}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onUpdate={() => {
            axios.get(`/api/user-info?id=${id}`).then((res) => setUserData(res.data));
          }}
          onEditOpen={() => setEditModalOpen(true)}
        />

        <div className="flex gap-4 mb-6">
          <button
            className={`px-4 py-2 rounded font-medium transition ${
              activeTab === "uploads"
                ? "bg-white text-black shadow"
                : "bg-zinc-700 text-white hover:bg-zinc-600"
            }`}
            onClick={() => setActiveTab("uploads")}
          >
            上傳作品
          </button>
          <button
            className={`px-4 py-2 rounded font-medium transition ${
              activeTab === "likes"
                ? "bg-white text-black shadow"
                : "bg-zinc-700 text-white hover:bg-zinc-600"
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
          onSelectImage={handleSelectImage}   // 補抓作者後再開圖
          isLikedByCurrentUser={isLikedByCurrentUser}
          viewMode={viewMode}
          setUploadedImages={setUploadedImages}
          setLikedImages={setLikedImages}
          selectedImage={selectedImage}
          setSelectedImage={setSelectedImage}
          onLikeUpdate={onLikeUpdate}
        />

        {selectedImage && (
          <ImageModal
            imageData={selectedImage}
            prevImage={prevImage}
            nextImage={nextImage}
            currentUser={currentUser}
            onLikeUpdate={(updated) => {
              // 共用 hook 先同步 likes
              onLikeUpdate(updated);

              const me = currentUser?._id || currentUser?.id;
              const stillLiked = Array.isArray(updated.likes) && updated.likes.includes(me);

              if (activeTab === "likes") {
                // 取消喜歡 → 立即從收藏列表移除
                if (!stillLiked) {
                  setLikedImages((prev) => prev.filter((img) => img._id !== updated._id));
                  setSelectedImage((prev) => (prev?._id === updated._id ? null : prev));
                } else {
                  // 仍是喜歡 → 同步 likes
                  setLikedImages((prev) =>
                    prev.map((img) =>
                      img._id === updated._id ? { ...img, likes: updated.likes } : img
                    )
                  );
                }
              } else {
                // 上傳分頁 → 同步 likes
                setUploadedImages((prev) =>
                  prev.map((img) =>
                    img._id === updated._id ? { ...img, likes: updated.likes } : img
                  )
                );
              }
            }}
            onClose={() => setSelectedImage(null)}
            onNavigate={(dir) => navigateFromSelected(dir)}  // 左右切換
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
