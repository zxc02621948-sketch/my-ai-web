"use client";

import Link from "next/link";

export default function VerifySuccessPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white p-8">
      <div className="max-w-md bg-zinc-900 rounded-xl p-6 shadow-xl text-center border border-zinc-700">
        <h1 className="text-2xl font-bold text-green-400 mb-4">✅ 驗證成功！</h1>
        <p className="mb-6 text-gray-300">您的帳號已成功驗證，現在可以登入並開始使用平台囉 🎉</p>
        <Link
          href="/"
          className="inline-block bg-green-600 hover:bg-green-700 text-white py-2 px-6 rounded-lg transition-all"
        >
          返回首頁
        </Link>
      </div>
    </main>
  );
}
