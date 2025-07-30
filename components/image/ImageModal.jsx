"use client";

import { Dialog } from "@headlessui/react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Trash2 } from "lucide-react";
import ImageViewer from "./ImageViewer";
import CommentBox from "./CommentBox";
import axios from "axios";

const defaultAvatarUrl =
  "https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/b479a9e9-6c1a-4c6a-94ff-283541062d00/public";

export default function ImageModal({
  image,
  onClose,
  currentUser,
  isLikedByCurrentUser,
  onToggleLike,
}) {
  const [comments, setComments] = useState([]);
  const router = useRouter();

  const positiveRef = useRef();
  const negativeRef = useRef();
  const [copiedField, setCopiedField] = useState(null);

  const handleCopy = (ref, field) => {
    if (ref.current) {
      navigator.clipboard.writeText(ref.current.innerText);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    }
  };

  useEffect(() => {
    if (!image?._id) return;
    fetch(`/api/comments/${image._id}`)
      .then((res) => res.json())
      .then(setComments)
      .catch((err) => console.error("讀取留言失敗", err));
  }, [image]);

  const handleUserClick = () => {
    if (image?.user?._id) {
      router.push(`/user/${image.user._id}`);
      onClose();
    }
  };

  const handleDelete = async (imageId) => {
    const confirmed = window.confirm("你確定要刪除這張圖片嗎？");
    if (!confirmed) return;

    const match = document.cookie.match(/token=([^;]+)/);
    const token = match ? match[1] : null;

    try {
      const res = await axios.delete("/api/delete-image", {
        data: { imageId },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status < 200 || res.status >= 300) throw new Error("刪除失敗");
      alert("圖片刪除成功！");
      window.location.reload();
      onClose();
    } catch (err) {
      console.error("刪除圖片錯誤：", err);
      alert("刪除失敗，請稍後再試。");
    }
  };

  if (!image) return null;

  const hasValidImage =
    typeof image?.user?.image === "string" && image.user.image.trim().length > 0;

  const userImageUrl = hasValidImage
    ? `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${image.user.image}/public`
    : defaultAvatarUrl;

  return (
    <Dialog open={!!image} onClose={onClose}>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="absolute inset-0" onClick={onClose} />

        <div
          className="relative z-10 w-full max-w-6xl bg-[#1a1a1a] text-white rounded-xl shadow-lg flex flex-col lg:flex-row overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 左側圖片 */}
          <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
            <ImageViewer
              key={image._id + (image.likes?.length || 0)}
              image={image}
              currentUser={currentUser}
              isLiked={isLikedByCurrentUser(image)}
              onToggleLike={onToggleLike}
            />
          </div>

          {/* 右側資訊與留言 */}
          <div className="w-full lg:w-[400px] max-h-[90vh] overflow-y-auto border-l border-white/10 p-4 flex flex-col relative">
            {/* 標題列與操作按鈕 */}
            <div className="flex justify-between items-start mb-4">
              <div className="flex flex-col">
                <div className="text-xl font-bold leading-tight">
                  {image.title || "（無標題）"}
                </div>
                {image.rating && (
                  <div
                    className={`mt-1 px-2 py-0.5 rounded text-xs font-bold w-fit ${
                      image.rating === "18"
                        ? "bg-red-600 text-white"
                        : image.rating === "15"
                        ? "bg-yellow-400 text-black"
                        : "bg-green-600 text-white"
                    }`}
                  >
                    {image.rating === "18"
                      ? "18+"
                      : image.rating === "15"
                      ? "15+"
                      : "一般"}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {currentUser &&
                  (currentUser._id === image.user?._id ||
                    currentUser.isAdmin) && (
                    <button
                      onClick={() => handleDelete(image._id)}
                      className="flex items-center gap-1 px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded shadow transition"
                      title="刪除圖片"
                    >
                      <Trash2 size={16} />
                      刪除
                    </button>
                  )}
                <button
                  onClick={onClose}
                  className="text-white hover:text-red-400 transition"
                  title="關閉視窗"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* 頭像與使用者 */}
            <div
              className="absolute top-20 right-4 flex flex-col items-center cursor-pointer"
              onClick={handleUserClick}
            >
              <img
                src={userImageUrl}
                alt="User Avatar"
                className="w-20 h-20 rounded-full object-cover border border-white shadow"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = defaultAvatarUrl;
                }}
              />
              <span className="text-sm mt-2 text-center text-white">
                {image.user?.username || "未命名用戶"}
              </span>
            </div>

            {/* 圖片資訊 */}
            <div className="text-sm text-gray-300 mb-2">
              平台：{image.platform || "未知"}
            </div>
            <div className="text-sm text-gray-300 mb-2">
              分類：{image.category || "未分類"}
            </div>
            <div className="text-sm text-gray-300 mb-2">
              標籤：
              {(image.tags?.length ?? 0) > 0
                ? image.tags.join(", ")
                : "（無標籤）"}
            </div>
            <div className="text-sm text-gray-400 mb-4">
              描述：{image.description || "（無）"}
            </div>

            {/* 正面提示詞 */}
            <div className="mt-2 mb-2">
              <div className="flex justify-between items-center text-sm font-bold mb-1">
                <span>正面提示詞：</span>
                <button
                  onClick={() => handleCopy(positiveRef, "positive")}
                  className="text-xs px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded"
                >
                  {copiedField === "positive" ? "✔ 已複製" : "複製"}
                </button>
              </div>
              <div
                ref={positiveRef}
                className="bg-gray-800 p-2 rounded max-h-24 overflow-y-auto text-xs whitespace-pre-wrap break-words"
              >
                {image.positivePrompt || "（無）"}
              </div>
            </div>

            {/* 負面提示詞 */}
            <div className="mt-2 mb-4">
              <div className="flex justify-between items-center text-sm font-bold mb-1">
                <span>負面提示詞：</span>
                <button
                  onClick={() => handleCopy(negativeRef, "negative")}
                  className="text-xs px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded"
                >
                  {copiedField === "negative" ? "✔ 已複製" : "複製"}
                </button>
              </div>
              <div
                ref={negativeRef}
                className="bg-gray-800 p-2 rounded max-h-24 overflow-y-auto text-xs whitespace-pre-wrap break-words"
              >
                {image.negativePrompt || "（無）"}
              </div>
            </div>

            {/* 留言輸入區 */}
            <div className="mt-4">
              {currentUser === undefined ? (
                <div className="text-sm text-yellow-400 mt-2">
                  登入狀態載入中...
                </div>
              ) : (
                <CommentBox
                  currentUser={currentUser}
                  imageId={image._id}
                  onAddComment={(c) => setComments([c, ...comments])}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
