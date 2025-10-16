"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function NotFound() {
  const router = useRouter();

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-950 text-white px-4">
      <div className="max-w-2xl w-full text-center space-y-8">
        {/* 404 大標題 */}
        <div className="space-y-4">
          <h1 className="text-9xl font-bold bg-gradient-to-r from-purple-400 via-pink-500 to-blue-500 bg-clip-text text-transparent">
            404
          </h1>
          <h2 className="text-3xl font-semibold text-zinc-200">
            找不到頁面
          </h2>
          <p className="text-zinc-400 text-lg">
            抱歉，您訪問的頁面不存在或已被移除
          </p>
        </div>

        {/* 插圖或圖示 */}
        <div className="flex justify-center">
          <div className="relative w-64 h-64">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-full blur-3xl animate-pulse"></div>
            <div className="relative flex items-center justify-center h-full text-8xl">
              🔍
            </div>
          </div>
        </div>

        {/* 建議操作 */}
        <div className="space-y-4">
          <p className="text-zinc-300">您可以嘗試：</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => router.back()}
              className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-medium transition-all transform hover:scale-105"
            >
              ← 返回上一頁
            </button>
            <Link
              href="/"
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-medium transition-all transform hover:scale-105 shadow-lg"
            >
              🏠 回到首頁
            </Link>
          </div>
        </div>

        {/* 快速連結 */}
        <div className="pt-8 border-t border-zinc-800">
          <p className="text-zinc-400 mb-4">或者瀏覽以下頁面：</p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <Link href="/discussion" className="text-blue-400 hover:text-blue-300 underline">
              討論區
            </Link>
            <span className="text-zinc-600">•</span>
            <Link href="/models" className="text-blue-400 hover:text-blue-300 underline">
              模型介紹
            </Link>
            <span className="text-zinc-600">•</span>
            <Link href="/qa" className="text-blue-400 hover:text-blue-300 underline">
              新手Q&A
            </Link>
          </div>
        </div>

        {/* 搜尋功能 */}
        <div className="pt-4">
          <p className="text-zinc-400 text-sm mb-2">或使用搜尋功能尋找內容</p>
          <Link
            href="/"
            className="inline-block px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition"
          >
            🔍 前往搜尋
          </Link>
        </div>

        {/* Footer */}
        <div className="pt-8 text-zinc-500 text-sm">
          <p>如果您認為這是錯誤，請聯繫我們</p>
        </div>
      </div>
    </main>
  );
}

