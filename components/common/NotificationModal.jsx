"use client";

import { useEffect } from "react";

export default function NotificationModal({ 
  isOpen, 
  onClose, 
  type = "info", // "success", "error", "warning", "info"
  title, 
  message, 
  autoClose = false,
  autoCloseDelay = 3000 
}) {
  useEffect(() => {
    if (isOpen && autoClose) {
      const timer = setTimeout(() => {
        onClose();
      }, autoCloseDelay);
      
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoClose, autoCloseDelay, onClose]);

  if (!isOpen) return null;

  const getTypeStyles = () => {
    switch (type) {
      case "success":
        return {
          borderColor: "border-green-500/50",
          titleColor: "text-green-400",
          icon: "✅"
        };
      case "error":
        return {
          borderColor: "border-red-500/50",
          titleColor: "text-red-400",
          icon: "❌"
        };
      case "warning":
        return {
          borderColor: "border-yellow-500/50",
          titleColor: "text-yellow-400",
          icon: "⚠️"
        };
      default:
        return {
          borderColor: "border-blue-500/50",
          titleColor: "text-blue-400",
          icon: "ℹ️"
        };
    }
  };

  const styles = getTypeStyles();

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100001]">
      <div className={`bg-zinc-800 rounded-xl p-6 max-w-md mx-4 border-2 ${styles.borderColor} shadow-2xl`}>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">{styles.icon}</span>
          <h3 className={`text-xl font-bold ${styles.titleColor}`}>
            {title}
          </h3>
        </div>
        
        <div className="mb-6">
          {typeof message === 'string' ? (
            <p className="text-gray-300 whitespace-pre-line">{message}</p>
          ) : (
            <div className="text-gray-300">{message}</div>
          )}
        </div>
        
        <div className="flex justify-center">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold"
          >
            確定
          </button>
        </div>
      </div>
    </div>
  );
}