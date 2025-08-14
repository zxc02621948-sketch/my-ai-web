"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function InboxButton() {
  const [unread, setUnread] = useState(0);

  async function refreshUnread() {
    try {
      const r = await fetch("/api/messages/unread-count", { cache: "no-store" });
      const j = await r.json();
      setUnread(j?.unread || 0);
    } catch {}
  }

  useEffect(() => {
    // 1) 頁面載入先抓一次
    refreshUnread();
    // 2) 監聽聊天頁廣播的「inbox:refresh」事件 → 立刻刷新
    const handler = () => refreshUnread();
    window.addEventListener("inbox:refresh", handler);
    // 3) 仍保留輕量輪詢，避免跨分頁不同步
    const timer = setInterval(refreshUnread, 30000);
    return () => { window.removeEventListener("inbox:refresh", handler); clearInterval(timer); };
  }, []);

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
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-zinc-900" />
      )}
    </Link>
  );
}
