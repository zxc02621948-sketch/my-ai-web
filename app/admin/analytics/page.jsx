"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";

export default function AnalyticsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const [summaryRes, logsRes] = await Promise.all([
          axios.get("/api/admin/analytics-summary"),
          axios.get("/api/admin/analytics")
        ]);
        
        setSummary(summaryRes.data.summary || []);
        // apiSuccess 返回格式是 { ok: true, logs }
        setLogs(logsRes.data.logs || []);
      } catch (err) {
        console.error("獲取流量統計失敗:", err);
        setError(err.response?.data?.error || "獲取數據失敗，請稍後再試");
        setSummary([]);
        setLogs([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [mounted]);

  return (
    <div className="relative min-h-screen bg-black text-white p-20">
      {/* 左上角回上一頁按鈕 */}
      <button
        onClick={() => router.back()}
        className="absolute top-0 left-0 m-2 px-3 py-1 bg-white text-black rounded hover:bg-gray-100 font-semibold z-50 cursor-pointer"
      >
        ← 回上一頁
      </button>

      <h1 className="text-xl font-bold mb-4">📊 後台總覽（最近 7 天）</h1>
      
      {!mounted ? (
        <div className="mb-4 text-center text-zinc-400">載入中...</div>
      ) : (
        <>
          {loading && (
            <div className="mb-4 text-center text-zinc-400">載入中...</div>
          )}
          
          {error && (
            <div className="mb-4 p-4 bg-red-900/30 border border-red-700 rounded text-red-300">
              ❌ {error}
            </div>
          )}
          
          {!loading && !error && (
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
                {summary.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="border px-2 py-4 text-center text-zinc-400">
                      暫無數據
                    </td>
                  </tr>
                ) : (
                  summary.map((row) => (
                    <tr key={row.date} className="text-center hover:bg-zinc-800/50">
                      <td className="border px-2 py-1">{row.date}</td>
                      <td className="border px-2 py-1">{row.newUsers ?? 0}</td>
                      <td className="border px-2 py-1">{row.imagesUploaded ?? 0}</td>
                      <td className="border px-2 py-1">{row.likesGiven ?? 0}</td>
                      <td className="border px-2 py-1">{row.commentsPosted ?? 0}</td>
                      <td className="border px-2 py-1">{row.uniqueUsers ?? 0}</td>
                      <td className="border px-2 py-1">{row.totalVisits ?? 0}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </>
      )}

      <h2 className="text-lg font-bold mb-2">📜 詳細訪問紀錄</h2>
      {/* 原本 logs 區域照放 */}
    </div>
  );
}
