// components/user/UserHeader.jsx
import { useState } from "react";
import Image from "next/image";
import axios from "axios";
import AvatarCropModal from "./AvatarCropModal";
import { uploadToCloudflare } from "@/lib/uploadToCloudflare";
import { DEFAULT_AVATAR_IDS } from "@/lib/constants";
import { Pencil } from "lucide-react";

const cloudflarePrefix = "https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/";

export default function UserHeader({ userData, currentUser, onUpdate, onEditOpen }) {
  const isOwnProfile = currentUser && currentUser._id === userData._id;

  const [showCropModal, setShowCropModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result); // base64
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (croppedFile) => {
    try {
      const imageId = await uploadToCloudflare(croppedFile); // ✅ 用剛上傳的 ID
      await axios.put("/api/update-avatar", { imageUrl: imageId });
      onUpdate(); // 🔁 更新用戶資料（重新 fetch）
    } catch (error) {
      console.error("❌ 頭像更新失敗:", error);
    }
  };

  const imageId =
    typeof userData.image === "string" && userData.image.trim() !== ""
      ? userData.image
      : DEFAULT_AVATAR_IDS[userData.gender] || DEFAULT_AVATAR_IDS.hidden;

  const imageUrl = `${cloudflarePrefix}${imageId}/avatar`;

  return (
    <div className="flex items-center gap-4 mb-4 mt-[-55px]">
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
      <div>
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

        {isOwnProfile && (
          <button
            onClick={() => onEditOpen?.()}
            className="mt-2 px-3 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-sm flex items-center gap-1"
          >
            <Pencil size={14} />
            編輯資料
          </button>
        )}
      </div>
    </div>
  );
}
