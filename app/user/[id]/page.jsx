"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import axios from "axios";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import ImageModal from "@/components/image/ImageModal";
import VideoModal from "@/components/video/VideoModal";
import EditVideoModal from "@/components/video/EditVideoModal";
import MusicModal from "@/components/music/MusicModal";
import EditMusicModal from "@/components/music/EditMusicModal";
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
import { notify } from "@/components/common/GlobalNotificationManager";
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
  const [uploadedVideos, setUploadedVideos] = useState([]);
  const [uploadedMusic, setUploadedMusic] = useState([]);
  const [likedImages, setLikedImages] = useState([]);
  const [likedVideos, setLikedVideos] = useState([]);
  const [likedMusic, setLikedMusic] = useState([]);
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

  // ✅ 上傳作品類型篩選（全部/圖片/影片/音樂）
  const [contentTypeFilter, setContentTypeFilter] = useState("all");

  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedMusic, setSelectedMusic] = useState(null);
  const [showEditVideoModal, setShowEditVideoModal] = useState(false);
  const [showEditMusicModal, setShowEditMusicModal] = useState(false);
  const [editingMusic, setEditingMusic] = useState(null);
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
  }, [id]); // 移除 player 依賴，避免無限循環
  
  // ✅ 當 userData 載入後，檢查並啟用播放器
  useEffect(() => {
    // 檢查是否有播放器權限（購買或體驗券）
    const hasPurchased = userData?.miniPlayerPurchased;
    const hasCoupon = userData?.playerCouponUsed && 
                      userData?.miniPlayerExpiry && 
                      new Date(userData.miniPlayerExpiry) > new Date();
    
    if (hasPurchased || hasCoupon) {
      try {
        player?.setMiniPlayerEnabled?.(true);
      } catch {}
    }
  }, [userData?.miniPlayerPurchased, userData?.playerCouponUsed, userData?.miniPlayerExpiry]); // 移除 player 依賴，避免無限循環
  
  // ✅ 設置頁面主人的播放器造型信息（獨立的 useEffect，避免循環）
  useEffect(() => {
    if (userData) {
      try {
        player?.setPageOwnerSkin?.({
          activePlayerSkin: userData.activePlayerSkin || 'default',
          playerSkinSettings: userData.playerSkinSettings || {
            mode: 'rgb',
            speed: 0.02,
            saturation: 50,
            lightness: 60,
            hue: 0,
            opacity: 0.7
          },
          premiumPlayerSkin: !!userData.premiumPlayerSkin
        });
      } catch {}
    } else {
      // 清除頁面主人的造型信息
      try {
        player?.setPageOwnerSkin?.(null);
      } catch {}
    }
  }, [userData?.activePlayerSkin, userData?.playerSkinSettings, userData?.premiumPlayerSkin, userData?._id]); // 使用 _id 作為穩定的依賴

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
    if (Array.isArray(v?.items)) return v.items; // user-videos, user-music 使用 items
    if (Array.isArray(v?.videos)) return v.videos;
    if (Array.isArray(v?.music)) return v.music;
    if (Array.isArray(v?.data)) return v.data;
    if (Array.isArray(v?.data?.items)) return v.data.items;
    if (Array.isArray(v?.data?.images)) return v.data.images;
    if (Array.isArray(v?.data?.uploads)) return v.data.uploads;
    if (Array.isArray(v?.data?.likedImages)) return v.data.likedImages;
    if (Array.isArray(v?.data?.videos)) return v.data.videos;
    if (Array.isArray(v?.data?.music)) return v.data.music;
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
          // ✅ 檢查是否有播放器權限（購買或體驗券）
          const hasPurchased = !!picked?.miniPlayerPurchased;
          const hasCoupon = picked?.playerCouponUsed && 
                            picked?.miniPlayerExpiry && 
                            new Date(picked.miniPlayerExpiry) > new Date();
          const hasPlayer = hasPurchased || hasCoupon;
          
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
    else if (hasPlayer) {
      // ✅ 無論是否有播放清單，都設置 playerOwner（用於顯示釘選按鈕）
      if (picked?.username) {
        const allowShuffleRaw =
          picked?.playlistAllowShuffle ?? userData?.playlistAllowShuffle;
        const allowShuffle =
          typeof allowShuffleRaw === "boolean" ? allowShuffleRaw : null;
        player?.setPlayerOwner?.({
          userId: id,
          username: picked.username,
          ...(typeof allowShuffle === "boolean" ? { allowShuffle } : {}),
        });
      }
      
      if (userPlaylist.length > 0) {
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
      } else {
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
        } else {
          // ✅ 即使沒有播放清單和預設音樂，也設置空的播放清單，這樣釘選按鈕才能顯示
          player?.setPlaylist?.([]);
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
              // ✅ 檢查是否有播放器權限（購買或體驗券）
              const hasPurchased2 = !!backup?.miniPlayerPurchased;
              const hasCoupon2 = backup?.playerCouponUsed && 
                                backup?.miniPlayerExpiry && 
                                new Date(backup.miniPlayerExpiry) > new Date();
              const hasPlayer2 = hasPurchased2 || hasCoupon2;
              
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
                else if (hasPlayer2) {
                  // ✅ 無論是否有播放清單，都設置 playerOwner（用於顯示釘選按鈕）
                  if (backup?.username) {
                    const allowShuffle =
                      typeof backup?.playlistAllowShuffle === "boolean"
                        ? backup.playlistAllowShuffle
                        : null;
                    player?.setPlayerOwner?.({
                      userId: id,
                      username: backup.username,
                      ...(typeof allowShuffle === "boolean"
                        ? { allowShuffle }
                        : {}),
                    });
                  }
                  
                  if (userPlaylist.length > 0) {
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
                  } else {
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
                    } else {
                      // ✅ 即使沒有播放清單和預設音樂，也設置空的播放清單，這樣釘選按鈕才能顯示
                      player?.setPlaylist?.([]);
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

      // 抓取用戶上傳的影片
      getJSON(`/api/user-videos?id=${uid}`)
        .then((val) => {
          const list = pickList(val);
          if (list.length || uploadedVideos.length === 0) setUploadedVideos(list);
        })
        .catch((err) => {
          if (err.name !== 'AbortError') {
            console.warn("[user-videos] failed:", err);
          }
        });

      // 抓取用戶上傳的音樂
      getJSON(`/api/user-music?id=${uid}`)
        .then((val) => {
          const list = pickList(val);
          if (list.length || uploadedMusic.length === 0) setUploadedMusic(list);
        })
        .catch((err) => {
          if (err.name !== 'AbortError') {
            console.warn("[user-music] failed:", err);
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

      // 抓取用戶收藏的影片
      getJSON(`/api/user-liked-videos?id=${uid}`)
        .then((val) => {
          const list = pickList(val);
          if (list.length || likedVideos.length === 0) setLikedVideos(list);
        })
        .catch((err) => {
          if (err.name !== 'AbortError') {
            console.warn("[user-liked-videos] failed:", err);
          }
        });

      // 抓取用戶收藏的音樂
      getJSON(`/api/user-liked-music?id=${uid}`)
        .then((val) => {
          const list = pickList(val);
          if (list.length || likedMusic.length === 0) setLikedMusic(list);
        })
        .catch((err) => {
          if (err.name !== 'AbortError') {
            console.warn("[user-liked-music] failed:", err);
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

  // 取完整圖片/影片資訊並合併（模型/提示詞/生成參數等）
  const enrichImage = async (img) => {
    let full = img;
    
    // 如果是影片，確保作者信息正確
    if (img.type === 'video') {
      try {
        // 確保作者信息完整
        const authorId = typeof full.author === "string" ? full.author : full.author?._id || full.author?.id || full.user?._id || full.user;
        if (authorId && (!full.author || typeof full.author === "string" || !full.author.username)) {
          const u = await axios.get(`/api/user-info?id=${authorId}`);
          if (u?.data) {
            full = { 
              ...full, 
              author: u.data,
              user: u.data // 保持兼容性
            };
          }
        }
      } catch {
        // 靜默失敗
      }
      return full;
    }
    
    // 如果是音樂，直接返回（音樂有自己的處理邏輯）
    if (img.type === 'music') {
      return full;
    }
    
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
    // 如果是音樂類型，設置 selectedMusic
    if (img.type === 'music') {
      setSelectedMusic(img);
      return;
    }
    
    // 圖片和視頻使用原有邏輯
    const enriched = await enrichImage(img);
    setSelectedImage(enriched);
  };

  // 畫面用的過濾清單（混合圖片、影片和音樂）
  const filteredImages = useMemo(() => {
    let base = [];
    
    if (activeTab === "uploads") {
      // 根據類型篩選
      let combinedItems = [];
      
      if (contentTypeFilter === "all") {
        // 全部：混合圖片、影片和音樂
        combinedItems = [
          ...uploadedImages.map(img => ({ ...img, type: 'image' })),
          ...uploadedVideos.map(video => ({ ...video, type: 'video' })),
          ...uploadedMusic.map(music => ({ ...music, type: 'music' }))
        ];
      } else if (contentTypeFilter === "image") {
        // 只顯示圖片
        combinedItems = uploadedImages.map(img => ({ ...img, type: 'image' }));
      } else if (contentTypeFilter === "video") {
        // 只顯示影片
        combinedItems = uploadedVideos.map(video => ({ ...video, type: 'video' }));
      } else if (contentTypeFilter === "music") {
        // 只顯示音樂
        combinedItems = uploadedMusic.map(music => ({ ...music, type: 'music' }));
      }
      
      // 🔧 混合排序：前 3 張最新，其餘隨機排列（避免相似內容聚集）
      if (combinedItems.length > 0) {
        // 先按時間排序
        combinedItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        // 如果項目超過 3 個，將前 3 個保留，其餘隨機排列
        if (combinedItems.length > 3) {
          const pinnedItems = combinedItems.slice(0, 3);
          const restItems = combinedItems.slice(3);
          
          // Fisher-Yates 洗牌算法（隨機排列）
          for (let i = restItems.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [restItems[i], restItems[j]] = [restItems[j], restItems[i]];
          }
          
          base = [...pinnedItems, ...restItems];
        } else {
          base = combinedItems;
        }
      } else {
        base = combinedItems;
      }
    } else {
      // 收藏頁面：根據類型篩選
      let combinedLikedItems = [];
      
      if (contentTypeFilter === "all") {
        // 全部：混合圖片、影片和音樂
        combinedLikedItems = [
          ...likedImages.map(img => ({ ...img, type: 'image' })),
          ...likedVideos.map(video => ({ ...video, type: 'video' })),
          ...likedMusic.map(music => ({ ...music, type: 'music' }))
        ];
      } else if (contentTypeFilter === "image") {
        // 只顯示圖片
        combinedLikedItems = likedImages.map(img => ({ ...img, type: 'image' }));
      } else if (contentTypeFilter === "video") {
        // 只顯示影片
        combinedLikedItems = likedVideos.map(video => ({ ...video, type: 'video' }));
      } else if (contentTypeFilter === "music") {
        // 只顯示音樂
        combinedLikedItems = likedMusic.map(music => ({ ...music, type: 'music' }));
      }
      
      // 🔧 收藏頁面也使用混合排序：前 3 張最新，其餘隨機排列
      if (combinedLikedItems.length > 0) {
        // 先按時間排序
        combinedLikedItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        // 如果項目超過 3 個，將前 3 個保留，其餘隨機排列
        if (combinedLikedItems.length > 3) {
          const pinnedItems = combinedLikedItems.slice(0, 3);
          const restItems = combinedLikedItems.slice(3);
          
          // Fisher-Yates 洗牌算法（隨機排列）
          for (let i = restItems.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [restItems[i], restItems[j]] = [restItems[j], restItems[i]];
          }
          
          base = [...pinnedItems, ...restItems];
        } else {
          base = combinedLikedItems;
        }
      } else {
        base = combinedLikedItems;
      }
    }
    
    const keyword = searchQuery.toLowerCase();
    const selectedRatings = levelFilters.map((label) => labelToRating[label]);

    return base.filter((item) => {
      // 視頻和音樂的評級系統可能不同，需要特殊處理
      let rating = item.rating || "all";
      
      // 如果是視頻，將 sfw 映射到 all，nsfw 映射到 18
      if (item.type === 'video') {
        if (rating === 'sfw') rating = 'all';
        else if (rating === 'nsfw') rating = '18';
      }
      
      const matchLevel =
        selectedRatings.length === 0 ? rating !== "18" : selectedRatings.includes(rating);

      const matchCategory =
        categoryFilters.length === 0 || categoryFilters.includes(item.category);

      const matchSearch =
        keyword === "" ||
        (item.title?.toLowerCase() || "").includes(keyword) ||
        (item.user?.username?.toLowerCase() || "").includes(keyword) ||
        (Array.isArray(item.tags)
          ? item.tags.some((tag) => tag.toLowerCase().includes(keyword))
          : false);

      return matchLevel && matchCategory && matchSearch;
    });
  }, [activeTab, contentTypeFilter, uploadedImages, uploadedVideos, uploadedMusic, likedImages, likedVideos, likedMusic, levelFilters, categoryFilters, searchQuery]);

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
        pageHasPlayer={
          !!userData?.miniPlayerPurchased || 
          (userData?.playerCouponUsed && 
           userData?.miniPlayerExpiry && 
           new Date(userData.miniPlayerExpiry) > new Date())
        }
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
            onClick={() => {
              setActiveTab("uploads");
              setContentTypeFilter("all"); // 重置為全部
            }}
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
            onClick={() => {
              setActiveTab("likes");
              setContentTypeFilter("all"); // 重置為全部
            }}
          >
            <span className="hidden sm:inline">❤️ 收藏</span>
            <span className="sm:hidden">❤️ 收藏</span>
          </button>
        </div>

        {/* 類型篩選（在上傳作品和收藏標籤頁都顯示） */}
        <div className="flex gap-2 mb-4 md:mb-6 px-2 md:px-0 overflow-x-auto">
          <button
            className={`flex-shrink-0 px-3 py-2 rounded-lg font-medium transition text-sm ${
              contentTypeFilter === "all"
                ? "bg-blue-600 text-white"
                : "bg-zinc-700 text-white hover:bg-zinc-600"
            }`}
            onClick={() => setContentTypeFilter("all")}
          >
            全部
          </button>
          <button
            className={`flex-shrink-0 px-3 py-2 rounded-lg font-medium transition text-sm ${
              contentTypeFilter === "image"
                ? "bg-blue-600 text-white"
                : "bg-zinc-700 text-white hover:bg-zinc-600"
            }`}
            onClick={() => setContentTypeFilter("image")}
          >
            圖片
          </button>
          <button
            className={`flex-shrink-0 px-3 py-2 rounded-lg font-medium transition text-sm ${
              contentTypeFilter === "video"
                ? "bg-blue-600 text-white"
                : "bg-zinc-700 text-white hover:bg-zinc-600"
            }`}
            onClick={() => setContentTypeFilter("video")}
          >
            影片
          </button>
          <button
            className={`flex-shrink-0 px-3 py-2 rounded-lg font-medium transition text-sm ${
              contentTypeFilter === "music"
                ? "bg-blue-600 text-white"
                : "bg-zinc-700 text-white hover:bg-zinc-600"
            }`}
            onClick={() => setContentTypeFilter("music")}
          >
            音樂
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

        {selectedMusic && (
          <MusicModal
            music={selectedMusic}
            currentUser={currentUser}
            displayMode="gallery"
            onClose={() => setSelectedMusic(null)}
            onUserClick={() => {
              const authorId = selectedMusic?.author?._id || selectedMusic?.author;
              if (authorId) {
                router.push(`/user/${authorId}`);
              }
            }}
            onDelete={async (musicId) => {
              try {
                const response = await fetch(`/api/music/${musicId}/delete`, {
                  method: 'DELETE',
                });

                if (response.ok) {
                  // 從列表中移除音樂
                  setUploadedMusic(prev => prev.filter(m => m._id !== musicId));
                  // 關閉 Modal
                  setSelectedMusic(null);
                  console.log('✅ 音樂刪除成功');
                } else {
                  const error = await response.json();
                  console.error('❌ 刪除音樂失敗:', error);
                  notify.error('刪除失敗', error.error || '未知錯誤');
                }
              } catch (error) {
                console.error('❌ 刪除音樂錯誤:', error);
                notify.error('刪除失敗', '請稍後再試');
              }
            }}
            canEdit={currentUser && selectedMusic?.author?._id && String(currentUser._id) === String(selectedMusic.author._id)}
            onEdit={() => {
              setEditingMusic(selectedMusic);
              setShowEditMusicModal(true);
            }}
            isLiked={
              Array.isArray(selectedMusic?.likes) && currentUser?._id
                ? selectedMusic.likes.includes(currentUser._id)
                : false
            }
            onToggleLike={async (musicId) => {
              try {
                const response = await fetch(`/api/music/${musicId}/like`, {
                  method: "POST",
                });
                if (response.ok) {
                  const data = await response.json();
                  setSelectedMusic({
                    ...selectedMusic,
                    likes: data.likes,
                    likesCount: data.likesCount,
                  });
                  
                  // 更新上傳音樂列表
                  setUploadedMusic(prev =>
                    prev.map((m) =>
                      m._id === musicId
                        ? { ...m, likes: data.likes, likesCount: data.likesCount }
                        : m
                    )
                  );
                  
                  // 更新收藏音樂列表
                  const isLiked = Array.isArray(data.likes) && currentUser?._id
                    ? data.likes.includes(currentUser._id)
                    : false;
                  
                  if (isLiked) {
                    // 如果已收藏，確保在收藏列表中
                    setLikedMusic(prev => {
                      const exists = prev.some(m => m._id === musicId);
                      if (!exists && selectedMusic) {
                        return [...prev, { ...selectedMusic, likes: data.likes, likesCount: data.likesCount }];
                      }
                      return prev.map((m) =>
                        m._id === musicId
                          ? { ...m, likes: data.likes, likesCount: data.likesCount }
                          : m
                      );
                    });
                  } else {
                    // 如果取消收藏，從收藏列表中移除
                    setLikedMusic(prev => prev.filter(m => m._id !== musicId));
                    // 如果在收藏頁面且取消收藏，關閉 Modal
                    if (activeTab === "likes") {
                      setSelectedMusic(null);
                    }
                  }
                }
              } catch (error) {
                console.error("切換愛心失敗:", error);
              }
            }}
          />
        )}

        {selectedImage && (
          selectedImage.type === 'video' ? (
            <VideoModal
              video={selectedImage}
              currentUser={currentUser}
              displayMode="gallery"
              onClose={() => setSelectedImage(null)}
              onUserClick={() => {
                const authorId = selectedImage?.author?._id || selectedImage?.author;
                if (authorId) {
                  router.push(`/user/${authorId}`);
                }
              }}
              onDelete={async (videoId) => {
                try {
                  const response = await fetch(`/api/videos/${videoId}/delete`, {
                    method: 'DELETE',
                  });

                  if (response.ok) {
                    // 從列表中移除影片
                    setUploadedVideos(prev => prev.filter(v => v._id !== videoId));
                    setLikedVideos(prev => prev.filter(v => v._id !== videoId));
                    // 關閉 Modal
                    setSelectedImage(null);
                    console.log('✅ 影片刪除成功');
                  } else {
                    const error = await response.json();
                    console.error('❌ 刪除影片失敗:', error);
                    notify.error('刪除失敗', error.error || '未知錯誤');
                  }
                } catch (error) {
                  console.error('❌ 刪除影片錯誤:', error);
                  notify.error('刪除失敗', '請稍後再試');
                }
              }}
              canEdit={currentUser && selectedImage?.author?._id && String(currentUser._id) === String(selectedImage.author._id)}
              onEdit={() => {
                setShowEditVideoModal(true);
              }}
              onLikeUpdate={(updated) => {
                onLikeUpdate(updated);
                setSelectedImage(updated);
              }}
            />
          ) : (
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
          )
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

      {/* 編輯影片 Modal */}
      {showEditVideoModal && selectedImage?.type === 'video' && (
        <EditVideoModal
          video={selectedImage}
          isOpen={showEditVideoModal}
          onClose={() => setShowEditVideoModal(false)}
          onSuccess={(updatedVideo) => {
            // 更新影片列表中的資料
            if (activeTab === "uploads") {
              setUploadedVideos(prev => prev.map(v => 
                v._id === updatedVideo._id ? updatedVideo : v
              ));
            } else {
              setLikedVideos(prev => prev.map(v => 
                v._id === updatedVideo._id ? updatedVideo : v
              ));
            }
            // 更新選中的影片
            setSelectedImage(updatedVideo);
            // 關閉編輯 Modal
            setShowEditVideoModal(false);
          }}
        />
      )}

      {/* 編輯音樂 Modal */}
      {showEditMusicModal && editingMusic && (
        <EditMusicModal
          music={editingMusic}
          isOpen={showEditMusicModal}
          onClose={() => {
            setShowEditMusicModal(false);
            setEditingMusic(null);
          }}
          onMusicUpdated={(updatedMusic) => {
            // 更新音樂列表中的資料
            setUploadedMusic(prev => prev.map(m => 
              m._id === updatedMusic._id ? updatedMusic : m
            ));
            // 更新選中的音樂
            setSelectedMusic(updatedMusic);
            // 關閉編輯 Modal
            setShowEditMusicModal(false);
            setEditingMusic(null);
          }}
        />
      )}
    </>
  );
}
