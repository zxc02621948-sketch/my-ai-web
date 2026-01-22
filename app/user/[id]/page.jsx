"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import axios from "axios";
import { useParams, useSearchParams, useRouter, usePathname } from "next/navigation";
// ✅ 性能優化：使用動態導入延遲加載非關鍵組件，減少初始包大小
import dynamic from "next/dynamic";
import UserHeader from "@/components/user/UserHeader";
import UserImageGrid from "@/components/user/UserImageGrid";
import { useFilterContext } from "@/components/context/FilterContext";
import useLikeHandler from "@/hooks/useLikeHandler";
import { usePlayer } from "@/components/context/PlayerContext";
import { useCurrentUser } from "@/contexts/CurrentUserContext";
import { notify } from "@/components/common/GlobalNotificationManager";
import { readPinnedPlayerCache } from "@/utils/pinnedPlayerCache";

// 動態導入 Modal 組件（只在需要時加載）
const ImageModal = dynamic(() => import("@/components/image/ImageModal"), { ssr: false });
const VideoModal = dynamic(() => import("@/components/video/VideoModal"), { ssr: false });
const EditVideoModal = dynamic(() => import("@/components/video/EditVideoModal"), { ssr: false });
const MusicModal = dynamic(() => import("@/components/music/MusicModal"), { ssr: false });
const EditMusicModal = dynamic(() => import("@/components/music/EditMusicModal"), { ssr: false });
const UserEditModal = dynamic(() => import("@/components/user/UserEditModal"), { ssr: false });
const PointsHistoryModal = dynamic(() => import("@/components/user/PointsHistoryModal"), { ssr: false });
const PointsStoreModal = dynamic(() => import("@/components/user/PointsStoreModal"), { ssr: false });
const PowerCouponModal = dynamic(() => import("@/components/user/PowerCouponModal"), { ssr: false });
const UnpinReminderModal = dynamic(() => import("@/components/player/UnpinReminderModal"), { ssr: false });
// 重複 import 修正：axios 已在檔案頂部引入

const labelToRating = {
  "一般圖片": "all",
  "15+ 圖片": "15",
  "18+ 圖片": "18",
};

// ✅ 共用工具：判斷目前是否有有效的釘選播放器
const hasActivePinnedGlobal = (currentUser) => {
  if (typeof window === "undefined") return false;
  try {
    const pinnedFromUser = currentUser?.pinnedPlayer;
    const cached = readPinnedPlayerCache();
    const pinned = pinnedFromUser || cached;
    if (!pinned || !pinned.userId) return false;
    if (!pinned.expiresAt) return true;
    return new Date(pinned.expiresAt) > new Date();
  } catch {
    return false;
  }
};

