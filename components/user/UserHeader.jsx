// components/user/UserHeader.jsx
"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import axios from "axios";
import AvatarCropModal from "./AvatarCropModal";
import { uploadToCloudflare } from "@/lib/uploadToCloudflare";
import { DEFAULT_AVATAR_IDS } from "@/lib/constants";
import { Pencil } from "lucide-react";
import FollowListButton from "./FollowListButton";

const cloudflarePrefix = "https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/";

// ✅ 先拿 userId，再退回 _id / id（相容關係文件與純 id）
const idOf = (v) => {
  if (!v) return "";
  if (typeof v === "string") return v;
  return String(v?.userId?._id || v?.userId || v?._id || v?.id || "");
};

// ✅ 取 cookie 裡的 JWT
const getTokenFromCookie = () => {
  const m = typeof document !== "undefined" && document.cookie.match(/token=([^;]+)/);
  return m ? m[1] : "";
};

export default function UserHeader({ userData, currentUser, onUpdate, onEditOpen }) {
  const isOwnProfile =
    !!currentUser && !!userData && String(currentUser._id) === String(userData._id);

  // ====== 頭像 / 追蹤狀態 ======
  const [showCropModal, setShowCropModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

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
        if (String(currentUser._id) === String(userData._id)) return; // 自己看自己不用抓
        const res = await fetch("/api/follow", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        const list = Array.isArray(data?.following) ? data.following : [];
        const ids = list.map(idOf).filter(Boolean);
        setIsFollowing(ids.includes(String(userData._id)));
      } catch (e) {
        console.warn("載入最新追蹤清單失敗：", e);
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

  // ====== 更換頭像 ======
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result);
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (croppedFile) => {
    try {
      const imageId = await uploadToCloudflare(croppedFile);
      await axios.put("/api/update-avatar", { imageUrl: imageId });
      onUpdate?.();
    } catch (error) {
      console.error("❌ 頭像更新失敗:", error);
    }
  };

  // ====== 追蹤 / 取消追蹤 ======
  const handleFollowToggle = async () => {
    try {
      if (followLoading || !currentUser?._id || !userData?._id) return;
      setFollowLoading(true);

      const willFollow = !isFollowing;
      setIsFollowing(willFollow); // 樂觀更新

      // 在 1 秒內暫時不要讓外部 currentUser 覆蓋本地狀態
      suppressAutoSyncRef.current = true;
      setTimeout(() => {
        suppressAutoSyncRef.current = false;
      }, 1000);

      const token = getTokenFromCookie();
      const headers = {
        Authorization: token ? `Bearer ${token}` : undefined,
        "Content-Type": "application/json",
      };

      if (willFollow) {
        await axios.post("/api/follow", { userIdToFollow: userData._id }, { headers });
      } else {
        await axios.delete("/api/follow", { data: { userIdToUnfollow: userData._id }, headers });
      }

      // ✅ 就地回寫 currentUser.following，避免被舊值覆蓋回去
      if (currentUser) {
        const prevIds = (currentUser.following || []).map(idOf).filter(Boolean);
        const nextIds = willFollow
          ? Array.from(new Set([...prevIds, String(userData._id)]))
          : prevIds.filter((id) => id !== String(userData._id));
        currentUser.following = nextIds;
      }

      // 父層有提供 onUpdate 就讓它重抓（可有可無）
      onUpdate?.();

      // 廣播同步其他元件 / 頁面
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("follow-changed", {
            detail: { targetUserId: String(userData._id), isFollowing: willFollow },
          })
        );
      }
    } catch (error) {
      // 失敗 → 回滾 + 提示
      setIsFollowing((prev) => !prev);
      if (error?.response?.status === 401) {
        alert("請先登入再進行追蹤");
      } else {
        console.error("❌ 切換追蹤失敗:", error);
        alert("追蹤更新失敗");
      }
    } finally {
      setFollowLoading(false);
    }
  };

  // 頭像 URL（有自訂就用，沒有按性別/未公開選預設）
  const imageId =
    typeof userData?.image === "string" && userData.image.trim() !== ""
      ? userData.image
      : DEFAULT_AVATAR_IDS[userData?.gender] || DEFAULT_AVATAR_IDS.hidden;
  const imageUrl = `${cloudflarePrefix}${imageId}/avatar`;

  return (
    <div className="flex flex-col gap-4 mb-4 mt-[-55px]">
      {/* 頭像 + 基本資訊 */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <Image
            src={imageUrl}
            alt="User avatar"
            width={96}
            height={96}
            className="rounded-full object-cover border border-gray-300"
          />
          {isOwnProfile && (
            <>
              <label className="absolute bottom-0 right-0 bg-blue-500 text-white text-xs rounded-full px-2 py-1 cursor-pointer hover:bg-blue-600">
                更換
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              <AvatarCropModal
                isOpen={showCropModal}
                onClose={() => setShowCropModal(false)}
                imageSrc={selectedImage}
                onCropComplete={handleCropComplete}
              />
            </>
          )}
        </div>

        <div className="flex-1">
          <h1 className="text-2xl font-bold">{userData.username}</h1>

          {isOwnProfile ? (
            <p className="text-sm text-gray-400">{userData.email}</p>
          ) : userData.isVerified ? (
            <p className="text-sm text-green-400">✅ 此帳號已驗證</p>
          ) : (
            <p className="text-sm text-red-500">❗ 尚未驗證信箱</p>
          )}

          <p className="text-sm text-gray-400">
            註冊時間：
            {userData.createdAt && !isNaN(new Date(userData.createdAt).getTime())
              ? new Date(userData.createdAt).toLocaleDateString("zh-TW", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                })
              : "未知"}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {isOwnProfile ? (
              <>
                <button
                  onClick={() => onEditOpen?.()}
                  className="h-9 px-3 bg-zinc-700 hover:bg-zinc-600 rounded text-sm flex items-center gap-1"
                >
                  <Pencil size={14} />
                  編輯資料
                </button>
                <FollowListButton currentUser={currentUser} userId={userData._id} />
              </>
            ) : currentUser && userData ? (
              <button
                onClick={handleFollowToggle}
                className={`h-9 px-3 text-sm rounded ${
                  isFollowing ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
                } ${followLoading ? "opacity-60 cursor-not-allowed" : ""}`}
                disabled={followLoading}
              >
                {isFollowing ? "取消追蹤" : "追蹤"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
