"use client";
import { useRef, useState } from "react";
import axios from "axios";
import { X, Trash2 } from "lucide-react";

export default function ImageInfoBox({ image, currentUser, onClose }) {
  const positiveRef = useRef();
  const negativeRef = useRef();
  const [copiedField, setCopiedField] = useState(null);

  const handleDelete = async () => {
    const confirmed = window.confirm("你確定要刪除這張圖片嗎？");
    if (!confirmed) return;

    const token = document.cookie.match(/token=([^;]+)/)?.[1];
    if (!token) return;

    try {
      const res = await axios.delete("/api/delete-image", {
        data: { imageId: image._id },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 200) {
        alert("圖片刪除成功！");
        onClose?.();
        window.scrollTo(0, 0);
        setTimeout(() => {
          window.location.reload();
        }, 50);
      } else {
        alert("刪除失敗，請稍後再試。");
      }
    } catch (err) {
      console.error("❌ 刪除圖片失敗", err);
      alert("刪除失敗，請稍後再試。");
    }
  };

  const copyToClipboard = (ref, field) => {
    if (ref.current) {
      navigator.clipboard.writeText(ref.current.innerText);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    }
  };

  const getRatingLabel = (rating) => {
    switch (rating) {
      case "18":
        return <span className="bg-red-500 text-white text-xs px-2 py-1 rounded">18+</span>;
      case "15":
        return <span className="bg-yellow-500 text-white text-xs px-2 py-1 rounded">15+</span>;
      default:
        return <span className="bg-green-600 text-white text-xs px-2 py-1 rounded">一般</span>;
    }
  };

  return (
    <div className="relative w-full overflow-x-hidden break-words space-y-4">
      {/* 🔥 標題與控制按鈕 */}
      <div className="flex justify-between items-start mb-3">
        <div className="text-xl font-bold leading-tight text-white">
          {image.title || "（無標題）"}
        </div>
        <div className="flex items-center gap-2">
          {currentUser &&
            (currentUser._id === image.user?._id || currentUser.isAdmin) && (
              <button
                onClick={handleDelete}
                className="flex items-center gap-1 px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded shadow transition"
                title="刪除圖片"
              >
                <Trash2 size={16} />
              </button>
            )}
          <button
            onClick={onClose}
            className="text-white hover:text-red-400 transition"
            title="關閉視窗"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* 📌 分級標籤 */}
      <div className="mb-3">{getRatingLabel(image.rating)}</div>

      {/* 📌 平台資訊 */}
      <div className="text-sm text-gray-300 mb-3">
        平台：{image.platform || "未指定"}
      </div>

      {/* ✅ 模型與 LORA 名稱 */}
      <div className="text-sm text-gray-300 mb-3">
        模型名稱：
        <span className="text-white ml-1 break-words inline-block max-w-[150px] align-top">
          {image.modelName || "（無）"}
        </span>
      </div>

      <div className="text-sm text-gray-300 mb-3">
        LoRA 名稱：
        <span className="text-white ml-1 break-words inline-block max-w-[220px] align-top">
          {image.loraName || "（無）"}
        </span>
      </div>

      {/* 📌 分類 */}
      <div className="text-sm text-gray-300 mb-3">
        分類：{image.category || "未分類"}
      </div>

      {/* 📌 標籤 */}
      <div className="text-sm text-gray-300 mb-3">
        標籤：
        {Array.isArray(image.tags) && image.tags.length > 0
          ? image.tags.map((tag, index) => (
              <span
                key={index}
                className="inline-block bg-gray-700 text-white text-xs px-2 py-1 rounded mr-1 mb-1"
              >
                {tag}
              </span>
            ))
          : "（無標籤）"}
      </div>

      {/* ✅ 正面提示詞 */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1">
          <strong className="text-sm text-white">正面提示詞：</strong>
          <button
            onClick={() => copyToClipboard(positiveRef, "positive")}
            className="text-xs px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded"
          >
            {copiedField === "positive" ? "✔ 已複製" : "複製"}
          </button>
        </div>
        <div
          ref={positiveRef}
          className="bg-neutral-900 border border-white/20 text-gray-200 text-xs p-2 rounded-lg max-h-[80px] overflow-y-auto whitespace-pre-wrap break-words"
        >
          {image.positivePrompt || "（無）"}
        </div>
      </div>

      {/* ✅ 負面提示詞 */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <strong className="text-sm text-white">負面提示詞：</strong>
          <button
            onClick={() => copyToClipboard(negativeRef, "negative")}
            className="text-xs px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded"
          >
            {copiedField === "negative" ? "✔ 已複製" : "複製"}
          </button>
        </div>
        <div
          ref={negativeRef}
          className="bg-neutral-900 border border-white/20 text-gray-200 text-xs p-2 rounded-lg max-h-[80px] overflow-y-auto whitespace-pre-wrap break-words"
        >
          {image.negativePrompt || "（無）"}
        </div>
      </div>

      {/* ✅ 描述 */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <strong className="text-base text-white">描述：</strong>
        </div>
        <div className="bg-neutral-900 border border-white/20 text-gray-200 text-base p-3 rounded-lg whitespace-pre-wrap break-words">
          {image.description || "（無）"}
        </div>
      </div>
    </div>
  );
}
