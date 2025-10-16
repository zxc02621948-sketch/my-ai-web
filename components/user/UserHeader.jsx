// components/user/UserHeader.jsx
"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import axios from "axios";
import AvatarCropModal from "./AvatarCropModal";
import AvatarFrame from "@/components/common/AvatarFrame";
import { uploadToCloudflare } from "@/lib/uploadToCloudflare";
import { DEFAULT_AVATAR_IDS } from "@/lib/constants";
import { Pencil } from "lucide-react";
import FollowListButton from "./FollowListButton";
import Link from "next/link";
import PointsStoreModal from "./PointsStoreModal";
import LevelDisplay from "./LevelDisplay";
import UnifiedAvatarModal from "./UnifiedAvatarModal";
import LevelRewardsModal from "./LevelRewardsModal";
import PowerCouponGuideModal from "./PowerCouponGuideModal";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/contexts/CurrentUserContext";

const cloudflarePrefix = "https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/";

// ✅ 先拿 userId，再退回 _id / id（相容關係文件與純 id）
const idOf = (v) => {
  if (!v) return "";
  if (typeof v === "string") return v;
  return String(v?.userId?._id || v?.userId || v?._id || v?.id || "");
};

const getTokenFromCookie = () => {
  if (typeof document === "undefined") return null;
  return document.cookie.split("; ").find(row => row.startsWith("token="))?.split("=")[1] || null;
};

