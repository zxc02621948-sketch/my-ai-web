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
import AvatarSelectorModal from "./AvatarSelectorModal";
import { useRouter } from "next/navigation";

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

export default function UserHeader({ userData, currentUser, onUpdate, onEditOpen, onPointsOpen }) {
  const router = useRouter();
  const isOwnProfile =
    !!currentUser && !!userData && String(currentUser._id) === String(userData._id);

  // ====== 頭像 / 追蹤狀態 ======
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

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
  const [isAvatarSelectorOpen, setAvatarSelectorOpen] = useState(false);

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


  const handleFrameSelect = async (frameId) => {
    try {
      console.log("🔧 前端發送設置頭像框請求:", frameId);
      const response = await axios.post("/api/user/set-frame", {
        frameId: frameId
      });
      
      console.log("🔧 前端收到響應:", response.data);
      if (response.data.success) {
        setCurrentFrame(frameId);
        onUpdate?.();
      }
    } catch (error) {
      console.error("設置頭像框失敗:", error);
      console.error("錯誤詳情:", error.response?.data);
    }
  };

  const handleAvatarUpdate = async (imageFile, frameId) => {
    try {
      // 更新頭像框
      if (frameId && frameId !== currentFrame) {
        try {
          await handleFrameSelect(frameId);
        } catch (frameError) {
          console.error("設置頭像框失敗:", frameError);
          throw frameError; // 重新拋出錯誤
        }
      }

      // 更新頭像圖片
      console.log("🔧 檢查 imageFile:", imageFile ? "有文件" : "無文件");
      if (imageFile) {
        console.log("🔧 準備上傳頭像，用戶 ID:", userData._id);
        const formData = new FormData();
        formData.append("file", imageFile);
        
        const response = await axios.post(`/api/upload-avatar?id=${userData._id}`, formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });

        console.log("🔧 頭像上傳響應:", response.data);
        if (response.data.success) {
          console.log("🔧 頭像上傳成功，觸發頁面刷新");
          onUpdate?.();
        }
      } else if (frameId && frameId !== currentFrame) {
        // 如果只是更新頭像框，也需要刷新頁面
        console.log("🔧 只更新頭像框，觸發頁面刷新");
        onUpdate?.();
      }
    } catch (error) {
      console.error("更新頭像失敗:", error);
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
                  />
                  {isOwnProfile && (
                    <button
                      onClick={() => setAvatarSelectorOpen(true)}
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
                
                {/* 統計數據 */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 sm:gap-4 mb-4">
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
                  <div className="text-center">
                    <div className="text-xl sm:text-2xl font-bold text-white">
                      {statsLoading ? "..." : userStats.followingCount}
                    </div>
                    <div className="text-gray-400 text-xs sm:text-sm">追蹤中</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl sm:text-2xl font-bold text-yellow-400">
                      {statsLoading ? "..." : userStats.favoritesCount}
                    </div>
                    <div className="text-gray-400 text-xs sm:text-sm">收藏</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl sm:text-2xl font-bold text-red-400">
                      {statsLoading ? "..." : userStats.likesCount}
                    </div>
                    <div className="text-gray-400 text-xs sm:text-sm">點讚</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl sm:text-2xl font-bold text-blue-400">
                      {statsLoading ? "..." : userStats.commentsCount}
                    </div>
                    <div className="text-gray-400 text-xs sm:text-sm">評論</div>
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
                
                {/* 操作按鈕 */}
                <div className="flex justify-center sm:justify-start items-center gap-3 mb-4">
                  {isOwnProfile ? (
                    <>
                      <button
                        onClick={() => onEditOpen?.()}
                        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium border border-zinc-600 flex items-center gap-2"
                      >
                        <Pencil size={16} />
                        編輯個人檔案
                      </button>
                      <FollowListButton currentUser={currentUser} userId={userData._id} />
                      {/* 播放器入口（僅購買後顯示） */}
                      {userData?.miniPlayerPurchased ? (
                        <Link
                          href={`/user/${userData._id}/player`}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold text-white border border-blue-500"
                        >
                          🎧 播放器
                        </Link>
                      ) : null}
                    </>
                  ) : currentUser && userData ? (
                    <>
                      <button
                        onClick={handleFollowToggle}
                        className={`px-6 py-2 text-sm font-semibold rounded-lg ${
                          isFollowing 
                            ? "bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-600" 
                            : "bg-blue-600 hover:bg-blue-700 text-white"
                        } ${followLoading ? "opacity-60 cursor-not-allowed" : ""}`}
                        disabled={followLoading}
                      >
                        {isFollowing ? "追蹤中" : "追蹤"}
                      </button>
                      {/* 播放器入口（僅作者已購買時顯示給訪客） */}
                      {userData?.miniPlayerPurchased ? (
                        <Link
                          href={`/user/${userData._id}/player`}
                          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium text-white border border-zinc-600"
                        >
                          🎧 播放器
                        </Link>
                      ) : null}
                    </>
                  ) : null}
                </div>


              </div>
            </div>
          </div>
        </div>

        {/* 積分系統區域 - 右半邊 */}
        <div className="w-full xl:w-1/2">
          <div className="bg-zinc-900/50 rounded-r-xl p-4 border-t border-r border-b border-zinc-700/50 h-full">
            {/* 積分總覽 - 橫式排列 */}
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-3 text-gray-200">積分總覽</h3>
              
              {/* 等級顯示 */}
              <div className="mb-4">
                <LevelDisplay 
                  points={statsLoading ? 0 : Number(userStats?.totalEarned ?? 0)} 
                  showProgress={true}
                  size="normal"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="text-center sm:text-left">
                  <div className="text-gray-400 text-sm mb-1">當前積分</div>
                  <div className="text-2xl font-bold text-yellow-400">{statsLoading ? "—" : Number(userStats?.totalEarned ?? 0)}</div>
                </div>
                <div className="text-center sm:text-left">
                  <div className="text-gray-500 text-sm mb-1">本月獲得</div>
                  <div className="text-xl font-semibold text-green-400">{statsLoading ? "—" : Number(userStats?.monthlyEarned ?? 0)}</div>
                </div>
                <div className="text-center sm:text-left">
                  <div className="text-gray-500 text-sm mb-1">總計獲得</div>
                  <div className="text-xl font-semibold text-gray-300">{statsLoading ? "—" : Number(userStats?.totalEarned ?? 0)}</div>
                </div>
              </div>
            </div>

            {/* 快速操作和積分獲得方式 - 橫式排列 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {/* 快速操作 */}
              <div>
                <h4 className="text-sm font-medium text-gray-300 mb-2">快速操作</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button 
                    onClick={() => router.push('/store')} 
                    className="bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-white py-2 px-3 rounded-lg font-medium transition-all duration-200 text-sm"
                  >
                    🛍️ 積分商店
                  </button>
                  <button
                    onClick={() => onPointsOpen?.()}
                    className="bg-zinc-800 hover:bg-zinc-700 text-gray-200 py-2 px-3 rounded-lg font-medium border border-zinc-600 transition-all duration-200 text-sm"
                  >
                    📊 積分記錄
                  </button>
                </div>
              </div>

              {/* 積分獲得方式 */}
              <div>
                <h4 className="text-sm font-medium text-gray-300 mb-2">獲得積分</h4>
                <div className="space-y-1.5 text-xs text-gray-400">
                  <div className="flex justify-between">
                    <span>上傳作品</span>
                    <span className="text-yellow-400">+5／每日上限 20</span>
                  </div>
                  <div className="flex justify-between">
                    <span>獲得愛心</span>
                    <span className="text-yellow-400">+1／每日上限 10</span>
                  </div>
                  {/* 新增：給予愛心也能獲得積分 */}
                  <div className="flex justify-between">
                    <span>給予愛心</span>
                    <span className="text-yellow-400">+1／每日上限 5（同一使用者對同一作品終身僅計一次）</span>
                  </div>
                  <div className="flex justify-between">
                    <span>獲得留言</span>
                    <span className="text-yellow-400">+1／每日上限 5（同用戶同作品同日僅計一次）</span>
                  </div>
                  <div className="flex justify-between">
                    <span>每日登入</span>
                    <span className="text-yellow-400">+5／每日一次</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* 積分商店彈窗 */}
      <PointsStoreModal isOpen={isStoreOpen} onClose={() => setStoreOpen(false)} userData={userData} />
      
      {/* 頭像選擇器 */}
      <AvatarSelectorModal 
        isOpen={isAvatarSelectorOpen} 
        onClose={() => setAvatarSelectorOpen(false)} 
        currentFrame={currentFrame}
        onAvatarUpdate={handleAvatarUpdate}
      />
    </div>
  );
}
