"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import Link from "next/link";

export default function AnalyticsPage() {
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState([]);

  useEffect(() => {
    axios.get("/api/admin/analytics-summary").then((res) => {
      setSummary(res.data.summary);
    });
    axios.get("/api/admin/analytics").then((res) => {
      setLogs(res.data.logs);
    });
  }, []);

  return (
    <div className="relative min-h-screen bg-black text-white p-20">
      {/* 左上角回首頁按鈕 */}
      <Link
        href="/"
        className="absolute top-0 left-0 m-2 px-3 py-1 bg-white text-black rounded hover:bg-gray-100 font-semibold z-50"
      >
        ← 回首頁
      </Link>

      <h1 className="text-xl font-bold mb-4">📊 後台總覽（最近 7 天）</h1>
      <table className="w-full mb-8 text-sm border border-zinc-700">
        <thead className="bg-zinc-800 text-white">
          <tr>
            <th className="border px-2 py-1">📅 日期</th>
            <th className="border px-2 py-1">👤 註冊</th>
            <th className="border px-2 py-1">🖼️ 上傳</th>
            <th className="border px-2 py-1">❤️ 愛心</th>
            <th className="border px-2 py-1">💬 留言</th>
            <th className="border px-2 py-1">👁️ 人數</th>
            <th className="border px-2 py-1">👁️ 次數</th>
          </tr>
        </thead>
        <tbody>
          {summary.map((row) => (
            <tr key={row.date} className="text-center">
              <td className="border px-2 py-1">{row.date}</td>
              <td className="border px-2 py-1">{row.newUsers ?? 0}</td>
              <td className="border px-2 py-1">{row.imagesUploaded ?? 0}</td>
              <td className="border px-2 py-1">{row.likesGiven ?? 0}</td>
              <td className="border px-2 py-1">{row.commentsPosted ?? 0}</td>
              <td className="border px-2 py-1">{row.uniqueUsers ?? 0}</td>
              <td className="border px-2 py-1">{row.totalVisits ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="text-lg font-bold mb-2">📜 詳細訪問紀錄</h2>
      {/* 原本 logs 區域照放 */}
    </div>
  );
}
