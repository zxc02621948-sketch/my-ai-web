"use client";

import { useEffect } from "react";

export default function ConfirmModal({ 
  isOpen, 
  onConfirm,
  onCancel,
  title, 
  message,
  confirmText = "確定",
  cancelText = "取消",
  confirmType = "danger" // "danger", "warning", "primary"
}) {
  useEffect(() => {
    if (isOpen) {
      const handleEscape = (e) => {
        if (e.key === "Escape") {
          onCancel();
        }
      };
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const getConfirmButtonStyles = () => {
    switch (confirmType) {
      case "danger":
        return "bg-red-600 hover:bg-red-700 text-white";
      case "warning":
        return "bg-amber-600 hover:bg-amber-700 text-white";
      default:
        return "bg-purple-600 hover:bg-purple-700 text-white";
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100001]">
      <div className="bg-zinc-800 rounded-xl p-6 max-w-md mx-4 border-2 border-amber-500/50 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">⚠️</span>
          <h3 className="text-xl font-bold text-amber-400">
            {title || "確認操作"}
          </h3>
        </div>
        
        <div className="mb-6">
          {typeof message === 'string' ? (
            <p className="text-gray-300 whitespace-pre-line">{message}</p>
          ) : (
            <div className="text-gray-300">{message}</div>
          )}
        </div>
        
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-6 py-3 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors font-semibold"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-6 py-3 rounded-lg transition-colors font-semibold ${getConfirmButtonStyles()}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

