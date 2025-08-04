// components/common/FeedbackModal.jsx
"use client";

import { useState } from "react";

export default function FeedbackModal({ onClose }) {
  const [type, setType] = useState("bug");
  const [message, setMessage] = useState("");
  const [pageUrl, setPageUrl] = useState(typeof window !== "undefined" ? window.location.href : "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, message, pageUrl }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        setTimeout(() => {
          onClose(); // 自動關閉
        }, 1500);
      }
    } catch (err) {
      console.error("送出失敗", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 text-white rounded-xl shadow-xl p-6 w-full max-w-md relative">
        <button
          className="absolute top-2 right-3 text-white hover:text-red-400"
          onClick={onClose}
        >
          ✕
        </button>

        <h2 className="text-lg font-bold mb-4">問題回報 / 建議</h2>

        {success ? (
          <p className="text-green-400">✅ 感謝您的回報！</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">類型</label>
              <select
                className="w-full p-2 rounded bg-zinc-800 text-white"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="bug">🐞 Bug 問題</option>
                <option value="suggestion">💡 功能建議</option>
                <option value="ux">🧭 使用體驗問題</option>
                <option value="other">🗨️ 其他</option>
              </select>
            </div>

            <div>
              <label className="block text-sm mb-1">描述內容</label>
              <textarea
                className="w-full p-2 rounded bg-zinc-800 text-white h-24 resize-none"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="請描述遇到的問題或想法～"
                required
              />
            </div>

            <div>
              <label className="block text-sm mb-1">當前頁面網址</label>
              <input
                className="w-full p-2 rounded bg-zinc-800 text-white"
                value={pageUrl}
                onChange={(e) => setPageUrl(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-black py-2 px-4 rounded font-bold"
            >
              {isSubmitting ? "送出中..." : "送出回報"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
