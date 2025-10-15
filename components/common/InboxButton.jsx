"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/contexts/CurrentUserContext";

export default function InboxButton() {
  const { unreadCounts, fetchUnreadCounts, updateUnreadCount } = useCurrentUser();

  useEffect(() => {
    const refreshMessages = () => {
      fetchUnreadCounts(true); // 強制刷新消息計數
    };

    // 1) 頁面載入先抓一次
    fetchUnreadCounts();
    
    // 2) 監聽聊天頁廣播的「inbox:refresh」事件 → 立刻刷新
    window.addEventListener("inbox:refresh", refreshMessages);
    
    return () => { 
      window.removeEventListener("inbox:refresh", refreshMessages); 
    };
  }, [fetchUnreadCounts]);

  return (
    <Link
      href="/messages"
      aria-label="站內信"
      className="relative inline-flex items-center justify-center h-9 w-9 rounded-lg hover:bg-zinc-800 transition"
    >
      {/* 信封圖示（簡單 SVG，不吃外部套件） */}
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5 text-zinc-200"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
        <path d="m22 8-10 6L2 8" />
      </svg>

      {/* 紅點（有未讀時顯示） */}
      {unreadCounts.messages > 0 && (
        <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-zinc-900" />
      )}
    </Link>
  );
}
