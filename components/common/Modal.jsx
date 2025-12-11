"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function Modal({ isOpen, onClose, title, children, bottomOffset = 80, zIndex = 99999 }) {
  const [mounted, setMounted] = useState(false);

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

  // ✅ 添加 Escape 鍵支持
  useEffect(() => {
    if (!isOpen) return;
    
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    setMounted(true);
    
    // ✅ 監聽關閉所有模態框的事件（登出時使用）
    const handleCloseAll = () => {
      if (isOpen) {
        onClose();
      }
    };
    window.addEventListener("closeAllModals", handleCloseAll);
    
    return () => {
      setMounted(false);
      window.removeEventListener("closeAllModals", handleCloseAll);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 overflow-hidden" style={{ zIndex }}>
      {/* 背景遮罩 */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 彈窗內容 */}
      <div
        className="flex justify-center items-start min-h-screen px-4 pt-24"
        style={{ paddingBottom: `${bottomOffset}px` }} // ⬅ 底部留白，預設 80px
      >
        <div
          className="relative z-10 bg-zinc-900 text-white rounded-2xl shadow-xl p-6 w-full max-w-md overflow-y-auto"
          style={{
            maxHeight: `calc(85vh - ${bottomOffset}px)` // ⬅ 高度為 85vh
          }}
        >
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
    </div>,
    document.body
  );
}
