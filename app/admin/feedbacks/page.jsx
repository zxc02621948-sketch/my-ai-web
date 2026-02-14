// app/admin/feedbacks/page.jsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { notify } from "@/components/common/GlobalNotificationManager";

export default function FeedbackListPage() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const isSafeHref = (value) => {
    const s = String(value || "").trim();
    if (!s) return false;
    if (s.startsWith("/") && !s.startsWith("//")) return true;
    try {
      const u = new URL(s, "https://placeholder.local");
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  };

  const fetchFeedbacks = async () => {
    try {
      const res = await fetch("/api/feedback");
      const data = await res.json();
      setFeedbacks(data.feedbacks || []);
    } catch (err) {
      setError("⚠️ 無法載入回報資料");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const handleDelete = async (id) => {
    const confirmed = await notify.confirm("確認刪除", "確定要刪除這筆回報嗎？");
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/delete-feedback/${id}`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (result.success) {
        setFeedbacks((prev) => prev.filter((fb) => fb._id !== id));
      } else {
        notify.error("刪除失敗", result.error);
      }
    } catch (err) {
      notify.error("錯誤", "刪除時發生錯誤");
    }
  };

  return (
    <>
      {/* ✅ 固定左上角回首頁按鈕 */}
      <div className="fixed top-4 left-4 z-[1000]">
        <Link
          href="/"
          className="bg-white/90 backdrop-blur-sm text-black px-4 py-2 rounded-lg hover:bg-white shadow-lg font-bold border border-gray-300"
        >
          ← 回首頁
        </Link>
      </div>

      {/* ✅ 主畫面內容 */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">📝 使用者回報列表</h1>

        {loading ? (
          <p className="text-gray-400">載入中...</p>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : feedbacks.length === 0 ? (
          <p className="text-gray-400">目前尚無任何回報。</p>
        ) : (
          <div>
            <ul className="space-y-4">
              {feedbacks.map((fb) => (
                <li
                  key={fb._id}
                  className="border border-zinc-700 p-4 rounded-xl bg-zinc-800 relative"
                >
                  <div className="text-sm text-gray-400 mb-1">
                    類型：
                    <span className="text-white font-medium">{fb.type}</span>｜
                    發送時間：{new Date(fb.createdAt).toLocaleString()}
                  </div>

                  <p className="whitespace-pre-wrap text-white mb-2">{fb.message}</p>

                  <div className="text-sm text-gray-500">
                    🔗 來源頁面：{" "}
                    <Link
                      href={isSafeHref(fb.pageUrl) ? fb.pageUrl : "#"}
                      target="_blank"
                      className="underline break-all"
                    >
                      {fb.pageUrl}
                    </Link>
                  </div>

                  <div className="text-sm mt-1 text-gray-500">
                    👤 回報者：{fb.userId?.username || "（匿名）"}
                  </div>

                  {/* 刪除按鈕 */}
                  <button
                    onClick={() => handleDelete(fb._id)}
                    className="absolute top-3 right-4 text-red-400 hover:text-red-600 text-sm"
                  >
                    🗑 刪除
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}
