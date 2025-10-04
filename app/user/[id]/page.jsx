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
import PointsHistoryModal from "@/components/user/PointsHistoryModal";
import { usePlayer } from "@/components/context/PlayerContext";
// 重複 import 修正：axios 已在檔案頂部引入

const labelToRating = {
  "一般圖片": "all",
  "15+ 圖片": "15",
  "18+ 圖片": "18",
};

export default function UserProfilePage() {
  const { id } = useParams();
  const params = useSearchParams();
  const router = useRouter();
  const player = usePlayer();

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
  const [isPointsModalOpen, setPointsModalOpen] = useState(false);

  // ✅ 讀 URL 的 search 當唯一資料源（就地搜尋）
  const [searchQuery, setSearchQuery] = useState("");
  useEffect(() => {
    try { player.resetExternalBridge?.(); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSearchQuery((params.get("search") || "").trim());
  }, [params]);

  // 分頁切換時把 tab 寫回 URL（僅在實際變更時才導引，避免重複 replace 造成 ChunkLoadError）
  useEffect(() => {
    if (typeof window === "undefined") return;
    // 以目前網址列為基準，僅調整 tab 參數（保留 IDE / Next 的內部參數）
    const currentSp = new URLSearchParams(window.location.search);
    const before = currentSp.toString();
    if (activeTab === "likes") currentSp.set("tab", "likes");
    else currentSp.delete("tab");
    const after = currentSp.toString();
    if (after === before) return; // 沒有差異，不需要 replace
    const href = `${window.location.pathname}${after ? `?${after}` : ""}`;
    try { router.replace(href); } catch {}
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
    currentUser && (currentUser._id === id || currentUser.id === id || currentUser.username === id);

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

  // ✅ 監聽積分更新事件，針對當前個人頁即時更新顯示
  useEffect(() => {
    const onPointsUpdated = (e) => {
      const { userId, pointsBalance } = e.detail || {};
      if (!userId) return;

      // 當以 username 瀏覽自己的個人頁時，也要正確比對與更新
      const viewingByUsername = !!currentUser && String(id) === String(currentUser?.username);
      const viewingById = !!currentUser && (String(id) === String(currentUser?._id) || String(id) === String(currentUser?.id));

      const eventIsCurrentUser = String(userId) === String(currentUser?._id) || String(userId) === String(currentUser?.id);
      const eventMatchesPageUser = String(userId) === String(userData?._id);

      const shouldUpdate = eventMatchesPageUser || (eventIsCurrentUser && (viewingByUsername || viewingById));
      if (!shouldUpdate) return; // 只更新目前所看的用戶

      setUserData((prev) => {
        const base = prev || { _id: currentUser?._id, username: currentUser?.username };
        return { ...base, pointsBalance: Number(pointsBalance ?? 0) };
      });
    };
    window.addEventListener("points-updated", onPointsUpdated);
    return () => window.removeEventListener("points-updated", onPointsUpdated);
  }, [id, userData?._id, currentUser?._id, currentUser?.username]);

  // ✅ 監聽迷你播放器開通事件，立即更新個人頁與啟用播放器
  useEffect(() => {
    const onPurchased = (e) => {
      const { userId, theme } = e.detail || {};
      if (!userId) return;

      // 當以 username 瀏覽自己的個人頁時，也要正確比對與更新
      const viewingByUsername = !!currentUser && String(id) === String(currentUser?.username);
      const viewingById =
        !!currentUser &&
        (String(id) === String(currentUser?._id) || String(id) === String(currentUser?.id));

      const eventIsCurrentUser =
        String(userId) === String(currentUser?._id) || String(userId) === String(currentUser?.id);
      const eventMatchesPageUser = String(userId) === String(userData?._id);

      const shouldUpdate = eventMatchesPageUser || (eventIsCurrentUser && (viewingByUsername || viewingById));
      if (!shouldUpdate) return; // 只更新目前所看的用戶

      setUserData((prev) => {
        const base = prev || { _id: currentUser?._id, username: currentUser?.username };
        return {
          ...base,
          miniPlayerPurchased: true,
          miniPlayerTheme: String(theme || base?.miniPlayerTheme || "modern"),
        };
      });

      try {
        player?.setMiniPlayerEnabled?.(true);
        player?.setShareMode?.("page");
        localStorage.setItem("miniPlayerTheme", String(theme || "modern"));
      } catch {}
    };
    window.addEventListener("mini-player-purchased", onPurchased);
    return () => window.removeEventListener("mini-player-purchased", onPurchased);
  }, [id, userData?._id, currentUser?._id, currentUser?.username]);

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
      // 先抓 user-info，避免被其他請求阻塞而遲遲不顯示
      try {
        const userJson = await getJSON(`/api/user-info?id=${uid}`).catch(() => null);
        if (userJson) {
          const picked = pickUser(userJson);
          setUserData(picked);
          const hasPlayer = !!picked?.miniPlayerPurchased;
          if (hasPlayer) {
            try {
              player?.setMiniPlayerEnabled?.(true);
              player?.setShareMode?.("page");
              localStorage.setItem("miniPlayerTheme", String(picked?.miniPlayerTheme || "modern"));
            } catch {}
          } else {
            try { player?.setMiniPlayerEnabled?.(false); } catch {}
          }
          try {
            const u = picked || {};
            const url = String(u.defaultMusicUrl || "");
            if (hasPlayer && url) {
              player?.setSource?.(url);
              player?.setOriginUrl?.(url);
              try {
                const o = await axios.get(`/api/youtube-oembed?url=${encodeURIComponent(url)}`);
                const t = o?.data?.title;
                player?.setTrackTitle?.(t || url);
              } catch {
                player?.setTrackTitle?.(url);
              }
              // 同步到全域播放清單：若 localStorage 有使用者清單則合併，並帶入 title，避免跑馬燈顯示 watch
              try {
                const key = `playlist_${id}`;
                let saved = [];
                try { saved = JSON.parse(localStorage.getItem(key) || "[]"); } catch {}
                const sanitized = Array.isArray(saved) ? saved.filter((it) => it && it.url) : [];
                const firstTitle = (typeof t === "string" && t.trim().length) ? t : url;
                const merged = [{ url, title: firstTitle }, ...sanitized.filter((it) => it.url !== url)];
                player?.setPlaylist?.(merged);
                player?.setActiveIndex?.(0);
              } catch {}
              // 預設暫停，讓使用者點擊圖示開始播放
              // （全域橋接會載入 YouTube 內嵌播放器，但不自動播放）
            } else if (hasPlayer) {
              // 若尚未設定預設音源，嘗試從播放清單備援載入第一首
              try {
                const key = `playlist_${id}`;
                let saved = [];
                try { saved = JSON.parse(localStorage.getItem(key) || "[]"); } catch {}
                if (Array.isArray(saved) && saved.length > 0 && saved[0]?.url) {
                  const firstUrl = String(saved[0].url || "");
                  if (firstUrl) {
                    player?.setSource?.(firstUrl);
                    player?.setOriginUrl?.(firstUrl);
                    try {
                      const o = await axios.get(`/api/youtube-oembed?url=${encodeURIComponent(firstUrl)}`);
                      const t = o?.data?.title;
                      player?.setTrackTitle?.(t || firstUrl);
                    } catch {
                      player?.setTrackTitle?.(firstUrl);
                    }
                    // 同步到全域播放清單與目前索引
                    try { player?.setPlaylist?.(saved.filter((it) => it && it.url)); } catch {}
                    try { player?.setActiveIndex?.(0); } catch {}
                  }
                }
              } catch {}
            }
          } catch {}
        } else {
          // 備援：改用 axios 再試一次，若仍失敗至少填入基本物件避免卡載入
          try {
            const r2 = await axios.get(`/api/user-info?id=${uid}`);
            const backup = pickUser(r2?.data || r2);
            if (backup) {
              setUserData(backup);
              const hasPlayer2 = !!backup?.miniPlayerPurchased;
              if (hasPlayer2) {
                try {
                  player?.setMiniPlayerEnabled?.(true);
                  player?.setShareMode?.("page");
                  localStorage.setItem("miniPlayerTheme", String(backup?.miniPlayerTheme || "modern"));
                } catch {}
              } else {
                try { player?.setMiniPlayerEnabled?.(false); } catch {}
              }
              // 同步載入使用者預設音樂（即使走備援資料流也要載入）
              try {
                const url = String(backup.defaultMusicUrl || "");
                if (hasPlayer2 && url) {
                  player?.setSource?.(url);
                  player?.setOriginUrl?.(url);
                  try {
                    const o = await axios.get(`/api/youtube-oembed?url=${encodeURIComponent(url)}`);
                    const t = o?.data?.title;
                    player?.setTrackTitle?.(t || url);
                  } catch {
                    player?.setTrackTitle?.(url);
                  }
                  // 預設暫停，等待使用者互動開始播放
                } else if (hasPlayer2) {
                  // 備援：從本地播放清單載入第一首
                  try {
                    const key = `playlist_${id}`;
                    let saved = [];
                    try { saved = JSON.parse(localStorage.getItem(key) || "[]"); } catch {}
                    if (Array.isArray(saved) && saved.length > 0 && saved[0]?.url) {
                      const firstUrl = String(saved[0].url || "");
                      if (firstUrl) {
                        player?.setSource?.(firstUrl);
                        player?.setOriginUrl?.(firstUrl);
                        try {
                          const o = await axios.get(`/api/youtube-oembed?url=${encodeURIComponent(firstUrl)}`);
                          const t = o?.data?.title;
                          player?.setTrackTitle?.(t || firstUrl);
                        } catch {
                          player?.setTrackTitle?.(firstUrl);
                        }
                      }
                    }
                  } catch {}
                }
              } catch {}
            } else {
              setUserData({ _id: uid, pointsBalance: 0 });
              // 找不到使用者時不啟用播放器（需購買才顯示）
              try { player?.setMiniPlayerEnabled?.(false); } catch {}
            }
          } catch (e) {
            setUserData({ _id: uid, pointsBalance: 0 });
            try { player?.setMiniPlayerEnabled?.(false); } catch {}
          }
        }
      } catch (e) {
        setUserData({ _id: uid, pointsBalance: 0 });
        try { player?.setMiniPlayerEnabled?.(false); } catch {}
      }

      // 並行抓取上傳與收藏清單（不阻塞 user-info 顯示）
      getJSON(`/api/user-images?id=${uid}`)
        .then((val) => {
          const list = pickList(val);
          if (list.length || uploadedImages.length === 0) setUploadedImages(list);
        })
        .catch((err) => {
          console.warn("[user-images] failed:", err);
        });

      getJSON(`/api/user-liked-images?id=${uid}`)
        .then((val) => {
          const list = pickList(val);
          if (list.length || likedImages.length === 0) setLikedImages(list);
        })
        .catch((err) => {
          console.warn("[user-liked-images] failed:", err);
        });
    })();

    return () => {
      ac.abort();
      // 離開個人頁時僅恢復分享模式為 global，不關閉迷你播放器（避免返回後需要重新啟用）
      try {
        player?.setShareMode?.("global");
      } catch {}
    };
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
    return (
      <div className="text-white p-4">
        載入中...（若卡住請稍候或稍後重試）
      </div>
    );
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
            // 強制刷新頁面以顯示新的頭像
            window.location.reload();
          }}
          onEditOpen={() => setEditModalOpen(true)}
          onPointsOpen={() => setPointsModalOpen(true)}
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
        currentUser={userData}
        onUpdate={(updated) => {
          setUserData((prev) => ({ ...prev, ...updated }));
        }}
      />

      <PointsHistoryModal
        isOpen={isPointsModalOpen}
        onClose={() => setPointsModalOpen(false)}
      />
    </>
  );
}
