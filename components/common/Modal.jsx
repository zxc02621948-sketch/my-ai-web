"use client";

import { useEffect } from "react";

export default function Modal({ isOpen, onClose, title, children }) {
  // ✅ 鎖住背景 scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* 背景遮罩 */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 彈窗內容 */}
      <div className="flex justify-center items-center min-h-screen px-4">
        <div className="relative z-10 bg-zinc-900 text-white rounded-2xl shadow-xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto">
          {/* 標題區域 */}
          <h2 className="text-lg font-semibold mb-4 text-center">{title}</h2>

          {/* 關閉按鈕 */}
          <button
            onClick={onClose}
            className="absolute top-3 right-4 text-gray-400 hover:text-gray-200 text-lg"
            aria-label="關閉"
          >
            ×
          </button>

          {/* 彈窗內容 */}
          {children}
        </div>
      </div>
    </div>
  );
}
