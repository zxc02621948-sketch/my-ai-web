"use client";
import React from "react";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-start py-10 px-4">
      {/* 探索文案 */}
      <h1 className="text-3xl md:text-4xl font-bold text-center mb-6">
        探索、分享並累積你的創作成就 😳
      </h1>

      {/* 分級按鈕 */}
      <div className="flex space-x-4 mb-10">
        <Link
          href="/general"
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-xl shadow-md transition"
        >
          一般圖片
        </Link>
        <Link
          href="/adult"
          className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-6 rounded-xl shadow-md transition"
        >
          18+ 圖片
        </Link>
      </div>

      {/* 圖片展示區（未來接資料） */}
      <div className="w-full max-w-5xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* 範例圖片（未來可用 map 渲染） */}
        <div className="w-full">
          <img
            src="/sample1.jpg"
            alt="範例圖片1"
            className="w-full h-auto rounded-2xl"
          />
          <div className="text-center mt-2">範例圖 1</div>
        </div>
        <div className="w-full">
          <img
            src="/sample2.jpg"
            alt="範例圖片2"
            className="w-full h-auto rounded-2xl"
          />
          <div className="text-center mt-2">範例圖 2</div>
        </div>
        <div className="w-full">
          <img
            src="/sample3.jpg"
            alt="範例圖片3"
            className="w-full h-auto rounded-2xl"
          />
          <div className="text-center mt-2">範例圖 3</div>
        </div>
      </div>
    </div>
  );
}
