"use client";
import { useState } from "react";
import FollowListModal from "./FollowListModal";

export default function FollowListButton({ currentUser, userId }) {
  const [isOpen, setIsOpen] = useState(false);

  // ✅ 限制只有自己看自己頁面才會顯示按鈕
  if (!currentUser || (currentUser._id !== userId && currentUser.id !== userId)) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
      >
        已追蹤
      </button>
      <FollowListModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        currentUser={currentUser} 
      />
    </>
  );
}
