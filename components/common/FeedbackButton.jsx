// components/common/FeedbackButton.jsx
"use client";

import { useState } from "react";
import FeedbackModal from "./FeedbackModal";

export default function FeedbackButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* 右下角固定按鈕 */}
      <div className="fixed bottom-24 right-20 z-50">
        <button
          onClick={() => setIsOpen(true)}
          className="bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded-full shadow-lg"
        >
          我要回報
        </button>
      </div>

      {/* 回報彈窗 */}
      {isOpen && <FeedbackModal onClose={() => setIsOpen(false)} />}
    </>
  );
}
