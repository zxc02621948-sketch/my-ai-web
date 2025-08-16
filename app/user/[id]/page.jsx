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

  // —— 共用工具：彈性取值（各 API 可能有不同鍵名） ——
  const pickUser = (v) => (v?.user ?? v?.data?.user ?? v ?? null);
  const pickList = (v) => {
    if (Array.isArray(v)) return v;
    if (Array.isArray(v?.images)) return v.images;
    if (Array.isArray(v?.uploads)) return v.uploads;
    if (Array.isArray(v?.likedImages)) return v.likedImages;
    if (Array.isArray(v?.items)) return v.items;
    if (Array.isArray(v?.data)) return v.data;
    if (Array.isArray(v?.data?.items)) return v.data.items;
    if (Array.isArray(v?.data?.images)) return v.data.images;
    if (Array.isArray(v?.data?.uploads)) return v.data.uploads;
    if (Array.isArray(v?.data?.likedImages)) return v.data.likedImages;
    return [];
  };

  // ====== 追蹤同步：通用取 id 與更新處理 ======
  const idOf = (v) => {
    if (!v) return "";
    if (typeof v === "string") return String(v);
    return String(v?.userId?._id || v?.userId || v?._id || v?.id || "");
  };
  const ownerIdOf = (img) => {
    if (!img) return "";
    const u = img.user ?? img.userId;
    return typeof u === "string" ? String(u) : String(u?._id || u?.id || u?.userId || "");
  };

  const handleFollowChange = (targetUserId, isFollowing) => {
    const tid = String(targetUserId);

    // A) 同步目前開啟的大圖
    setSelectedImage((prev) => {
      if (!prev) return prev;
      const uid = ownerIdOf(prev);
      if (uid && uid === tid) {
        const userObj =
          typeof prev.user === "object"
            ? { ...prev.user, _id: prev.user?._id || prev.user?.id || prev.user?.userId || tid }
            : { _id: tid };
        return { ...prev, user: { ...userObj, isFollowing } };
      }
      return prev;
    });

    // B) 同步清單（上傳/已讚）
    setUploadedImages((prev) =>
      Array.isArray(prev)
        ? prev.map((img) => {
            const uid = ownerIdOf(img);
            if (uid === tid) {
              const userObj = typeof img.user === "object" ? img.user : { _id: tid };
              return { ...img, user: { ...userObj, isFollowing } };
            }
            return img;
          })
        : prev
    );
    setLikedImages((prev) =>
      Array.isArray(prev)
        ? prev.map((img) => {
            const uid = ownerIdOf(img);
            if (uid === tid) {
              const userObj = typeof img.user === "object" ? img.user : { _id: tid };
              return { ...img, user: { ...userObj, isFollowing } };
            }
            return img;
          })
        : prev
    );

    // C) 同步目前登入者 following 名單
    setCurrentUser((prev) => {
      if (!prev) return prev;
      const list = Array.isArray(prev.following) ? prev.following.map(idOf).filter(Boolean) : [];
      let next = list;
      if (isFollowing && !list.includes(tid)) next = [...list, tid];
      if (!isFollowing && list.includes(tid)) next = list.filter((x) => x !== tid);
      return { ...prev, following: next };
    });

    // D) 廣播給 UserHeader / 其他頁面元件
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("follow-changed", { detail: { targetUserId: tid, isFollowing } })
      );
    }
  };


  // 讀取個人頁資料（穩定版）
  useEffect(() => {
    if (!id || id === "undefined") return;

    const uid = encodeURIComponent(id);
    const ac = new AbortController();

    const getJSON = async (url) => {
      const r = await fetch(url, { cache: "no-store", signal: ac.signal });
      if (!r.ok) {
        // 回傳文字方便除錯，但不讓整頁爆
        const text = await r.text().catch(() => "");
        throw new Error(`${url} -> HTTP ${r.status}${text ? ` | ${text.slice(0, 160)}` : ""}`);
      }
      return r.json();
    };

    (async () => {
      const [userRes, uploadsRes, likesRes] = await Promise.allSettled([
        getJSON(`/api/user-info?id=${uid}`),
        getJSON(`/api/user-images?id=${uid}`),
        getJSON(`/api/user-liked-images?id=${uid}`),
      ]);

      if (userRes.status === "fulfilled") {
        setUserData(pickUser(userRes.value));
      } else {
        console.warn("[user-info] failed:", userRes.reason);
        // 不覆蓋 userData，維持當前狀態（避免顯示空白）
      }

      if (uploadsRes.status === "fulfilled") {
        const list = pickList(uploadsRes.value);
        if (list.length || uploadedImages.length === 0) setUploadedImages(list);
      } else {
        console.warn("[user-images] failed:", uploadsRes.reason);
      }

      if (likesRes.status === "fulfilled") {
        const list = pickList(likesRes.value);
        if (list.length || likedImages.length === 0) setLikedImages(list);
      } else {
        console.warn("[user-liked-images] failed:", likesRes.reason);
      }
    })();

    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // 取完整圖片資訊並合併（模型/提示詞/生成參數等）
  const enrichImage = async (img) => {
    let full = img;
    try {
      // 1) 取完整 image
      const r = await axios.get(`/api/images/${img._id}`);
      const apiImage = r?.data?.image || r?.data;
      if (apiImage && apiImage._id) {
        // 只用有值的欄位覆蓋，避免 undefined/null 蓋掉原本的資料
        Object.entries(apiImage).forEach(([key, val]) => {
          if (val !== undefined && val !== null && val !== "") {
            full[key] = val;
          }
        });

        // 統一模型名稱鍵
          full.modelName =
          full.modelName ??
          full.model_name ??
          full.model?.name ??
          full.models?.[0]?.name ??
          full.metadata?.model ??
          full.sdModel ??
          null;
      }
      // 2) 作者資料不足時再補抓
      const authorId =
        typeof full.user === "string" ? full.user : full.user?._id || full.user?.id;
      if (authorId && (!full.user || !full.user.username)) {
        const u = await axios.get(`/api/user-info?id=${authorId}`);
        if (u?.data) full = { ...full, user: u.data };
      }
    } catch {
      // 靜默失敗
    }
    return full;
  };

  const handleSelectImage = async (img) => {
    const enriched = await enrichImage(img);
    setSelectedImage(enriched);
  };

  // 畫面用的過濾清單
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

  // 判斷是否被我按讚
  const isLikedByCurrentUser = (image) => {
    const me = currentUser?._id || currentUser?.id;
    return !!(me && Array.isArray(image.likes) && image.likes.includes(me));
  };

  // 在 filteredImages 陣列中左右移動（切換時也補抓完整欄位）
  const navigateFromSelected = async (dir) => {
    if (!selectedImage) return;
    const list = filteredImages;
    const idx = list.findIndex((img) => String(img._id) === String(selectedImage._id));
    if (idx < 0) return;

    const nextIdx = dir === "next" ? idx + 1 : idx - 1;
    if (nextIdx < 0 || nextIdx >= list.length) return;

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
                ? "bg-white text-black shadow"   // ← 修正這裡
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
          onSelectImage={handleSelectImage}
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
            onFollowChange={handleFollowChange}
            onLikeUpdate={(updated) => {
              onLikeUpdate(updated);

              const me = currentUser?._id || currentUser?.id;
              const stillLiked = Array.isArray(updated.likes) && updated.likes.includes(me);

              if (activeTab === "likes") {
                if (!stillLiked) {
                  setLikedImages((prev) => prev.filter((img) => img._id !== updated._id));
                  setSelectedImage((prev) => (prev?._id === updated._id ? null : prev));
                } else {
                  setLikedImages((prev) =>
                    prev.map((img) =>
                      img._id === updated._id ? { ...img, likes: updated.likes } : img
                    )
                  );
                }
              } else {
                setUploadedImages((prev) =>
                  prev.map((img) =>
                    img._id === updated._id ? { ...img, likes: updated.likes } : img
                  )
                );
              }
            }}
            onClose={() => setSelectedImage(null)}
            onNavigate={(dir) => navigateFromSelected(dir)}
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
