"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Heart, MessageCircle, UserPlus, UserMinus, Star } from "lucide-react";
import AvatarFrame from "@/components/common/AvatarFrame";
import { useCurrentUser } from "@/contexts/CurrentUserContext";

export default function AuthorCard({ 
  author, 
  compact = false, // 是否為緊湊模式（用於帖子卡片）
  showStats = true, // 是否顯示統計數據
  showBio = true, // 是否顯示個人簡介
  className = ""
}) {
  const { currentUser } = useCurrentUser();
  const router = useRouter();
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [userStats, setUserStats] = useState(null);

  const isOwnProfile = currentUser && author && currentUser._id === author._id;

  // 獲取用戶統計數據
  useEffect(() => {
    const fetchUserStats = async () => {
      if (!author?._id) return;
      
      try {
        const response = await fetch(`/api/user/${author._id}/stats`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setUserStats(data.data);
          }
        }
      } catch (error) {
        console.error("獲取用戶統計數據失敗:", error);
      }
    };

    fetchUserStats();
  }, [author?._id]);

  // 獲取追蹤狀態
  useEffect(() => {
    const fetchFollowStatus = async () => {
      if (!currentUser || !author?._id || isOwnProfile) return;
      
      try {
        const response = await fetch(`/api/follow/status?userId=${author._id}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setIsFollowing(data.isFollowing);
          }
        }
      } catch (error) {
        console.error("獲取追蹤狀態失敗:", error);
      }
    };

    fetchFollowStatus();
  }, [currentUser, author?._id, isOwnProfile]);

  // 處理追蹤/取消追蹤
  const handleFollowToggle = async () => {
    if (!currentUser || !author?._id || isOwnProfile || followLoading) return;
    
    setFollowLoading(true);
    const willFollow = !isFollowing;
    setIsFollowing(willFollow);
    
    try {
      const token = document.cookie.match(/token=([^;]+)/)?.[1];
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      if (willFollow) {
        await fetch("/api/follow", {
          method: "POST",
          headers,
          body: JSON.stringify({ userIdToFollow: author._id }),
        });
      } else {
        await fetch("/api/follow", {
          method: "DELETE",
          headers,
          body: JSON.stringify({ userIdToUnfollow: author._id }),
        });
      }

      // 廣播狀態更新
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("follow-changed", {
            detail: { targetUserId: String(author._id), isFollowing: willFollow },
          })
        );
      }
    } catch (error) {
      console.error("追蹤操作失敗:", error);
      setIsFollowing(!willFollow); // 回滾狀態
    } finally {
      setFollowLoading(false);
    }
  };

  const handleUserClick = () => {
    router.push(`/user/${author._id}`);
  };

  if (!author) return null;

  return (
    <div className={`bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 ${className}`}>
      <div className="flex items-start gap-4">
        {/* 頭像和查看檔案按鈕 */}
        <div className="flex-shrink-0 flex flex-col items-center gap-2">
          <div
            onClick={handleUserClick}
            className="cursor-pointer"
          >
            <AvatarFrame
              src={author.image}
              size={compact ? 48 : 64}
              userId={author._id}
              frameId={author.currentFrame || "default"}
              showFrame={true}
              frameColor={author.frameSettings?.[author.currentFrame || "default"]?.color || "#ffffff"}
              frameOpacity={author.frameSettings?.[author.currentFrame || "default"]?.opacity || 1}
              layerOrder={author.frameSettings?.[author.currentFrame || "default"]?.layerOrder || "frame-on-top"}
              frameTransparency={author.frameSettings?.[author.currentFrame || "default"]?.frameOpacity || 1}
            />
          </div>
          
          <button
            onClick={handleUserClick}
            className="flex items-center gap-1 px-3 py-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-lg text-sm font-semibold transition-all shadow-lg hover:shadow-xl"
          >
            <Star size={14} />
            查看檔案
          </button>
        </div>

        {/* 用戶信息 */}
        <div className="flex-1 min-w-0">
          {/* 用戶名和等級 */}
          <div className="flex items-center gap-2 mb-2">
            <h3 
              onClick={handleUserClick}
              className="text-lg font-semibold text-white hover:text-blue-400 transition-colors cursor-pointer"
            >
              {author.username}
            </h3>
            {author.level && (
              <span className="px-2 py-1 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs rounded-full font-semibold">
                LV{author.level}
              </span>
            )}
          </div>

          {/* 個人簡介 */}
          {showBio && author.bio && (
            <p className="text-sm text-gray-300 mb-3 line-clamp-2">
              {author.bio}
            </p>
          )}

          {/* 統計數據 */}
          {showStats && userStats && (
            <div className="grid grid-cols-6 gap-1 mb-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{userStats.worksCount || 0}</div>
                <div className="text-xs text-gray-400">作品</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-400">{userStats.followersCount || 0}</div>
                <div className="text-xs text-gray-400">追蹤者</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400">{userStats.followingCount || 0}</div>
                <div className="text-xs text-gray-400">追蹤中</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-400">{userStats.favoritesCount || 0}</div>
                <div className="text-xs text-gray-400">收藏</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-400">{userStats.likesCount || 0}</div>
                <div className="text-xs text-gray-400">點讚</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">{userStats.commentsCount || 0}</div>
                <div className="text-xs text-gray-400">評論</div>
              </div>
            </div>
          )}

          {/* 操作按鈕 */}
          {!isOwnProfile && currentUser && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleFollowToggle}
                disabled={followLoading}
                className={`flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                  isFollowing
                    ? "bg-zinc-700 text-gray-300 hover:bg-zinc-600"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                } disabled:opacity-50`}
              >
                {followLoading ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : isFollowing ? (
                  <>
                    <UserMinus size={14} />
                    取消追蹤
                  </>
                ) : (
                  <>
                    <UserPlus size={14} />
                    追蹤
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