export default function UserProfilePage() {
  const { id } = useParams();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const player = usePlayer();
  const { currentUser, setCurrentUser } = useCurrentUser(); // 使用 Context
  
  // ✅ 性能優化：使用 requestAnimationFrame 避免強制重排
  useEffect(() => {
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
    });
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
  const pinnedPlaylistLoadedRef = useRef(null); // 追踪已載入的釘選播放清單，避免重複載入

  // ✅ 當頁面 ID 改變時，清除播放清單載入標記
  useEffect(() => {
    if (lastPageIdRef.current !== id) {
      playlistLoadedRef.current = null;
      pinnedPlaylistLoadedRef.current = null; // 同時清除釘選播放清單載入標記
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

  // ✅ 修復：監聽路由變化，確保頁面切換時關閉彈窗並恢復頁面狀態
  useEffect(() => {
    // 當路由變化時，強制關閉所有彈窗並恢復頁面狀態
    if (selectedMusic || selectedImage) {
      setSelectedMusic(null);
      setSelectedImage(null);
      // 確保恢復 body 滾動
      document.body.style.overflow = "";
    }
  }, [pathname]);

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
    // ✅ 如果目前登入用戶有有效的釘選播放器，優先讓釘選維持顯示，不要被個人頁面的權限關掉
    const hasActivePinned = hasActivePinnedGlobal(currentUser);

    // ✅ 檢查頁面主人是否有有效的播放器功能（購買或體驗券未過期）
    const hasValidPlayer =
      !!userData?.miniPlayerPurchased ||
      (userData?.playerCouponUsed &&
        userData?.miniPlayerExpiry &&
        new Date(userData.miniPlayerExpiry) > new Date());

    // ✅ 只要登入用戶有有效的釘選，就保持播放器啟用（交由釘選系統控制）
    if (hasActivePinned) {
      try {
        player?.setMiniPlayerEnabled?.(true);
      } catch {}
      return;
    }

    // ✅ 否則才依照頁面主人的播放器權限決定是否顯示
    if (hasValidPlayer) {
      try {
        player?.setMiniPlayerEnabled?.(true);
        player?.setShareMode?.("page");
      } catch {}
    } else {
      try {
        player?.setMiniPlayerEnabled?.(false);
      } catch {}
    }
  }, [
    userData?.miniPlayerPurchased,
    userData?.playerCouponUsed,
    userData?.miniPlayerExpiry,
    currentUser?.pinnedPlayer?.userId,
    currentUser?.pinnedPlayer?.expiresAt,
  ]); // 依賴播放器權限與釘選狀態
  
  // ✅ 設置頁面主人的播放器造型信息（獨立的 useEffect，避免循環）
  useEffect(() => {
    if (userData) {
      // ✅ 只有在頁面主人「真的有播放器權限」時，才套用 pageOwnerSkin
      const hasValidPlayer =
        !!userData?.miniPlayerPurchased ||
        (userData?.playerCouponUsed &&
          userData?.miniPlayerExpiry &&
          new Date(userData.miniPlayerExpiry) > new Date());

      if (!hasValidPlayer) {
        // 頁主尚未解鎖播放器：不要覆蓋目前登入者的皮膚
        try {
          player?.setPageOwnerSkin?.(null);
        } catch {}
        return;
      }

      try {
        player?.setPageOwnerSkin?.({
          activePlayerSkin: userData.activePlayerSkin || "default",
          playerSkinSettings: userData.playerSkinSettings || {
            mode: "rgb",
            speed: 0.02,
            saturation: 50,
            lightness: 60,
            hue: 0,
            opacity: 0.7,
          },
          premiumPlayerSkin: !!userData.premiumPlayerSkin,
        });
      } catch {}
    } else {
      // 清除頁面主人的造型信息
      try {
        player?.setPageOwnerSkin?.(null);
      } catch {}
    }
  }, [
    userData?.activePlayerSkin,
    userData?.playerSkinSettings,
    userData?.premiumPlayerSkin,
    userData?.miniPlayerPurchased,
    userData?.playerCouponUsed,
    userData?.miniPlayerExpiry,
    userData?._id,
  ]); // 使用 _id 作為穩定的依賴，並僅在頁主有播放器權限時套用造型

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

  // 🔔 監聽圖片上傳成功事件，刷新個人頁面的圖片列表
  useEffect(() => {
    const onImageUploaded = async (e) => {
      const { userId: uploadedUserId, imageId: uploadedImageId } = e.detail || {};
      if (!uploadedUserId || !uploadedImageId) return;

      // ✅ 檢查是否為當前用戶的個人頁面
      const currentUserId = id;
      const isMatch = String(uploadedUserId) === String(currentUserId) || 
                     (userData && String(uploadedUserId) === String(userData._id));
      
      if (!isMatch) return;

      console.log("✅ 檢測到新上傳的圖片，刷新列表:", { uploadedUserId, uploadedImageId, currentUserId });

      // ✅ 重新加載圖片列表
      try {
        const getJSON = async (url) => {
          const r = await fetch(url, { cache: "no-store" });
          if (!r.ok) {
            const text = await r.text().catch(() => "");
            throw new Error(`${url} -> HTTP ${r.status}${text ? ` | ${text.slice(0, 160)}` : ""}`);
          }
          return r.json();
        };

        const val = await getJSON(`/api/user-images?id=${currentUserId}`);
        const list = pickList(val);
        setUploadedImages(list);
        console.log("✅ 圖片列表已刷新，新圖片數量:", list.length);
      } catch (err) {
        const isAbortError = err.name === 'AbortError' || 
                             err.name === 'DOMException' ||
                             err.message?.includes('abort') ||
                             err.message?.includes('Component unmounted');
        if (!isAbortError) {
          console.warn("[user-images] 刷新失敗:", err);
        }
      }
    };

    window.addEventListener("image-uploaded", onImageUploaded);
    return () => window.removeEventListener("image-uploaded", onImageUploaded);
  }, [id, userData]);

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

  // ✅ 當 currentUser 加載完成後，檢查並載入釘選播放清單（解決刷新後 currentUser 未加載導致的問題）
  useEffect(() => {
    if (!currentUser || currentUser === undefined) return;
    if (!id || id === "undefined") return;
    
    const pinned = currentUser.pinnedPlayer;
    if (!pinned?.userId) return;
    
    // 檢查是否過期
    const now = new Date();
    if (pinned.expiresAt && new Date(pinned.expiresAt) <= now) return;
    
    const pinnedUserIdStr = pinned.userId?.toString() || '';
    const currentPageIdStr = String(id || '');
    
    // 如果釘選的不是當前頁面，且還沒有載入過，才載入釘選用戶的播放清單
    if (pinnedUserIdStr && pinnedUserIdStr !== currentPageIdStr) {
      // ✅ 檢查是否已經載入過（避免重複載入）
      const loadKey = `${pinnedUserIdStr}-${currentPageIdStr}`;
      if (pinnedPlaylistLoadedRef.current === loadKey) return;
      
      pinnedPlaylistLoadedRef.current = loadKey;
      
      const loadPinnedPlaylist = async () => {
        try {
          const response = await fetch(`/api/user-info?id=${encodeURIComponent(pinnedUserIdStr)}`, { cache: "no-store" });
          if (!response.ok) return;
          
          const userInfo = await response.json();
          const pinnedPicked = pickUser(userInfo);
          const pinnedPlaylist = Array.isArray(pinnedPicked?.playlist) && pinnedPicked.playlist.length > 0 ? pinnedPicked.playlist : [];
          
          // ✅ 設置釘選用戶的 playerOwner
          if (pinnedPicked?.username) {
            const pinnedAllowShuffle = typeof pinnedPicked?.playlistAllowShuffle === "boolean" ? pinnedPicked.playlistAllowShuffle : null;
            player?.setPlayerOwner?.({
              userId: pinnedUserIdStr,
              username: pinnedPicked.username,
              ...(typeof pinnedAllowShuffle === "boolean" ? { allowShuffle: pinnedAllowShuffle } : {}),
            });
          }
          
          // ✅ 載入釘選用戶的播放清單
          if (pinnedPlaylist.length > 0) {
            const firstItem = pinnedPlaylist[0];
            const firstUrl = String(firstItem.url || "");
            const firstTitle = String(firstItem.title || firstUrl);
            
            if (firstUrl) {
              // ✅ 先設置播放清單和 activeIndex，確保播放器狀態正確
              player?.setPlaylist?.(pinnedPlaylist);
              player?.setActiveIndex?.(0);
              
              // ✅ 使用 setTimeout 確保播放器組件已經準備好後再設置 src 和 originUrl
              setTimeout(() => {
                player?.setSrc?.(firstUrl);
                player?.setOriginUrl?.(firstUrl);
                player?.setTrackTitle?.(firstTitle);
              }, 0);
            }
          } else {
            // ✅ 即使沒有播放清單，也設置空的播放清單
            player?.setPlaylist?.([]);
          }
        } catch (error) {
          console.error('[個人頁面] 延遲載入釘選播放清單錯誤:', error);
          pinnedPlaylistLoadedRef.current = null; // 載入失敗時重置，允許重試
        }
      };
      
      loadPinnedPlaylist();
    } else {
      // 如果釘選的是當前頁面或沒有釘選，重置載入標記
      pinnedPlaylistLoadedRef.current = null;
    }
  }, [currentUser?.pinnedPlayer?.userId, currentUser?.pinnedPlayer?.expiresAt, id]);

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

  // ✅ 監聽用戶數據更新事件（如購買高階播放器造型），立即更新個人頁數據
  useEffect(() => {
    const onUserDataUpdated = async (e) => {
      const { premiumPlayerSkin, activePlayerSkin } = e.detail || {};
      
      // 只更新當前用戶自己的頁面
      const viewingByUsername = !!currentUser && String(id) === String(currentUser?.username);
      const viewingById =
        !!currentUser &&
        (String(id) === String(currentUser?._id) || String(id) === String(currentUser?.id));
      
      if (!viewingByUsername && !viewingById) return; // 不是自己的頁面，不更新
      
      // 如果購買了高階播放器造型，重新獲取用戶數據
      if (premiumPlayerSkin) {
        try {
          const uid = encodeURIComponent(id);
          const userJson = await fetch(`/api/user-info?id=${uid}`, { cache: "no-store" }).then(r => r.json()).catch(() => null);
          if (userJson) {
            const picked = pickUser(userJson);
            setUserData(picked);
          }
        } catch (error) {
          console.error("更新用戶數據失敗:", error);
        }
      }
    };
    window.addEventListener("user-data-updated", onUserDataUpdated);
    return () => window.removeEventListener("user-data-updated", onUserDataUpdated);
  }, [id, currentUser?._id, currentUser?.username]);

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

          // ✅ 檢查目前是否有有效的釘選播放器（同時考慮 currentUser 與快取）
          const hasActivePinned = hasActivePinnedGlobal(currentUser);

          // ✅ 檢查頁面主人是否有有效的播放器功能（購買或體驗券未過期）
          const hasValidPlayer =
            !!picked?.miniPlayerPurchased ||
            (picked?.playerCouponUsed &&
              picked?.miniPlayerExpiry &&
              new Date(picked.miniPlayerExpiry) > new Date());
          
          // ✅ 釘選優先：只要登入用戶有有效釘選，就保持播放器啟用，不受頁面主人權限影響
          if (hasActivePinned) {
            try {
              player?.setMiniPlayerEnabled?.(true);
            } catch {}
          } else if (hasValidPlayer) {
            // ✅ 否則才依照頁面主人的播放器權限決定是否顯示
            try {
              player?.setMiniPlayerEnabled?.(true);
              player?.setShareMode?.("page");
              localStorage.setItem(
                "miniPlayerTheme",
                String(picked?.miniPlayerTheme || "modern"),
              );
            } catch {}
          } else {
            try {
              player?.setMiniPlayerEnabled?.(false);
            } catch {}
          }

          try {
    const u = picked || {};
    
    // ✅ 優先從數據庫讀取播放清單（這樣訪客也能聽到作者的音樂）
    const userPlaylist = Array.isArray(u.playlist) && u.playlist.length > 0 ? u.playlist : [];
    
    // ✅ 只有已登入用戶才檢查釘選播放器（未登入或載入中時跳過釘選檢查）
    let hasPinnedPlayer = false;
    let isPinnedThisPage = false;
    let currentUserPinnedPlayer = null;
    let pinnedUserIdStr = '';
    let currentPageIdStr = String(id || '');
    
    // ✅ 只有在 currentUser 已載入完成（不是 undefined）且不是 null 時才檢查釘選
    if (currentUser !== undefined && currentUser !== null) {
      currentUserPinnedPlayer = currentUser.pinnedPlayer;
      hasPinnedPlayer = currentUserPinnedPlayer?.userId && 
        currentUserPinnedPlayer?.expiresAt && 
        new Date(currentUserPinnedPlayer.expiresAt) > new Date();
      
      // ✅ 轉換為字符串進行比較（確保 ObjectId 和 string 可以正確比較）
      pinnedUserIdStr = currentUserPinnedPlayer?.userId?.toString() || '';
      isPinnedThisPage = pinnedUserIdStr === currentPageIdStr;
    }
    
    // ✅ 如果有釘選 + 釘選的不是當前頁面 → 載入釘選用戶的播放清單
    if (hasPinnedPlayer && !isPinnedThisPage) {
      // ✅ 從數據庫載入釘選用戶的播放清單，確保刷新後也能正常播放
      try {
        const pinnedUserInfo = await getJSON(`/api/user-info?id=${encodeURIComponent(pinnedUserIdStr)}`).catch(() => null);
        if (pinnedUserInfo) {
          const pinnedPicked = pickUser(pinnedUserInfo);
          const pinnedPlaylist = Array.isArray(pinnedPicked?.playlist) && pinnedPicked.playlist.length > 0 ? pinnedPicked.playlist : [];
          
          // ✅ 設置釘選用戶的 playerOwner
          if (pinnedPicked?.username) {
            const pinnedAllowShuffle = typeof pinnedPicked?.playlistAllowShuffle === "boolean" ? pinnedPicked.playlistAllowShuffle : null;
            player?.setPlayerOwner?.({
              userId: pinnedUserIdStr,
              username: pinnedPicked.username,
              ...(typeof pinnedAllowShuffle === "boolean" ? { allowShuffle: pinnedAllowShuffle } : {}),
            });
          }
          
          // ✅ 載入釘選用戶的播放清單
          if (pinnedPlaylist.length > 0) {
            const firstItem = pinnedPlaylist[0];
            const firstUrl = String(firstItem.url || "");
            const firstTitle = String(firstItem.title || firstUrl);
            
            if (firstUrl) {
              // ✅ 先設置播放清單和 activeIndex，確保播放器狀態正確
              player?.setPlaylist?.(pinnedPlaylist);
              player?.setActiveIndex?.(0);
              
              // ✅ 使用 setTimeout 確保播放器組件已經準備好後再設置 src 和 originUrl
              setTimeout(() => {
                player?.setSrc?.(firstUrl);
                player?.setOriginUrl?.(firstUrl);
                player?.setTrackTitle?.(firstTitle);
              }, 0);
            }
          } else {
            // ✅ 即使沒有播放清單，也設置空的播放清單
            player?.setPlaylist?.([]);
          }
        }
      } catch (error) {
        console.error('[個人頁面] 載入釘選播放清單錯誤:', error);
      }
    }
    // ✅ 如果沒有釘選 OR 釘選的就是當前頁面 → 設置當前頁面的播放器信息
    // ✅ 即使沒有播放清單，也應該設置 playerOwner 和空播放清單（只要用戶有權限）
    else {
      // ✅ 再次檢查 currentUser 是否已加載（防止在 currentUser 加載前就設置了當前頁面的播放清單）
      // 如果 currentUser 還在加載中（undefined），且當前頁面播放清單為空，則不設置播放清單
      // 等待 currentUser 加載完成後，由上面的 useEffect 來決定是否載入釘選播放清單
      const shouldSetCurrentPagePlaylist = currentUser !== undefined || userPlaylist.length > 0;
      
      if (shouldSetCurrentPagePlaylist) {
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
            // ✅ 先設置播放清單和 activeIndex，確保播放器狀態正確
            player?.setPlaylist?.(userPlaylist);
            player?.setActiveIndex?.(0);
            
            // ✅ 使用 setTimeout 確保播放器組件已經準備好後再設置 src 和 originUrl
            setTimeout(() => {
              player?.setSrc?.(firstUrl);
              player?.setOriginUrl?.(firstUrl);
              player?.setTrackTitle?.(firstTitle);
            }, 0);
          }
        } else {
          // ✅ 只有在 currentUser 已加載完成且確認沒有釘選播放器時，才設置空的播放清單
          // 如果 currentUser 還在加載中，不設置空播放清單，等待 currentUser 加載完成後再決定
          if (currentUser !== undefined) {
            player?.setPlaylist?.([]);
          }
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

              // ✅ 檢查目前是否有有效的釘選播放器（同時考慮 currentUser 與快取）
              const hasActivePinned = hasActivePinnedGlobal(currentUser);

              // ✅ 檢查頁面主人是否有有效的播放器功能（購買或體驗券未過期）
              const hasBackupValidPlayer =
                !!backup?.miniPlayerPurchased ||
                (backup?.playerCouponUsed &&
                  backup?.miniPlayerExpiry &&
                  new Date(backup.miniPlayerExpiry) > new Date());
              
              // ✅ 釘選優先：只要登入用戶有有效釘選，就保持播放器啟用
              if (hasActivePinned) {
                try {
                  player?.setMiniPlayerEnabled?.(true);
                } catch {}
              } else if (hasBackupValidPlayer) {
                // ✅ 否則才依照頁面主人的播放器權限決定是否顯示
                try {
                  player?.setMiniPlayerEnabled?.(true);
                  player?.setShareMode?.("page");
                  localStorage.setItem(
                    "miniPlayerTheme",
                    String(backup?.miniPlayerTheme || "modern"),
                  );
                } catch {}
              } else {
                try {
                  player?.setMiniPlayerEnabled?.(false);
                } catch {}
              }
              // 同步載入使用者預設音樂（即使走備援資料流也要載入）
              try {
                // ✅ 優先從數據庫讀取播放清單（備援流程）
                const userPlaylist = Array.isArray(backup.playlist) && backup.playlist.length > 0 ? backup.playlist : [];
                
                // ✅ 只有已登入用戶才檢查釘選播放器（未登入或載入中時跳過釘選檢查）
                let hasPinnedPlayer = false;
                let isPinnedThisPage = false;
                let currentUserPinnedPlayer = null;
                let pinnedUserIdStr = '';
                let currentPageIdStr = String(id || '');
                
                // ✅ 只有在 currentUser 已載入完成（不是 undefined）且不是 null 時才檢查釘選
                if (currentUser !== undefined && currentUser !== null) {
                  currentUserPinnedPlayer = currentUser.pinnedPlayer;
                  hasPinnedPlayer = currentUserPinnedPlayer?.userId && 
                    currentUserPinnedPlayer?.expiresAt && 
                    new Date(currentUserPinnedPlayer.expiresAt) > new Date();
                  
                  // ✅ 轉換為字符串進行比較（確保 ObjectId 和 string 可以正確比較）
                  pinnedUserIdStr = currentUserPinnedPlayer?.userId?.toString() || '';
                  isPinnedThisPage = pinnedUserIdStr === currentPageIdStr;
                }
                
                // ✅ 如果有釘選 + 釘選的不是當前頁面 → 載入釘選用戶的播放清單
                if (hasPinnedPlayer && !isPinnedThisPage) {
                  // ✅ 從數據庫載入釘選用戶的播放清單，確保刷新後也能正常播放
                  try {
                    const pinnedUserInfo = await getJSON(`/api/user-info?id=${encodeURIComponent(pinnedUserIdStr)}`).catch(() => null);
                    if (pinnedUserInfo) {
                      const pinnedPicked = pickUser(pinnedUserInfo);
                      const pinnedPlaylist = Array.isArray(pinnedPicked?.playlist) && pinnedPicked.playlist.length > 0 ? pinnedPicked.playlist : [];
                      
                      // ✅ 設置釘選用戶的 playerOwner
                      if (pinnedPicked?.username) {
                        const pinnedAllowShuffle = typeof pinnedPicked?.playlistAllowShuffle === "boolean" ? pinnedPicked.playlistAllowShuffle : null;
                        player?.setPlayerOwner?.({
                          userId: pinnedUserIdStr,
                          username: pinnedPicked.username,
                          ...(typeof pinnedAllowShuffle === "boolean" ? { allowShuffle: pinnedAllowShuffle } : {}),
                        });
                      }
                      
                      // ✅ 載入釘選用戶的播放清單
                      if (pinnedPlaylist.length > 0) {
                        const firstItem = pinnedPlaylist[0];
                        const firstUrl = String(firstItem.url || "");
                        const firstTitle = String(firstItem.title || firstUrl);
                        
                        if (firstUrl) {
                          // ✅ 先設置播放清單和 activeIndex，確保播放器狀態正確
                          player?.setPlaylist?.(pinnedPlaylist);
                          player?.setActiveIndex?.(0);
                          
                          // ✅ 使用 setTimeout 確保播放器組件已經準備好後再設置 src 和 originUrl
                          setTimeout(() => {
                            player?.setSrc?.(firstUrl);
                            player?.setOriginUrl?.(firstUrl);
                            player?.setTrackTitle?.(firstTitle);
                          }, 0);
                        }
                      } else {
                        // ✅ 即使沒有播放清單，也設置空的播放清單
                        player?.setPlaylist?.([]);
                      }
                    }
                  } catch (error) {
                    console.error('[個人頁面] 載入釘選播放清單錯誤（備援流程）:', error);
                  }
                }
                // ✅ 如果沒有釘選 OR 釘選的就是當前頁面 → 設置當前頁面的播放器信息
                // ✅ 即使沒有播放清單，也應該設置 playerOwner 和空播放清單（只要用戶有權限）
                else {
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
                      // ✅ 先設置播放清單和 activeIndex，確保播放器狀態正確
                      player?.setPlaylist?.(userPlaylist);
                      player?.setActiveIndex?.(0);
                      
                      // ✅ 使用 setTimeout 確保播放器組件已經準備好後再設置 src 和 originUrl
                      setTimeout(() => {
                        player?.setSrc?.(firstUrl);
                        player?.setOriginUrl?.(firstUrl);
                        player?.setTrackTitle?.(firstTitle);
                      }, 0);
                    }
                  } else {
                    // ✅ 沒有播放清單：設置空清單即可（不再支援單首預設音樂 URL）
                    player?.setPlaylist?.([]);
                  }
                }
              } catch {}
            } else {
              setUserData({ _id: uid, pointsBalance: 0 });
              // 找不到使用者時不啟用播放器（需購買才顯示），但保留有效的釘選播放器
              const hasActivePinned = hasActivePinnedGlobal(currentUser);
              if (!hasActivePinned) {
                try {
                  player?.setMiniPlayerEnabled?.(false);
                } catch {}
              }
            }
          } catch (e) {
            setUserData({ _id: uid, pointsBalance: 0 });
            const hasActivePinned = hasActivePinnedGlobal(currentUser);
            if (!hasActivePinned) {
              try {
                player?.setMiniPlayerEnabled?.(false);
              } catch {}
            }
          }
        }
      } catch (e) {
        console.error('🔧 [最外層錯誤] 用戶資料載入失敗:', e);
        setUserData({ _id: uid, pointsBalance: 0 });
        const hasActivePinned = hasActivePinnedGlobal(currentUser);
        if (!hasActivePinned) {
          try {
            player?.setMiniPlayerEnabled?.(false);
          } catch {}
        }
      }

      // ✅ 優化：按需加載 - 先加載當前 tab 的數據，其他數據延遲加載
      // 並行抓取上傳清單（uploads tab 的數據）
      const loadUploadsData = () => {
        getJSON(`/api/user-images?id=${uid}`)
          .then((val) => {
            const list = pickList(val);
            // ✅ 使用函數式更新，避免依賴 uploadedImages 狀態
            // ✅ 修復：總是更新數據，確保數據同步
            setUploadedImages((prev) => {
              // 如果新數據為空且舊數據不為空，可能是 API 錯誤，保留舊數據
              // 否則總是使用新數據
              if (list.length === 0 && prev.length > 0) {
                return prev;
              }
              return list;
            });
          })
          .catch((err) => {
            // ✅ 忽略所有取消相關的錯誤（AbortError、DOMException、或包含 abort 消息的錯誤）
            const isAbortError = err.name === 'AbortError' || 
                                 err.name === 'DOMException' ||
                                 err.message?.includes('abort') ||
                                 err.message?.includes('Component unmounted');
            if (!isAbortError) {
              console.warn("[user-images] failed:", err);
            }
          });

        // 抓取用戶上傳的影片
        getJSON(`/api/user-videos?id=${uid}`)
          .then((val) => {
            const list = pickList(val);
            // ✅ 使用函數式更新，避免依賴 uploadedVideos 狀態
            setUploadedVideos((prev) => {
              if (list.length > 0 || prev.length === 0) {
                return list;
              }
              return prev;
            });
          })
          .catch((err) => {
            const isAbortError = err.name === 'AbortError' || 
                                 err.name === 'DOMException' ||
                                 err.message?.includes('abort') ||
                                 err.message?.includes('Component unmounted');
            if (!isAbortError) {
              console.warn("[user-videos] failed:", err);
            }
          });

        // 抓取用戶上傳的音樂
        getJSON(`/api/user-music?id=${uid}`)
          .then((val) => {
            const list = pickList(val);
            // ✅ 使用函數式更新，避免依賴 uploadedMusic 狀態
            setUploadedMusic((prev) => {
              if (list.length > 0 || prev.length === 0) {
                return list;
              }
              return prev;
            });
          })
          .catch((err) => {
            const isAbortError = err.name === 'AbortError' || 
                                 err.name === 'DOMException' ||
                                 err.message?.includes('abort') ||
                                 err.message?.includes('Component unmounted');
            if (!isAbortError) {
              console.warn("[user-music] failed:", err);
            }
          });
      };

      // 加載收藏清單（likes tab 的數據）
      const loadLikesData = () => {
        getJSON(`/api/user-liked-images?id=${uid}`)
          .then((val) => {
            const list = pickList(val);
            // ✅ 使用函數式更新，避免依賴 likedImages 狀態
            setLikedImages((prev) => {
              if (list.length > 0 || prev.length === 0) {
                return list;
              }
              return prev;
            });
          })
          .catch((err) => {
            const isAbortError = err.name === 'AbortError' || 
                                 err.name === 'DOMException' ||
                                 err.message?.includes('abort') ||
                                 err.message?.includes('Component unmounted');
            if (!isAbortError) {
              console.warn("[user-liked-images] failed:", err);
            }
          });

        // 抓取用戶收藏的影片
        getJSON(`/api/user-liked-videos?id=${uid}`)
          .then((val) => {
            const list = pickList(val);
            // ✅ 使用函數式更新，避免依賴 likedVideos 狀態
            setLikedVideos((prev) => {
              if (list.length > 0 || prev.length === 0) {
                return list;
              }
              return prev;
            });
          })
          .catch((err) => {
            const isAbortError = err.name === 'AbortError' || 
                                 err.name === 'DOMException' ||
                                 err.message?.includes('abort') ||
                                 err.message?.includes('Component unmounted');
            if (!isAbortError) {
              console.warn("[user-liked-videos] failed:", err);
            }
          });

        // 抓取用戶收藏的音樂
        getJSON(`/api/user-liked-music?id=${uid}`)
          .then((val) => {
            const list = pickList(val);
            // ✅ 使用函數式更新，避免依賴 likedMusic 狀態
            setLikedMusic((prev) => {
              if (list.length > 0 || prev.length === 0) {
                return list;
              }
              return prev;
            });
          })
          .catch((err) => {
            const isAbortError = err.name === 'AbortError' || 
                                 err.name === 'DOMException' ||
                                 err.message?.includes('abort') ||
                                 err.message?.includes('Component unmounted');
            if (!isAbortError) {
              console.warn("[user-liked-music] failed:", err);
            }
          });
      };

      // 根據當前 tab 決定加載順序
      if (activeTab === 'uploads') {
        // 立即加載 uploads 數據
        loadUploadsData();
        // 延遲加載 likes 數據（使用 requestIdleCallback 或 setTimeout）
        if (typeof window !== 'undefined' && window.requestIdleCallback) {
          window.requestIdleCallback(() => loadLikesData(), { timeout: 2000 });
        } else {
          setTimeout(() => loadLikesData(), 1000);
        }
      } else {
        // 立即加載 likes 數據
        loadLikesData();
        // 延遲加載 uploads 數據
        if (typeof window !== 'undefined' && window.requestIdleCallback) {
          window.requestIdleCallback(() => loadUploadsData(), { timeout: 2000 });
        } else {
          setTimeout(() => loadUploadsData(), 1000);
        }
      }
    })();

    return () => {
      ac.abort("Component unmounted or dependencies changed");
      // 離開個人頁時僅恢復分享模式為 global，不關閉迷你播放器（避免返回後需要重新啟用）
      try {
        player?.setShareMode?.("global");
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, currentUser?.pinnedPlayer?.userId, currentUser?.pinnedPlayer?.expiresAt, activeTab]); // 只依賴關鍵字段，避免 currentUser 對象引用變化導致重複執行

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
    
    // ✅ 如果是音樂，確保作者信息正確
    if (img.type === 'music') {
      try {
        // 確保作者信息完整
        const authorId = typeof full.author === "string" ? full.author : full.author?._id || full.author?.id || full.user?._id || full.user;
        
        // ✅ 改進：如果 author 是對象但缺少 image 或 username，也需要補全
        const needsEnrichment = authorId && (
          !full.author || 
          typeof full.author === "string" || 
          !full.author.username || 
          (!full.author.image && !full.author.avatar) ||
          (full.author.image === "" && full.author.avatar === "")
        );
        
        if (needsEnrichment) {
          const u = await axios.get(`/api/user-info?id=${authorId}`);
          if (u?.data) {
            // ✅ 確保使用正確的頭像字段（優先 image，其次 avatar）
            const userAvatar = u.data.image || u.data.avatar || "";
            full = { 
              ...full, 
              author: {
                ...u.data,
                image: userAvatar, // 確保使用 image 字段
                avatar: userAvatar, // 同時設置 avatar 以保持兼容性
              },
              user: u.data, // 保持兼容性
              authorAvatar: full.authorAvatar || userAvatar, // 確保 authorAvatar 存在
              authorName: full.authorName || u.data.username // 確保 authorName 存在
            };
          }
        } else if (full.author && typeof full.author === "object") {
          // ✅ 如果 author 已存在但缺少 image，嘗試從 avatar 獲取
          if (!full.author.image && full.author.avatar) {
            full.author.image = full.author.avatar;
          }
          // ✅ 確保 authorAvatar 存在（但優先使用 author.image）
          if (!full.authorAvatar && full.author.image) {
            full.authorAvatar = full.author.image;
          } else if (!full.authorAvatar && full.author.avatar) {
            full.authorAvatar = full.author.avatar;
          }
        }
      } catch (error) {
        console.error('❌ enrichImage 音樂處理失敗:', error);
      }
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
      // 2) ✅ 優化：檢查圖片詳情API返回的user信息是否完整
      // 圖片詳情API已經populate了user信息，通常不需要再調用user-info API
      const apiImageUser = apiImage?.user;
      const hasCompleteUserInfo = apiImageUser && 
        typeof apiImageUser === 'object' && 
        apiImageUser._id && 
        apiImageUser.username;
      
      if (hasCompleteUserInfo) {
        // user信息已經完整，不需要再調用user-info API
        full.user = apiImageUser;
      } else {
        // 只有當user信息不完整時才調用user-info API
        const authorId =
          typeof full.user === "string" ? full.user : full.user?._id || full.user?.id;
        if (authorId && (!full.user || !full.user.username)) {
          const u = await axios.get(`/api/user-info?id=${authorId}`);
          if (u?.data) full = { ...full, user: u.data };
        }
      }
    } catch {
      // 靜默失敗
    }
    return full;
  };

  const handleSelectImage = async (img) => {
    // ✅ 檢查 img 是否存在
    if (!img) {
      console.warn("⚠️ handleSelectImage: img is undefined");
      return;
    }
    
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
      
      // ✅ 如果是圖片或視頻，將 sfw 映射到 all，nsfw 映射到 18
      if (item.type === 'image' || item.type === 'video') {
        if (rating === 'sfw' || rating === 'general') rating = 'all';
        else if (rating === 'nsfw') rating = '18';
      }
      
      // ✅ 個人頁面：如果選擇了所有分級，或沒有明確選擇過濾器，顯示所有內容
      // 否則應用過濾器（用戶明確選擇了特定分級時）
      const allPossibleRatings = ["all", "15", "18"];
      const hasAllRatingsSelected = allPossibleRatings.every(r => selectedRatings.includes(r));
      
      // 如果選擇了所有分級，就顯示所有內容；否則應用過濾器
      const matchLevel = hasAllRatingsSelected
        ? true  // 選擇了所有分級，顯示所有內容（包括18+）
        : selectedRatings.includes(rating);  // 有明確選擇過濾器時，只顯示符合的內容

      // ✅ 支援多分類篩選：檢查 categories 陣列中是否有任何一個在 categoryFilters 中
      const itemCategories = Array.isArray(item.categories) && item.categories.length > 0
        ? item.categories
        : item.category
          ? [item.category]
          : [];
      const matchCategory =
        categoryFilters.length === 0 || 
        itemCategories.some(cat => categoryFilters.includes(cat));

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
    // ✅ 支持从 selectedImage 或 selectedMusic 导航
    const currentItem = selectedImage || selectedMusic;
    if (!currentItem) return;
    
    const list = filteredImages;
    const idx = list.findIndex((img) => String(img._id) === String(currentItem._id));
    if (idx < 0) return;

    const nextIdx = dir === "next" ? idx + 1 : idx - 1;
    if (nextIdx < 0 || nextIdx >= list.length) return;

    const target = list[nextIdx];
    
    // ✅ 如果目标是音乐，设置 selectedMusic 并清空 selectedImage
    if (target.type === 'music') {
      const enriched = await enrichImage(target);
      setSelectedMusic(enriched);
      setSelectedImage(null);
      return;
    }
    
    // ✅ 如果目标是视频或图片，设置 selectedImage 并清空 selectedMusic
    const enriched = await enrichImage(target);
    setSelectedImage(enriched);
    setSelectedMusic(null);
  };

  // ✅ 計算前/後一張（給手機拖曳預覽）
  // ✅ 支持从 selectedImage 或 selectedMusic 计算索引
  const currentItem = selectedImage || selectedMusic;
  const selectedIndex = currentItem
    ? filteredImages.findIndex((img) => String(img._id) === String(currentItem._id))
    : -1;

  const prevImage =
    selectedIndex > 0 ? filteredImages[selectedIndex - 1] : undefined;
  const nextImage =
    selectedIndex >= 0 && selectedIndex < filteredImages.length - 1
      ? filteredImages[selectedIndex + 1]
      : undefined;

  // ✅ 性能優化：即使 userData 未加載，也先渲染 UserHeader 的骨架屏以提升 LCP
  // 但為了避免錯誤，我們仍然需要檢查 userData
  if (!userData) {
    return (
      <div className="text-white p-4">
        <div className="animate-pulse">
          <div className="h-32 bg-zinc-800 rounded-lg mb-4"></div>
          <div className="h-64 bg-zinc-800 rounded-lg"></div>
        </div>
      </div>
    );
  }

  const handleUnpinPlayer = async () => {
    try {
      await axios.delete('/api/player/pin');
      setPinnedPlayerData(null);
      
      // ✅ 1. 立即清除钉选播放器缓存（必须在更新 currentUser 之前）
      if (typeof window !== "undefined") {
        try {
          const { clearPinnedPlayerCache } = await import("@/utils/pinnedPlayerCache");
          clearPinnedPlayerCache();
        } catch (e) {
          console.warn("清除钉选缓存失败:", e);
        }
      }
      
      // ✅ 2. 更新 CurrentUserContext，移除釘選數據（这会触发 usePinnedPlayerBootstrap 的清理）
      if (setCurrentUser) {
        setCurrentUser(prevUser => {
          if (!prevUser) return prevUser;
          const { pinnedPlayer, ...rest } = prevUser;
          return rest;
        });
      }
      
      // ✅ 3. 立即停止播放并清空播放器状态
      // 先清空播放清单
      player?.setPlaylist?.([]);
      player?.setActiveIndex?.(0);
      
      // 然后停止播放并清空播放源
      player?.pause?.();
      player?.setIsPlaying?.(false);
      player?.setPinnedOwnerInfo?.(null);
      
      // ✅ 强制重置音频元素（如果可以直接访问）
      if (player?.audioRef?.current) {
        try {
          const audio = player.audioRef.current;
          audio.pause();
          audio.currentTime = 0;
          audio.removeAttribute("src");
          audio.load();
        } catch (e) {
          console.warn("直接重置音频元素失败:", e);
        }
      }
      
      // 清空播放源（这会触发 setSrcWithAudio，自动重置 currentTime 和 duration）
      player?.setSrc?.("");
      player?.setOriginUrl?.("");
      player?.setTrackTitle?.("");
      
      // ✅ 4. 使用 requestAnimationFrame 确保 DOM 更新后再加载当前页面播放清单
      requestAnimationFrame(() => {
        // ✅ 5. 检查当前页面是否有播放器功能，如果有则加载当前页面的播放清单
        const hasValidPlayer = !!userData?.miniPlayerPurchased || 
          (userData?.playerCouponUsed && 
           userData?.miniPlayerExpiry && 
           new Date(userData.miniPlayerExpiry) > new Date());
        
        if (hasValidPlayer && userData?.username) {
          // ✅ 6. 设置当前页面的 playerOwner
          const allowShuffleRaw = userData?.playlistAllowShuffle;
          const allowShuffle = typeof allowShuffleRaw === "boolean" ? allowShuffleRaw : null;
          player?.setPlayerOwner?.({
            userId: id,
            username: userData.username,
            ...(typeof allowShuffle === "boolean" ? { allowShuffle } : {}),
          });
          
          // 加载当前页面的播放清单（即使为空）
          const userPlaylist = Array.isArray(userData?.playlist) && userData.playlist.length > 0 ? userData.playlist : [];
          
          if (userPlaylist.length > 0) {
            // 有播放清單：載入第一首
            const firstItem = userPlaylist[0];
            const firstUrl = String(firstItem.url || "");
            const firstTitle = String(firstItem.title || firstUrl);
            
            if (firstUrl) {
              // ✅ 先設置播放清單和 activeIndex，確保播放器狀態正確
              player?.setPlaylist?.(userPlaylist);
              player?.setActiveIndex?.(0);
              
              // ✅ 使用 setTimeout 確保播放器組件已經準備好後再設置 src 和 originUrl
              setTimeout(() => {
                player?.setSrc?.(firstUrl);
                player?.setOriginUrl?.(firstUrl);
                player?.setTrackTitle?.(firstTitle);
              }, 0);
            }
          } else {
            // ✅ 即使沒有播放清單，也設置空的播放清單
            player?.setPlaylist?.([]);
          }
        } else {
          // ✅ 如果当前页面没有播放器功能，清除 playerOwner
          player?.setPlayerOwner?.(null);
        }
      });
      
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
