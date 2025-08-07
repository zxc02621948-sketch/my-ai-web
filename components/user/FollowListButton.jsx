"use client";
import { useState } from "react";
import FollowListModal from "./FollowListModal";

export default function FollowListButton({ currentUser, userId }) {
  const [isOpen, setIsOpen] = useState(false);

  // 還在載入登入者資料：不渲染，避免閃爍
  if (currentUser === undefined || userId === undefined || userId === null) return null;

  const selfId = String(currentUser?._id ?? currentUser?.id ?? "");
  const targetId = String(userId ?? "");

  // 只有「自己看自己頁面」才顯示
  const isOwnProfile = !!selfId && !!targetId && selfId === targetId;
  if (!isOwnProfile) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="h-9 px-3 rounded text-sm border border-blue-500 text-blue-400
                   hover:bg-blue-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        查看已追蹤
      </button>
      <FollowListModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        currentUser={currentUser}
      />
    </>
  );
}
