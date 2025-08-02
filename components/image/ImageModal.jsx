// ImageModal.jsx
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
  imageId,
  onClose,
  currentUser,
  onLikeUpdate, // ⬅️ 要加這行
}) {
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showScrollTop, setShowScrollTop] = useState(false);
  const scrollRef = useRef(null);
  const router = useRouter();

  const positiveRef = useRef();
  const negativeRef = useRef();
  const [copiedField, setCopiedField] = useState(null);

  useEffect(() => {
    const fetchImage = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/images/${imageId}`);
        const data = await res.json();
        console.log("✅ API 回傳資料：", data); // ⬅️ 加這行
        if (!res.ok) throw new Error("找不到該圖片，可能已被刪除");
        setImage(data.image);
      } catch (err) {
        console.error("❌ 載入圖片失敗", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (imageId) fetchImage();
  }, [imageId]);

  const handleCopy = (ref, field) => {
    if (ref.current) {
      navigator.clipboard.writeText(ref.current.innerText);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    }
  };

  const handleScroll = () => {
    const top = scrollRef.current?.scrollTop || 0;
    setShowScrollTop(top > 200);
  };

  const handleScrollToTop = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

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

  if (!imageId) return null;

  return (
    <Dialog open={!!imageId} onClose={onClose}>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="absolute inset-0" onClick={onClose} />

        <div
          className="relative z-10 w-full max-w-6xl bg-[#1a1a1a] text-white rounded-xl shadow-lg flex flex-col lg:flex-row overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 左邊圖片顯示區 */}
          <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
            {loading ? (
              <div className="text-gray-400">載入中...</div>
            ) : error ? (
              <div className="text-red-400 font-bold text-lg text-center">{error}</div>
            ) : (
              <ImageViewer
                key={image._id + (image.likes?.length || 0)}
                image={image}
                currentUser={currentUser}
                isLiked={image.likes.includes(currentUser?._id)}
                onToggleLike={async () => {
                  try {
                    const token = document.cookie.match(/token=([^;]+)/)?.[1];
                    if (!token || !currentUser?._id) return;

                    const res = await axios.put(`/api/like-image?id=${image._id}`, null, {
                      headers: { Authorization: `Bearer ${token}` },
                    });

                    if (res.status === 200 && res.data) {
                      const updated = {
                        ...image,
                        likes: res.data.likes,
                      };
                      setImage(updated);            // ✅ 更新 modal 狀態
                      onLikeUpdate?.(updated);      // ✅ 通知首頁同步
                    }
                  } catch (err) {
                    console.error("❌ 點讚失敗", err);
                  }
                }}
              />
            )}
          </div>

          {/* 右側留言與資訊欄 */}
          <div className="w-full lg:w-[400px] max-h-[90vh] border-l border-white/10 flex flex-col relative">
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 relative">
              {image && (
                <>
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
                        (currentUser._id === image.user?._id || currentUser.isAdmin) && (
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

                  <div
                    className="absolute top-15 right-10 flex flex-col items-center cursor-pointer"
                    onClick={handleUserClick}
                  >
                    <img
                      src={
                        image.user?.image
                          ? `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${image.user.image}/public`
                          : defaultAvatarUrl
                      }
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

                  <div className="text-sm text-gray-300 mb-2">平台：{image.platform || "未知"}</div>
                  <div className="text-sm text-gray-300 mb-2">分類：{image.category || "未分類"}</div>
                  <div className="text-sm text-gray-300 mb-2">
                    標籤：{(image.tags?.length ?? 0) > 0 ? image.tags.join(", ") : "（無標籤）"}
                  </div>
                  <div className="text-sm text-gray-400 mb-4">描述：{image.description || "（無）"}</div>

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

                  <CommentBox currentUser={currentUser} imageId={image._id} />
                </>
              )}
            </div>

            {showScrollTop && (
              <button
                onClick={handleScrollToTop}
                className="absolute bottom-16 right-4 z-20 text-white bg-sky-400 hover:bg-gray-600 rounded-full w-10 h-10 text-xl flex items-center justify-center shadow"
                title="回到頂部"
              >
                ↑
              </button>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
