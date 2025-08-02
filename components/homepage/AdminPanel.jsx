// components/homepage/AdminPanel.jsx
"use client";

import Link from "next/link";

export default function AdminPanel() {
  const handleCreateTestUser = async () => {
    const res = await fetch("/api/dev-create-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "tester2@example.com",
        username: "tester2",
        password: "123456",
        isAdmin: false,
      }),
    });

    const data = await res.json();
    alert(
      data.success
        ? `✅ 建立成功：${data.user.email}`
        : `❌ 失敗：${data.message || data.error}`
    );
  };

  return (
    <div className="mt-4 bg-zinc-800 p-4 rounded text-sm border border-zinc-700">
      <p className="mb-2 text-gray-300 font-semibold">🧪 測試帳號工具（限管理員）</p>
      <button
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        onClick={handleCreateTestUser}
      >
        ➕ 建立測試帳號
      </button>

      {/* 👇 流量後台入口，低調版 */}
      <div className="mt-3 text-yellow-400 underline hover:text-yellow-300">
        <Link href="/admin/analytics">👉 查看流量紀錄（僅限管理員）</Link>
      </div>
    </div>
  );
}
