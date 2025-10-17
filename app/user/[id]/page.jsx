"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import axios from "axios";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import ImageModal from "@/components/image/ImageModal";
import UserHeader from "@/components/user/UserHeader";
import UserImageGrid from "@/components/user/UserImageGrid";
import UserEditModal from "@/components/user/UserEditModal";
import { useFilterContext } from "@/components/context/FilterContext";
import useLikeHandler from "@/hooks/useLikeHandler";
import PointsHistoryModal from "@/components/user/PointsHistoryModal";
import PointsStoreModal from "@/components/user/PointsStoreModal";
import PowerCouponModal from "@/components/user/PowerCouponModal";
import { usePlayer } from "@/components/context/PlayerContext";
import UnpinReminderModal from "@/components/player/UnpinReminderModal";
import { useCurrentUser } from "@/contexts/CurrentUserContext";
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
  const { currentUser, setCurrentUser } = useCurrentUser(); // 使用 Context
  
  // ✅ 立即滾動到頂部（在組件渲染前執行）
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  const {
    levelFilters,
    categoryFilters,
    viewMode,
    filterMenuOpen,
    setFilterMenuOpen,
  } = useFilterContext();

  const [userData, setUserData] = useState(null);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [likedImages, setLikedImages] = useState([]);
  const [pinnedPlayerData, setPinnedPlayerData] = useState(null);
  const playlistLoadedRef = useRef(null); // 追踪已載入的播放清單，避免重複載入
  const lastPageIdRef = useRef(id); // 追踪上次訪問的頁面 ID

  // ✅ 當頁面 ID 改變時，清除播放清單載入標記
  useEffect(() => {
    if (lastPageIdRef.current !== id) {
      playlistLoadedRef.current = null;
      lastPageIdRef.current = id;
    }
  }, [id]);

  // ✅ 從 URL 讀取目前分頁（預設 uploads）
  const [activeTab, setActiveTab] = useState(
    params.get("tab") === "likes" ? "likes" : "uploads"
  );

  const [selectedImage, setSelectedImage] = useState(null);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [isPowerCouponModalOpen, setPowerCouponModalOpen] = useState(false);
  const [isPointsModalOpen, setPointsModalOpen] = useState(false);
  const [isStoreOpen, setStoreOpen] = useState(false);

  // ✅ 確保返回個人頁面時播放器狀態正確恢復
  useEffect(() => {
    // 當進入個人頁面時，設置分享模式為 "page"
    try {
      player?.setShareMode?.("page");
    } catch {}
    
    // 清理函數：離開個人頁面時恢復為 "global"
    return () => {
      try {
        player?.setShareMode?.("global");
      } catch {}
    };
  }, [id, player]); // 當頁面 ID 改變時重新執行
  
  // ✅ 當 userData 載入後，檢查並啟用播放器
  useEffect(() => {
    if (userData?.miniPlayerPurchased) {
      try {
        player?.setMiniPlayerEnabled?.(true);
      } catch {}
    }
  }, [userData?.miniPlayerPurchased, player]); // 移除 currentUser?.pinnedPlayer 依賴，避免釘選時重複觸發

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

  // 檢查釘選播放器狀態（使用 Context 中的 currentUser）
  useEffect(() => {
    if (!currentUser || currentUser === undefined) return;
    
    // 檢查是否有釘選播放器
    if (currentUser?.pinnedPlayer?.userId) {
      const pinned = currentUser.pinnedPlayer;
      // 檢查是否過期
      const now = new Date();
      if (pinned.expiresAt && new Date(pinned.expiresAt) > now) {
        setPinnedPlayerData(pinned);
      }
    }
  }, [currentUser]);

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
    
    // ✅ 優先從數據庫讀取播放清單（這樣訪客也能聽到作者的音樂）
    const userPlaylist = Array.isArray(u.playlist) && u.playlist.length > 0 ? u.playlist : [];
    
    // ✅ 等待 currentUser 載入完成（undefined = 載入中，null = 未登入）
    if (currentUser === undefined) {
      // 不執行任何播放清單載入邏輯，靜默跳過
      return;
    }
    
    // ✅ 只有已登入用戶才檢查釘選播放器
    let hasPinnedPlayer = false;
    let isPinnedThisPage = false;
    let currentUserPinnedPlayer = null;
    let pinnedUserIdStr = '';
    let currentPageIdStr = String(id || '');
    
    if (currentUser && currentUser !== null) {
      currentUserPinnedPlayer = currentUser.pinnedPlayer;
      hasPinnedPlayer = currentUserPinnedPlayer?.userId && 
        currentUserPinnedPlayer?.expiresAt && 
        new Date(currentUserPinnedPlayer.expiresAt) > new Date();
      
      // ✅ 轉換為字符串進行比較（確保 ObjectId 和 string 可以正確比較）
      pinnedUserIdStr = currentUserPinnedPlayer?.userId?.toString() || '';
      isPinnedThisPage = pinnedUserIdStr === currentPageIdStr;
    }
    
    // ✅ 如果有釘選 + 釘選的不是當前頁面 → 不做任何操作（保持釘選狀態）
    if (hasPinnedPlayer && !isPinnedThisPage) {
      // ✅ 什麼都不做，保持釘選的播放器狀態
      // playerOwner 應該維持釘選的用戶，不應該改為當前頁面的用戶
      // 播放清單應該維持釘選的播放清單，不應該重新載入
    }
    // ✅ 如果沒有釘選 OR 釘選的就是當前頁面 → 載入當前頁面的播放清單
    else if (hasPlayer && userPlaylist.length > 0) {
      // ✅ 更新 playerOwner（只在沒有釘選或釘選自己時）
      if (picked?.username) {
        player?.setPlayerOwner?.({ userId: id, username: picked.username });
      }
      // 有播放清單：載入第一首
      const firstItem = userPlaylist[0];
      const firstUrl = String(firstItem.url || "");
      const firstTitle = String(firstItem.title || firstUrl);
      
      if (firstUrl) {
        // ✅ 必須同時設置 src 和 originUrl 確保 YouTube 播放器正確渲染
        player?.setSrc?.(firstUrl);
        player?.setOriginUrl?.(firstUrl);
        player?.setTrackTitle?.(firstTitle);
        player?.setPlaylist?.(userPlaylist);
        player?.setActiveIndex?.(0);
      }
    } else if (!hasPinnedPlayer && hasPlayer) {
      // 沒有播放清單，檢查是否有單首預設音樂（只在沒有釘選時載入）
      const url = String(u.defaultMusicUrl || "");
      if (url) {
        player?.setSrc?.(url);
        player?.setOriginUrl?.(url);
        try {
          const o = await axios.get(`/api/youtube-oembed?url=${encodeURIComponent(url)}`);
          const t = o?.data?.title;
          player?.setTrackTitle?.(t || url);
          player?.setPlaylist?.([{ url, title: t || url }]);
          player?.setActiveIndex?.(0);
        } catch {
          player?.setTrackTitle?.(url);
          player?.setPlaylist?.([{ url, title: url }]);
          player?.setActiveIndex?.(0);
        }
      }
    }
  } catch (error) {
    console.error('[個人頁面] 播放清單載入錯誤:', error);
  }
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
                // ✅ 等待 currentUser 載入完成
                if (currentUser === undefined) {
                  // 靜默跳過
                  return;
                }
                
                // ✅ 檢查是否有釘選播放器（從 currentUser 獲取）
                const currentUserPinnedPlayer = currentUser?.pinnedPlayer;
                const hasPinnedPlayer = currentUserPinnedPlayer?.userId && 
                  currentUserPinnedPlayer?.expiresAt && 
                  new Date(currentUserPinnedPlayer.expiresAt) > new Date();
                
                // ✅ 重新計算 isPinnedThisPage（備援流程中需要獨立計算）
                const pinnedUserIdStr = currentUserPinnedPlayer?.userId?.toString() || '';
                const currentPageIdStr = String(id || '');
                const isPinnedThisPage = pinnedUserIdStr === currentPageIdStr;
                
                // ✅ 優先從數據庫讀取播放清單（備援流程）
                const userPlaylist = Array.isArray(backup.playlist) && backup.playlist.length > 0 ? backup.playlist : [];
                
                // ✅ 如果有釘選 + 釘選的不是當前頁面 → 不做任何操作（保持釘選狀態）
                if (hasPinnedPlayer && !isPinnedThisPage) {
                  // ✅ 什麼都不做，保持釘選的播放器狀態
                }
                // ✅ 如果沒有釘選 OR 釘選的就是當前頁面 → 載入當前頁面的播放清單
                else if (hasPlayer2 && userPlaylist.length > 0) {
                  // ✅ 更新 playerOwner（只在沒有釘選或釘選自己時）
                  if (backup?.username) {
                    player?.setPlayerOwner?.({ userId: id, username: backup.username });
                  }
                  // 有播放清單：載入第一首
                  const firstItem = userPlaylist[0];
                  const firstUrl = String(firstItem.url || "");
                  const firstTitle = String(firstItem.title || firstUrl);
                  
                  if (firstUrl) {
                    player?.setSrc?.(firstUrl);
                    player?.setOriginUrl?.(firstUrl);
                    player?.setTrackTitle?.(firstTitle);
                    player?.setPlaylist?.(userPlaylist);
                    player?.setActiveIndex?.(0);
                  }
                } else if (!hasPinnedPlayer && hasPlayer2) {
                  // 沒有播放清單，檢查是否有單首預設音樂（只在沒有釘選時載入）
                  const url = String(backup.defaultMusicUrl || "");
                  if (url) {
                    player?.setSrc?.(url);
                    player?.setOriginUrl?.(url);
                    try {
                      const o = await axios.get(`/api/youtube-oembed?url=${encodeURIComponent(url)}`);
                      const t = o?.data?.title;
                      player?.setTrackTitle?.(t || url);
                      player?.setPlaylist?.([{ url, title: t || url }]);
                      player?.setActiveIndex?.(0);
                    } catch {
                      player?.setTrackTitle?.(url);
                      player?.setPlaylist?.([{ url, title: url }]);
                      player?.setActiveIndex?.(0);
                    }
                  }
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
        console.error('🔧 [最外層錯誤] 用戶資料載入失敗:', e);
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
          if (err.name !== 'AbortError') {
            console.warn("[user-images] failed:", err);
          }
        });

      getJSON(`/api/user-liked-images?id=${uid}`)
        .then((val) => {
          const list = pickList(val);
          if (list.length || likedImages.length === 0) setLikedImages(list);
        })
        .catch((err) => {
          if (err.name !== 'AbortError') {
            console.warn("[user-liked-images] failed:", err);
          }
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
  }, [id, currentUser]); // 重新加回 currentUser，但用 ref 防止重複載入

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

  const handleUnpinPlayer = async () => {
    try {
      await axios.delete('/api/player/pin');
      setPinnedPlayerData(null);
      player?.setIsPlaying?.(false);
      
      // 更新 CurrentUserContext，移除釘選數據
      if (setCurrentUser) {
        setCurrentUser(prevUser => {
          if (!prevUser) return prevUser;
          const { pinnedPlayer, ...rest } = prevUser;
          return rest;
        });
      }
      
      // 觸發全局事件
      window.dispatchEvent(new CustomEvent('pinnedPlayerChanged', { 
        detail: { isPinned: false } 
      }));
    } catch (error) {
      console.error('❌ [UserPage] 解除釘選失敗:', error);
      throw error;
    }
  };

  return (
    <>
      {/* 釘選播放器提示彈窗 */}
      <UnpinReminderModal
        pageUserId={id}
        pageUsername={userData?.username}
        pageHasPlayer={!!userData?.miniPlayerPurchased}
        currentPinnedUserId={pinnedPlayerData?.userId}
        currentPinnedUsername={pinnedPlayerData?.username}
        onUnpin={handleUnpinPlayer}
      />
      
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
          onPowerCouponOpen={() => setPowerCouponModalOpen(true)}
          onUserDataUpdate={(updatedUserData) => {
            setUserData(updatedUserData);
          }}
        />

        {/* 標籤頁切換 - 手機版優化 */}
        <div className="flex gap-2 md:gap-4 mb-4 md:mb-6 px-2 md:px-0">
          <button
            className={`flex-1 md:flex-none px-3 py-3 md:px-4 md:py-2 rounded-lg md:rounded font-medium transition text-sm md:text-base ${
              activeTab === "uploads"
                ? "bg-white text-black shadow-md"
                : "bg-zinc-700 text-white hover:bg-zinc-600"
            }`}
            onClick={() => setActiveTab("uploads")}
          >
            <span className="hidden sm:inline">上傳作品</span>
            <span className="sm:hidden">作品</span>
          </button>
          <button
            className={`flex-1 md:flex-none px-3 py-3 md:px-4 md:py-2 rounded-lg md:rounded font-medium transition text-sm md:text-base ${
              activeTab === "likes"
                ? "bg-white text-black shadow-md"
                : "bg-zinc-700 text-white hover:bg-zinc-600"
            }`}
            onClick={() => setActiveTab("likes")}
          >
            <span className="hidden sm:inline">❤️ 收藏圖片</span>
            <span className="sm:hidden">❤️ 收藏</span>
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
      
      <PointsStoreModal
        isOpen={isStoreOpen}
        onClose={() => setStoreOpen(false)}
        userData={userData}
      />
      <PowerCouponModal
        isOpen={isPowerCouponModalOpen}
        onClose={() => setPowerCouponModalOpen(false)}
        userData={userData}
      />
    </>
  );
}
