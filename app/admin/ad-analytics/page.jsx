"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdAnalyticsPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get("/api/admin/ad-analytics");
        // API 返回 { success: true, data: { ... } }，所以需要使用 response.data.data
        if (response.data.success && response.data.data) {
          setData(response.data.data);
        } else {
          setError("無法獲取數據");
        }
      } catch (err) {
        console.error("獲取廣告收益統計失敗:", err);
        setError(err.response?.data?.error || err.response?.data?.message || "載入失敗");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-xl">載入中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-red-400">錯誤: {error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-yellow-400">無法載入數據，請確認您有管理員權限</div>
      </div>
    );
  }

  const { 
    summary = {}, 
    revenueEstimates = {}, 
    dailyStats = [], 
    pageStats = [], 
    hourlyStats = [], 
    recentVisits = { data: [] } 
  } = data;

  // 為了保持向後兼容，創建別名
  const overall = {
    totalVisits: summary.totalAdVisits,
    uniqueUsers: summary.uniqueUsers,
    todayVisits: summary.averageVisitsPerDay, // 使用平均值作為今日估算
    weekVisits: summary.averageVisitsPerDay * 7 // 使用平均值計算週訪問
  };
  const daily = dailyStats;
  const pages = pageStats;
  const hourly = hourlyStats;
  const revenue = revenueEstimates;

  return (
    <div className="relative min-h-screen bg-black text-white p-6">
      {/* 導航 */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => router.back()}
          className="px-3 py-1 bg-white text-black rounded hover:bg-gray-100 font-semibold cursor-pointer"
        >
          ← 回上一頁
        </button>
        <Link
          href="/admin/analytics"
          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold"
        >
          📊 一般統計
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-6">💰 廣告收益統計分析</h1>

      {/* 總覽統計 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-zinc-800 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-green-400">總訪問量</h3>
          <p className="text-2xl font-bold">{(overall.totalVisits || 0).toLocaleString()}</p>
        </div>
        <div className="bg-zinc-800 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-400">獨立訪客</h3>
          <p className="text-2xl font-bold">{(overall.uniqueUsers || 0).toLocaleString()}</p>
        </div>
        <div className="bg-zinc-800 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-purple-400">今日訪問</h3>
          <p className="text-2xl font-bold">{(overall.todayVisits || 0).toLocaleString()}</p>
        </div>
        <div className="bg-zinc-800 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-yellow-400">本週訪問</h3>
          <p className="text-2xl font-bold">{(overall.weekVisits || 0).toLocaleString()}</p>
        </div>
      </div>

      {/* 收益估算 */}
      <div className="bg-zinc-800 p-6 rounded-lg mb-8">
        <h2 className="text-xl font-bold mb-4">💵 收益估算 (基於 CPM 模型)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-zinc-700 p-4 rounded">
            <h3 className="text-green-400 font-semibold">保守估算 (CPM: $0.5)</h3>
            <p className="text-lg">今日: ${revenue.conservative?.daily || '0.00'}</p>
            <p className="text-lg">本週: ${revenue.conservative?.weekly || '0.00'}</p>
            <p className="text-lg">本月: ${revenue.conservative?.monthly || '0.00'}</p>
          </div>
          <div className="bg-zinc-700 p-4 rounded">
            <h3 className="text-yellow-400 font-semibold">中等估算 (CPM: $1.5)</h3>
            <p className="text-lg">今日: ${revenue.moderate?.daily || '0.00'}</p>
            <p className="text-lg">本週: ${revenue.moderate?.weekly || '0.00'}</p>
            <p className="text-lg">本月: ${revenue.moderate?.monthly || '0.00'}</p>
          </div>
          <div className="bg-zinc-700 p-4 rounded">
            <h3 className="text-red-400 font-semibold">樂觀估算 (CPM: $3.0)</h3>
            <p className="text-lg">今日: ${revenue.optimistic?.daily || '0.00'}</p>
            <p className="text-lg">本週: ${revenue.optimistic?.weekly || '0.00'}</p>
            <p className="text-lg">本月: ${revenue.optimistic?.monthly || '0.00'}</p>
          </div>
        </div>
      </div>

      {/* 每日統計 */}
      <div className="bg-zinc-800 p-6 rounded-lg mb-8">
        <h2 className="text-xl font-bold mb-4">📅 每日訪問統計 (最近 7 天)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-600">
                <th className="text-left p-2">日期</th>
                <th className="text-right p-2">訪問量</th>
                <th className="text-right p-2">獨立訪客</th>
                <th className="text-right p-2">預估收益 (中等)</th>
              </tr>
            </thead>
            <tbody>
              {daily.length > 0 ? daily.map((day, index) => (
                <tr key={day.date || index} className="border-b border-zinc-700">
                  <td className="p-2">{day.date || 'N/A'}</td>
                  <td className="text-right p-2">{(day.visits || 0).toLocaleString()}</td>
                  <td className="text-right p-2">{(day.uniqueUsers || 0).toLocaleString()}</td>
                  <td className="text-right p-2 text-green-400">
                    ${(((day.visits || 0) / 1000) * 1.5).toFixed(2)}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="4" className="p-4 text-center text-gray-400">暫無數據</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 頁面統計 */}
      <div className="bg-zinc-800 p-6 rounded-lg mb-8">
        <h2 className="text-xl font-bold mb-4">📄 熱門頁面統計</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-600">
                <th className="text-left p-2">頁面路徑</th>
                <th className="text-right p-2">訪問量</th>
                <th className="text-right p-2">佔比</th>
              </tr>
            </thead>
            <tbody>
              {pages.length > 0 ? pages.slice(0, 10).map((page) => (
                <tr key={page.path} className="border-b border-zinc-700">
                  <td className="p-2 font-mono text-blue-400">{page.path || 'N/A'}</td>
                  <td className="text-right p-2">{(page.visits || 0).toLocaleString()}</td>
                  <td className="text-right p-2">
                    {(((page.visits || 0) / (overall.totalVisits || 1)) * 100).toFixed(1)}%
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="3" className="p-4 text-center text-gray-400">暫無數據</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 時段統計 */}
      <div className="bg-zinc-800 p-6 rounded-lg mb-8">
        <h2 className="text-xl font-bold mb-4">⏰ 24小時訪問分布</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-600">
                <th className="text-left p-2">時段</th>
                <th className="text-right p-2">訪問量</th>
                <th className="text-left p-2">分布圖</th>
              </tr>
            </thead>
            <tbody>
              {hourly.length > 0 ? hourly.map((hour, index) => (
                <tr key={index} className="border-b border-zinc-700">
                  <td className="p-2">{hour.hour || 0}:00</td>
                  <td className="text-right p-2">{hour.visits || 0}</td>
                  <td className="p-2">
                    <div className="bg-zinc-700 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full" 
                        style={{width: `${((hour.visits || 0) / Math.max(...hourly.map(h => h.visits || 0), 1)) * 100}%`}}
                      ></div>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="3" className="p-4 text-center text-gray-400">暫無數據</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 最近訪問記錄 */}
      <div className="bg-zinc-800 p-6 rounded-lg">
        <h2 className="text-xl font-bold mb-4">🕒 最近訪問記錄</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-600">
                <th className="text-left p-2">時間</th>
                <th className="text-left p-2">頁面</th>
                <th className="text-left p-2">IP</th>
                <th className="text-left p-2">訪問ID</th>
              </tr>
            </thead>
            <tbody>
              {recentVisits.data.length > 0 ? recentVisits.data.map((visit) => (
                <tr key={visit._id} className="border-b border-zinc-700">
                  <td className="p-2 text-gray-300">
                    {visit.createdAt ? new Date(visit.createdAt).toLocaleString() : 'N/A'}
                  </td>
                  <td className="p-2 font-mono text-blue-400">{visit.path || 'N/A'}</td>
                  <td className="p-2 font-mono text-gray-400">{visit.ip || 'N/A'}</td>
                  <td className="p-2 font-mono text-xs text-gray-500">
                    {visit.visitId ? visit.visitId.slice(0, 20) + '...' : 'N/A'}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="4" className="p-4 text-center text-gray-400">暫無數據</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}