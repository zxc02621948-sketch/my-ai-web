// components/Modal.jsx
import React from 'react';

export default function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* ✅ 背景模糊遮罩 */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />

      {/* ✅ Modal 排版區（往上偏） */}
      <div className="flex justify-center items-start min-h-screen mt-10 px-4">
        <div className="bg-zinc-900 text-white rounded-2xl shadow-xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto relative z-10">
          <h2 className="text-lg font-semibold mb-4 text-center">{title}</h2>
          <button
            onClick={onClose}
            className="absolute top-3 right-4 text-gray-400 hover:text-gray-200 text-lg"
          >
            ×
          </button>
          {children}
        </div>
      </div>
    </div>
  );
}