export default function UserHeader({ userData, currentUser, onUpdate, onEditOpen, onPointsOpen, onPowerCouponOpen, onUserDataUpdate }) {
  // 使用 Context 獲取訂閱狀態
  const { hasValidSubscription } = useCurrentUser();
  const router = useRouter();
  const isOwnProfile =
    !!currentUser && !!userData && String(currentUser._id) === String(userData._id);

  // ====== 頭像 / 追蹤狀態 ======
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // ====== 權力券數量 ======
  const [couponCount, setCouponCount] = useState(0);
  const [isCouponGuideOpen, setIsCouponGuideOpen] = useState(false);

  // ====== 統計數據狀態 ======
  const [userStats, setUserStats] = useState({
    worksCount: 0,
    followersCount: 0,
    followingCount: 0,
    favoritesCount: 0,
    likesCount: 0,
    commentsCount: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [isStoreOpen, setStoreOpen] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(userData?.currentFrame || "default");
  const [isAvatarModalOpen, setAvatarModalOpen] = useState(false);
  const [isLevelRewardsModalOpen, setLevelRewardsModalOpen] = useState(false);
  const [isMobileStatsExpanded, setMobileStatsExpanded] = useState(false);
  const [isMobilePointsExpanded, setMobilePointsExpanded] = useState(false);
  const [isMobileEarningExpanded, setMobileEarningExpanded] = useState(false);

  // 同步 userData 的 currentFrame 到本地狀態
  useEffect(() => {
    if (userData?.currentFrame) {
      setCurrentFrame(userData.currentFrame);
    }
  }, [userData?.currentFrame]);

  // 避免切換時被外部 currentUser 舊值覆蓋
  const suppressAutoSyncRef = useRef(false);

  // A) 先用傳入的 currentUser 初判（避免首屏閃爍）
  useEffect(() => {
    if (!currentUser || !userData) return;
    if (suppressAutoSyncRef.current) return;

    if (String(currentUser._id) === String(userData._id)) {
      setIsFollowing(false);
      return;
    }
    const followingIds = (currentUser.following || []).map(idOf).filter(Boolean);
    setIsFollowing(followingIds.includes(String(userData._id)));
  }, [currentUser, userData]);

  // B) 進頁/切換對象時，主動重抓最新追蹤清單，修正可能的舊快照
  useEffect(() => {
    const fetchFreshFollowing = async () => {
      try {
        if (!currentUser?._id || !userData?._id) return;
        if (String(currentUser._id) === String(userData._id)) return;
        const res = await fetch("/api/follow", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        const followingIds = (data.following || []).map(idOf).filter(Boolean);
        setIsFollowing(followingIds.includes(String(userData._id)));
      } catch (e) {
        console.warn("fetchFreshFollowing error:", e);
      }
    };
    fetchFreshFollowing();
  }, [currentUser?._id, userData?._id]);

  // C) 監聽全域事件，跨頁/跨元件同步
  useEffect(() => {
    const onChanged = (e) => {
      const { targetUserId, isFollowing: state } = e.detail || {};
      if (!targetUserId) return;
      if (String(targetUserId) === String(userData?._id)) {
        setIsFollowing(!!state);
      }
    };
    window.addEventListener("follow-changed", onChanged);
    return () => window.removeEventListener("follow-changed", onChanged);
  }, [userData?._id]);

  // D) 監聽用戶數據更新事件
  useEffect(() => {
    const onUserDataUpdated = (e) => {
      const { userData: updatedUserData } = e.detail || {};
      if (updatedUserData && onUserDataUpdate) {
        console.log("🔧 收到用戶數據更新事件:", updatedUserData);
        onUserDataUpdate(updatedUserData);
      }
    };
    window.addEventListener("user-data-updated", onUserDataUpdated);
    return () => window.removeEventListener("user-data-updated", onUserDataUpdated);
  }, [onUserDataUpdate]);

  // E) 監聽頭像框設定更新事件
  useEffect(() => {
    const onFrameSettingsUpdated = (e) => {
      const { frameId, settings } = e.detail || {};
      if (frameId && settings && onUserDataUpdate) {
        console.log("🎨 收到頭像框設定更新事件:", { frameId, settings });
        // 更新 userData 中的 frameSettings
        const updatedUserData = {
          ...userData,
          frameSettings: {
            ...userData?.frameSettings,
            [frameId]: settings
          }
        };
        onUserDataUpdate(updatedUserData);
      }
    };
    window.addEventListener("frame-settings-updated", onFrameSettingsUpdated);
    return () => window.removeEventListener("frame-settings-updated", onFrameSettingsUpdated);
  }, [userData, onUserDataUpdate]);

  // ====== 獲取統計數據 ======
  useEffect(() => {
    const fetchUserStats = async () => {
      if (!userData?._id) return;
      
      setStatsLoading(true);
      try {
        const response = await fetch(`/api/user/${userData._id}/stats`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setUserStats(data.data);
          }
        }
      } catch (error) {
        console.error("獲取用戶統計數據失敗:", error);
      } finally {
        setStatsLoading(false);
      }
    };

    fetchUserStats();
  }, [userData?._id]);

  // ====== 獲取權力券數量（僅自己的個人頁） ======
  useEffect(() => {
    const fetchCouponCount = async () => {
      if (!isOwnProfile) return;
      
      try {
        const res = await axios.get('/api/power-coupon/user-coupons', {
          withCredentials: true
        });
        if (res?.data?.success) {
          const activeCoupons = (res.data.coupons || []).filter(c => !c.used);
          setCouponCount(activeCoupons.length);
        }
      } catch (error) {
        console.error('獲取權力券數量失敗:', error);
      }
    };

    fetchCouponCount();
  }, [isOwnProfile]);



  // 頭像框更新處理
  const handleFrameSelect = async (frameId, settings) => {
    try {
      console.log("🔧 準備設置頭像框:", frameId, "設定:", settings);
      const response = await axios.post("/api/user/set-frame", {
        frameId: frameId,
        settings: settings
      });

      if (response.data.success) {
        console.log("🔧 頭像框設置成功:", response.data);
        setCurrentFrame(frameId);
        
        // 重新加載頁面以獲取最新的設定
        window.location.reload();
      } else {
        throw new Error(response.data.error || "設置失敗");
      }
    } catch (error) {
      console.error("❌ 頭像框設置失敗:", error);
      alert(error.response?.data?.error || "設置頭像框失敗，請重試");
      throw error;
    }
  };

  // 頭像上傳處理
  const handleImageUpload = async (imageFile) => {
    try {
      console.log("🔧 準備上傳頭像，用戶 ID:", userData._id);
      const formData = new FormData();
      formData.append("file", imageFile);
      
      const response = await axios.post(`/api/upload-avatar?id=${userData._id}`, formData);

      console.log("🔧 頭像上傳響應:", response.data);
      if (response.data.success) {
        console.log("🔧 頭像上傳成功，觸發頁面刷新");
        onUpdate?.();
      }
    } catch (error) {
      console.error("❌ 頭像上傳失敗:", error);
      alert("上傳失敗，請重試");
      throw error;
    }
  };

  // ====== 追蹤/取消追蹤 ======
  const handleFollowToggle = async () => {
    try {
      if (!currentUser) {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("openLoginModal"));
        }
        return;
      }

      setFollowLoading(true);
      suppressAutoSyncRef.current = true;
      setTimeout(() => {
        suppressAutoSyncRef.current = false;
      }, 1000);

      const token = getTokenFromCookie();
      const headers = {
        "Content-Type": "application/json",
        Authorization: token ? `Bearer ${token}` : undefined,
      };

      const willFollow = !isFollowing;
      if (willFollow) {
        await axios.post("/api/follow", { userIdToFollow: userData._id }, { headers });
      } else {
        await axios.delete("/api/follow", { data: { userIdToUnfollow: userData._id }, headers });
      }

      setIsFollowing(willFollow);

      // 更新 currentUser.following
      if (currentUser) {
        const newFollowing = willFollow
          ? [...(currentUser.following || []), userData._id]
          : (currentUser.following || []).filter(id => String(idOf(id)) !== String(userData._id));
        onUpdate?.({ ...currentUser, following: newFollowing });
      }

      // 廣播事件
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("follow-changed", {
            detail: { targetUserId: String(userData._id), isFollowing: willFollow },
          })
        );
      }
    } catch (error) {
      console.error("追蹤操作失敗:", error);
      if (error?.response?.status === 401) {
        window.dispatchEvent(new CustomEvent("openLoginModal"));
      } else {
        alert("操作失敗，請稍後再試");
      }
    } finally {
      setFollowLoading(false);
    }
  };

  // ====== 渲染 ======
  // 檢查 userData.image 是否已經是完整的 URL
  const imageUrl = (() => {
    if (typeof userData?.image === "string" && userData.image.trim() !== "") {
      // 如果已經是完整 URL，直接使用
      if (userData.image.startsWith('http')) {
        return userData.image;
      }
      // 如果是 ID，構建完整 URL
      return `${cloudflarePrefix}${userData.image}/avatar`;
    }
    // 使用默認頭像
    const defaultId = DEFAULT_AVATAR_IDS[userData?.gender] || DEFAULT_AVATAR_IDS.hidden;
    return `${cloudflarePrefix}${defaultId}/avatar`;
  })();

  return (
    <div className="mb-4 mt-[-55px]">
      {/* 響應式佈局容器 */}
      <div className="flex flex-col xl:flex-row gap-4 xl:gap-0">
        
        {/* 主要用戶資訊區域 - 左半邊 */}
        <div className="w-full xl:w-1/2 xl:flex-shrink-0">
          <div className="bg-zinc-900/50 rounded-l-xl p-4 border border-zinc-700/50 h-full flex flex-col min-h-[240px]">
            {/* 頭像和基本資訊 */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 sm:gap-4 mb-4">
              {/* 頭像 */}
              <div className="flex flex-col items-center">
                <div className="relative flex-shrink-0">
                  <AvatarFrame
                    src={imageUrl}
                    size={150}
                    frameId={currentFrame}
                    showFrame={true}
                    ring={false}
                    frameColor={userData?.frameSettings?.[currentFrame]?.color || "#ffffff"}
                    frameOpacity={userData?.frameSettings?.[currentFrame]?.opacity || 1}
                    layerOrder={userData?.frameSettings?.[currentFrame]?.layerOrder || "frame-on-top"}
                    frameTransparency={userData?.frameSettings?.[currentFrame]?.frameOpacity || 1}
                  />
                  {isOwnProfile && (
                    <button
                      onClick={() => setAvatarModalOpen(true)}
                      className="absolute -bottom-1 -right-1 bg-blue-500 text-white text-xs rounded-full px-3 py-1 cursor-pointer hover:bg-blue-600 shadow-lg z-40"
                    >
                      更換
                    </button>
                  )}
                </div>
                
                {/* 基本資訊 - 只在自己的資料頁顯示 */}
                {isOwnProfile && (
                  <div className="mt-2 space-y-1 text-center w-full max-w-[180px]">
                    <div className="flex flex-col items-center space-y-1 bg-zinc-800/50 rounded-lg p-1.5">
                      <span className="text-zinc-300 text-sm font-medium">郵箱</span>
                      <span className="text-zinc-200 text-xs break-all">
                        {userData?.email || '無郵箱資訊'}
                      </span>
                    </div>
                    <div className="flex flex-col items-center space-y-1 bg-zinc-800/50 rounded-lg p-1.5">
                      <div className="flex items-center space-x-1">
                        <span className="text-zinc-400 text-sm">{userData?.isVerified ? '✅' : '⚠️'}</span>
                        <span className="text-zinc-300 text-sm font-medium">驗證狀態</span>
                      </div>
                      <span className={`text-xs font-medium ${userData?.isVerified ? 'text-green-400' : 'text-yellow-400'}`}>
                        {userData?.isVerified ? '已驗證' : '未驗證'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* 用戶資訊 */}
              <div className="flex-1 text-center sm:text-left">
                {/* 用戶名 */}
                <h1 className="text-2xl sm:text-3xl font-light mb-3">{userData.username}</h1>
                
                {/* 統計數據 - 手機版可展開設計 */}
                <div className="mb-4">
                  {/* 主要統計數據 - 始終顯示 */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                    <div className="text-center">
                      <div className="text-xl sm:text-2xl font-bold text-white">
                        {statsLoading ? "..." : userStats.worksCount}
                      </div>
                      <div className="text-gray-400 text-xs sm:text-sm">作品</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl sm:text-2xl font-bold text-white">
                        {statsLoading ? "..." : userStats.followersCount}
                      </div>
                      <div className="text-gray-400 text-xs sm:text-sm">追蹤者</div>
                    </div>
                    <div className="hidden md:block text-center">
                      <div className="text-xl sm:text-2xl font-bold text-white">
                        {statsLoading ? "..." : userStats.followingCount}
                      </div>
                      <div className="text-gray-400 text-xs sm:text-sm">追蹤中</div>
                    </div>
                    <div className="hidden lg:block text-center">
                      <div className="text-xl sm:text-2xl font-bold text-yellow-400">
                        {statsLoading ? "..." : userStats.favoritesCount}
                      </div>
                      <div className="text-gray-400 text-xs sm:text-sm">收藏</div>
                    </div>
                    <div className="hidden lg:block text-center">
                      <div className="text-xl sm:text-2xl font-bold text-red-400">
                        {statsLoading ? "..." : userStats.likesCount}
                      </div>
                      <div className="text-gray-400 text-xs sm:text-sm">點讚</div>
                    </div>
                    <div className="hidden lg:block text-center">
                      <div className="text-xl sm:text-2xl font-bold text-blue-400">
                        {statsLoading ? "..." : userStats.commentsCount}
                      </div>
                      <div className="text-gray-400 text-xs sm:text-sm">評論</div>
                    </div>
                  </div>

                  {/* 手機版展開按鈕和詳細統計 */}
                  <div className="md:hidden">
                    <button
                      onClick={() => setMobileStatsExpanded(!isMobileStatsExpanded)}
                      className="w-full mt-3 py-2 px-3 bg-zinc-800/50 hover:bg-zinc-700/50 rounded-lg text-gray-300 text-sm transition-colors flex items-center justify-center gap-2"
                    >
                      <span>更多統計</span>
                      <svg 
                        className={`w-4 h-4 transition-transform ${isMobileStatsExpanded ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {/* 展開的詳細統計 */}
                    {isMobileStatsExpanded && (
                      <div className="mt-3 grid grid-cols-2 gap-3 animate-in slide-in-from-top-2 duration-200">
                        <div className="text-center bg-zinc-800/30 rounded-lg p-2">
                          <div className="text-lg font-bold text-white">
                            {statsLoading ? "..." : userStats.followingCount}
                          </div>
                          <div className="text-gray-400 text-xs">追蹤中</div>
                        </div>
                        <div className="text-center bg-zinc-800/30 rounded-lg p-2">
                          <div className="text-lg font-bold text-yellow-400">
                            {statsLoading ? "..." : userStats.favoritesCount}
                          </div>
                          <div className="text-gray-400 text-xs">收藏</div>
                        </div>
                        <div className="text-center bg-zinc-800/30 rounded-lg p-2">
                          <div className="text-lg font-bold text-red-400">
                            {statsLoading ? "..." : userStats.likesCount}
                          </div>
                          <div className="text-gray-400 text-xs">點讚</div>
                        </div>
                        <div className="text-center bg-zinc-800/30 rounded-lg p-2">
                          <div className="text-lg font-bold text-blue-400">
                            {statsLoading ? "..." : userStats.commentsCount}
                          </div>
                          <div className="text-gray-400 text-xs">評論</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 個人簡介 */}
                <div className="mb-3">
                  <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-lg p-2.5 max-w-[480px]">
                    <h3 className="text-zinc-300 text-sm font-medium mb-1">個人簡介</h3>
                    <p className={`leading-relaxed break-all overflow-wrap-anywhere text-sm ${
                      userData.bio && userData.bio.trim() 
                        ? 'text-gray-200' 
                        : 'text-gray-500 italic'
                    }`}>
                      {userData.bio && userData.bio.trim() 
                        ? userData.bio 
                        : '這個人很神秘，還沒有留下任何足跡～'}
                    </p>
                  </div>
                </div>
                
                {/* 操作按鈕 - 手機版優化 */}
                <div className="flex flex-wrap justify-center sm:justify-start items-center gap-2 sm:gap-3 mb-4">
                  {isOwnProfile ? (
                    <>
                      <button
                        onClick={() => onEditOpen?.()}
                        className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs sm:text-sm font-medium border border-zinc-600 flex items-center gap-1 sm:gap-2"
                      >
                        <Pencil size={14} className="sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">編輯個人檔案</span>
                        <span className="sm:hidden">編輯</span>
                      </button>
                      <div className="hidden md:block">
                        <FollowListButton currentUser={currentUser} userId={userData._id} />
                      </div>
                      {/* 播放器入口（僅有效訂閱後顯示） */}
                      {hasValidSubscription('pinPlayerTest') || hasValidSubscription('pinPlayer') ? (
                        <Link
                          href={`/user/${userData._id}/player`}
                          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs sm:text-sm font-semibold text-white border border-blue-500"
                        >
                          <span className="hidden sm:inline">🎧 播放器</span>
                          <span className="sm:hidden">🎧</span>
                        </Link>
                      ) : null}
                    </>
                  ) : currentUser && userData ? (
                    <>
                      <button
                        onClick={handleFollowToggle}
                        className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg ${
                          isFollowing 
                            ? "bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-600" 
                            : "bg-blue-600 hover:bg-blue-700 text-white"
                        } ${followLoading ? "opacity-60 cursor-not-allowed" : ""}`}
                        disabled={followLoading}
                      >
                        {isFollowing ? "追蹤中" : "追蹤"}
                      </button>
                    </>
                  ) : null}
                </div>


              </div>
            </div>
          </div>
        </div>

        {/* 積分系統區域 - 右半邊，手機版簡化 */}
        <div className="w-full xl:w-1/2">
          <div className="bg-zinc-900/50 rounded-r-xl p-3 sm:p-4 border-t border-r border-b border-zinc-700/50 h-full">
            {/* 積分總覽 - 手機版簡化 */}
            <div className="mb-4">
              <div className="flex items-center gap-2 sm:gap-3 mb-3">
                <h3 className="text-base sm:text-lg font-semibold text-gray-200">積分總覽</h3>
                
                {/* 等級獎勵按鈕 - 手機版隱藏 */}
                {isOwnProfile && (
                  <button
                    onClick={() => setLevelRewardsModalOpen(true)}
                    className="hidden sm:flex px-3 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 items-center gap-2 whitespace-nowrap"
                    title="查看等級獎勵"
                  >
                    <span className="text-lg">🏆</span>
                    <span className="hidden sm:inline">等級獎勵</span>
                  </button>
                )}
              </div>
              
              {/* 等級顯示 - 手機版簡化 */}
              <div className="mb-3 sm:mb-4">
                <LevelDisplay 
                  points={statsLoading ? 0 : Number(userStats?.totalEarned ?? 0)} 
                  showProgress={true}
                  size="normal"
                />
              </div>

              {/* 積分信息 - 手機版可展開 */}
              <div>
                {/* 主要積分信息 */}
                <div className="text-center sm:text-left">
                  <div className="text-gray-400 text-xs sm:text-sm mb-1">當前積分</div>
                  <div className="text-xl sm:text-2xl font-bold text-yellow-400">{statsLoading ? "—" : Number(userStats?.totalEarned ?? 0)}</div>
                </div>

                {/* 桌面版詳細積分信息 */}
                <div className="hidden sm:grid sm:grid-cols-2 gap-3 sm:gap-4 mt-4">
                  <div className="text-center sm:text-left">
                    <div className="text-gray-500 text-sm mb-1">本月獲得</div>
                    <div className="text-xl font-semibold text-green-400">{statsLoading ? "—" : Number(userStats?.monthlyEarned ?? 0)}</div>
                  </div>
                  <div className="text-center sm:text-left">
                    <div className="text-gray-500 text-sm mb-1">總計獲得</div>
                    <div className="text-xl font-semibold text-gray-300">{statsLoading ? "—" : Number(userStats?.totalEarned ?? 0)}</div>
                  </div>
                </div>

                {/* 手機版展開按鈕和詳細積分 */}
                <div className="sm:hidden">
                  <button
                    onClick={() => setMobilePointsExpanded(!isMobilePointsExpanded)}
                    className="w-full mt-3 py-2 px-3 bg-zinc-800/50 hover:bg-zinc-700/50 rounded-lg text-gray-300 text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <span>詳細積分</span>
                    <svg 
                      className={`w-4 h-4 transition-transform ${isMobilePointsExpanded ? 'rotate-180' : ''}`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {/* 展開的詳細積分 */}
                  {isMobilePointsExpanded && (
                    <div className="mt-3 space-y-2 animate-in slide-in-from-top-2 duration-200">
                      <div className="bg-zinc-800/30 rounded-lg p-3">
                        <div className="text-gray-500 text-sm mb-1">本月獲得</div>
                        <div className="text-lg font-semibold text-green-400">{statsLoading ? "—" : Number(userStats?.monthlyEarned ?? 0)}</div>
                      </div>
                      <div className="bg-zinc-800/30 rounded-lg p-3">
                        <div className="text-gray-500 text-sm mb-1">總計獲得</div>
                        <div className="text-lg font-semibold text-gray-300">{statsLoading ? "—" : Number(userStats?.totalEarned ?? 0)}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 快速操作和積分獲得方式 - 手機版簡化 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {/* 快速操作（僅自己可見）- 手機版隱藏次要功能 */}
              {isOwnProfile && (
                <div>
                  <h4 className="text-xs sm:text-sm font-medium text-gray-300 mb-2">快速操作</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button 
                      onClick={() => router.push('/store')} 
                      className="bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-white py-2 px-3 rounded-lg font-medium transition-all duration-200 text-xs sm:text-sm"
                    >
                      <span className="hidden sm:inline">🛍️ 積分商店</span>
                      <span className="sm:hidden">🛍️ 商店</span>
                    </button>
                    <button
                      onClick={() => onPointsOpen?.()}
                      className="bg-zinc-800 hover:bg-zinc-700 text-gray-200 py-2 px-3 rounded-lg font-medium border border-zinc-600 transition-all duration-200 text-xs sm:text-sm"
                    >
                      <span className="hidden sm:inline">📊 積分記錄</span>
                      <span className="sm:hidden">📊 記錄</span>
                    </button>
                    <button
                      onClick={() => setIsCouponGuideOpen(true)}
                      className={`py-2 px-3 rounded-lg font-medium transition-all duration-200 text-xs sm:text-sm relative ${
                        couponCount === 0 
                          ? 'bg-gray-600 hover:bg-gray-500 text-gray-300 border border-gray-500' 
                          : 'bg-purple-600 hover:bg-purple-700 text-white'
                      }`}
                      title={couponCount === 0 ? '點擊查看說明並購買' : `你有 ${couponCount} 張可用券，點擊查看使用方法`}
                    >
                      <span className="hidden sm:inline">🎫 新圖加乘券</span>
                      <span className="sm:hidden">🎫 加乘券</span>
                      {couponCount > 0 && (
                        <span className="ml-1 bg-yellow-500 text-black text-xs px-1.5 py-0.5 rounded-full font-bold">
                          {couponCount}
                        </span>
                      )}
                      {couponCount === 0 && (
                        <span className="ml-1 text-xs opacity-75 hidden sm:inline">(無券)</span>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* 積分獲得方式 - 手機版可展開 */}
              <div>
                <h4 className="text-sm font-medium text-gray-300 mb-2">獲得積分</h4>
                
                {/* 桌面版完整顯示 */}
                <div className="hidden md:block space-y-1.5 text-xs text-gray-400">
                  <div className="flex justify-between">
                    <span>上傳作品</span>
                    <span className="text-yellow-400">+5／每日上限 20</span>
                  </div>
                  <div className="flex justify-between">
                    <span>獲得愛心</span>
                    <span className="text-yellow-400">+1／每日上限 10</span>
                  </div>
                  <div className="flex justify-between">
                    <span>給予愛心</span>
                    <span className="text-yellow-400">+1／每日上限 5（給他人按讚，自讚不計）</span>
                  </div>
                  <div className="flex justify-between">
                    <span>獲得留言</span>
                    <span className="text-yellow-400">+1／每日上限 5</span>
                  </div>
                  <div className="flex justify-between">
                    <span>每日登入</span>
                    <span className="text-yellow-400">+5／每日一次</span>
                  </div>
                </div>

                {/* 手機版簡化顯示和展開按鈕 */}
                <div className="md:hidden">
                  <div className="space-y-1.5 text-xs text-gray-400">
                    <div className="flex justify-between">
                      <span>上傳作品</span>
                      <span className="text-yellow-400">+5／日</span>
                    </div>
                    <div className="flex justify-between">
                      <span>每日登入</span>
                      <span className="text-yellow-400">+5／日</span>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => setMobileEarningExpanded(!isMobileEarningExpanded)}
                    className="w-full mt-2 py-1.5 px-2 bg-zinc-800/30 hover:bg-zinc-700/30 rounded text-gray-400 text-xs transition-colors flex items-center justify-center gap-1"
                  >
                    <span>查看全部</span>
                    <svg 
                      className={`w-3 h-3 transition-transform ${isMobileEarningExpanded ? 'rotate-180' : ''}`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {/* 展開的詳細積分獲得方式 */}
                  {isMobileEarningExpanded && (
                    <div className="mt-2 space-y-1.5 text-xs text-gray-400 animate-in slide-in-from-top-2 duration-200">
                      <div className="flex justify-between">
                        <span>獲得愛心</span>
                        <span className="text-yellow-400">+1／每日上限 10</span>
                      </div>
                      <div className="flex justify-between">
                        <span>給予愛心</span>
                        <span className="text-yellow-400">+1／每日上限 5（給他人按讚，自讚不計）</span>
                      </div>
                      <div className="flex justify-between">
                        <span>獲得留言</span>
                        <span className="text-yellow-400">+1／每日上限 5</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* 積分商店彈窗 */}
      <PointsStoreModal isOpen={isStoreOpen} onClose={() => setStoreOpen(false)} userData={userData} />
      
      {/* 權力券說明彈窗 */}
      <PowerCouponGuideModal 
        isOpen={isCouponGuideOpen} 
        onClose={() => setIsCouponGuideOpen(false)} 
        hasNoCoupon={couponCount === 0}
        couponCount={couponCount}
      />
      
      {/* 統一頭像模態框 */}
      <UnifiedAvatarModal 
        isOpen={isAvatarModalOpen} 
        onClose={() => setAvatarModalOpen(false)} 
        currentFrame={currentFrame}
        onFrameSelect={handleFrameSelect}
        onImageUpload={handleImageUpload}
        userPoints={userData?.pointsBalance || 0}
        userAvatar={imageUrl}
        frameSettings={userData?.frameSettings || {}}
        frameColorEditorUnlocked={userData?.frameColorEditorUnlocked || false}
      />

      {/* 等級獎勵模態框 */}
      <LevelRewardsModal 
        isOpen={isLevelRewardsModalOpen} 
        onClose={() => setLevelRewardsModalOpen(false)}
        userPoints={userData?.pointsBalance || 0}
        ownedFrames={userData?.ownedFrames || []}
      />
    </div>
  );
}
