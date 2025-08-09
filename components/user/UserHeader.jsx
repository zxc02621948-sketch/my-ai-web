// components/user/UserHeader.jsx
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import axios from "axios";
import AvatarCropModal from "./AvatarCropModal";
import { uploadToCloudflare } from "@/lib/uploadToCloudflare";
import { DEFAULT_AVATAR_IDS } from "@/lib/constants";
import { Pencil } from "lucide-react";
import FollowListButton from "./FollowListButton";

const cloudflarePrefix = "https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/";

export default function UserHeader({ userData, currentUser, onUpdate, onEditOpen }) {
  const isOwnProfile =
    !!currentUser && !!userData && String(currentUser._id) === String(userData._id);

  // ====== 頭像 / 追蹤狀態 ======
  const [showCropModal, setShowCropModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    if (!currentUser || !userData) return;
    const isSelf = String(currentUser._id) === String(userData._id);
    if (!isSelf) {
      const following = currentUser.following ?? [];
      const followed = following.some((id) => String(id) === String(userData._id));
      setIsFollowing(followed);
    } else {
      setIsFollowing(false);
    }
  }, [currentUser, userData]);

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
      if (followLoading) return;
      setFollowLoading(true);
      if (isFollowing) {
        await axios.delete("/api/follow", { data: { userIdToUnfollow: userData._id } });
      } else {
        await axios.post("/api/follow", { userIdToFollow: userData._id });
      }
      setIsFollowing(!isFollowing);
    } catch (error) {
      console.error("❌ 切換追蹤失敗:", error);
    } finally {
      setFollowLoading(false);
    }
  };

  // 頭像 URL
  const imageId =
    typeof userData.image === "string" && userData.image.trim() !== ""
      ? userData.image
      : DEFAULT_AVATAR_IDS[userData.gender] || DEFAULT_AVATAR_IDS.hidden;
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
                }`}
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
