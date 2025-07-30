"use client";
import { useRef, useState } from "react";
import Link from "next/link"; 

export default function ImageInfoBox({ image, currentUser }) {
  const positiveRef = useRef();
  const negativeRef = useRef();

  const [copiedField, setCopiedField] = useState(null);

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
    <div className="relative w-full max-h-[90vh] overflow-y-auto overflow-x-hidden pr-1">
      <div className="mt-2">
        {/* ✅ 分級標籤 + 頭像＋名稱 同列顯示 */}
        <div className="mb-3">
          {getRatingLabel(image.rating)}
        </div>

        <div className="text-sm text-gray-300 mb-3">
          平台：{image.platform || "未指定"}
        </div>

        <div className="text-sm text-gray-300 mb-3">
          描述：{image.description || "（無）"}
        </div>

        <div className="text-sm text-gray-300 mb-3">
          分類：{image.category || "未分類"}
        </div>

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

        {/* 正面提示詞 */}
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

        {/* 負面提示詞 */}
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
      </div>
    </div>
  );
}
