"use client";

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getApiErrorMessage, isAuthError } from '@/lib/clientAuthError';

export default function ImageAnalyticsPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(7);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setError(null);
        if (!data) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }
        const response = await axios.get(
          `/api/admin/content-analytics/images`,
          {
            params: { days, _t: Date.now() },
            headers: {
              'Cache-Control': 'no-cache',
              Pragma: 'no-cache',
            },
          }
        );
        if (response.data.success && response.data.data) {
          setData(response.data.data);
        } else {
          setError('無法獲取數據');
        }
      } catch (err) {
        if (!isAuthError(err)) {
          console.error('獲取圖片分析數據失敗:', err);
        }
        setError(getApiErrorMessage(err, '載入失敗'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    };

    fetchData();
  }, [days, refreshKey]);

  useEffect(() => {
    const timer = setInterval(() => {
      setRefreshKey((k) => k + 1);
    }, 15000);
    return () => clearInterval(timer);
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
    scrollDepth = {},
    completeViewRate = 0,
    totalViews = 0,
    categoryStats = [],
    interactionStats = [],
    dbTotals = {},
    timeSpent = {},
  } = data;

  return (
    <div className="relative min-h-screen bg-black text-white p-6">
      {/* 導航 */}
      <div className="flex gap-4 mb-6 flex-wrap items-center">
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
        <Link
          href="/admin/content-analytics/music"
          className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 font-semibold"
        >
          🎧 音樂分析
        </Link>
        <Link
          href="/admin/content-analytics/videos"
          className="px-3 py-1 bg-orange-600 text-white rounded hover:bg-orange-700 font-semibold"
        >
          🎬 影片分析
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={refreshing}
            className={`px-3 py-1 rounded font-semibold ${
              refreshing
                ? 'bg-zinc-600 text-zinc-300 cursor-not-allowed'
                : 'bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer'
            }`}
          >
            {refreshing ? '刷新中...' : '立即刷新'}
          </button>
          <label className="text-sm">時間範圍：</label>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-3 py-1 bg-zinc-800 text-white rounded border border-zinc-600"
          >
            <option value={1}>最近 1 天</option>
            <option value={7}>最近 7 天</option>
            <option value={30}>最近 30 天</option>
          </select>
        </div>
      </div>

      <h1 className="text-2xl font-bold mb-6">🖼️ 圖片分析</h1>

      {/* 總覽統計 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-zinc-800 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-400">圖片完整查看率</h3>
          <p className="text-2xl font-bold">
            {completeViewRate.toFixed(1)}%
          </p>
          <p className="text-sm text-zinc-400 mt-1">
            完整查看: {scrollDepth.fullyViewedCount || 0} / 總查看: {totalViews}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            圖片 100% 可見的比例
          </p>
        </div>
        <div className="bg-zinc-800 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-green-400">平均停留時間</h3>
          <p className="text-2xl font-bold">
            {timeSpent.avgTimeSpent?.toFixed(1) || '0.0'} 秒
          </p>
          <p className="text-sm text-zinc-400 mt-1">
            總離開: {timeSpent.totalExits || 0}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            Modal 打開到關閉的平均時間
          </p>
        </div>
        <div className="bg-zinc-800 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-purple-400">平均圖片可見度</h3>
          <p className="text-2xl font-bold">
            {scrollDepth.avgScrollDepth?.toFixed(1) || '0.0'}%
          </p>
          <p className="text-sm text-zinc-400 mt-1">
            總事件: {scrollDepth.totalEvents || 0}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            圖片在視口中的平均可見比例
          </p>
        </div>
        <div className="bg-zinc-800 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-amber-400">DB 瀏覽累計</h3>
          <p className="text-2xl font-bold">
            {(dbTotals.totalClicks || 0).toLocaleString()}
          </p>
          <p className="text-sm text-zinc-400 mt-1">
            圖片數: {(dbTotals.totalImages || 0).toLocaleString()}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            來源: images.clicks（與排序分數連動）
          </p>
        </div>
      </div>

      {/* 最吸睛分類 */}
      <div className="bg-zinc-800 p-6 rounded-lg mb-8">
        <h2 className="text-xl font-bold mb-4">🔥 最吸睛分類</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-600">
                <th className="text-left p-2">分類</th>
                <th className="text-right p-2">打開 Modal 次數</th>
              </tr>
            </thead>
            <tbody>
              {categoryStats.length > 0 ? (
                categoryStats.map((stat, index) => (
                  <tr
                    key={index}
                    className="border-b border-zinc-700 hover:bg-zinc-700"
                  >
                    <td className="p-2">{stat._id || '未分類'}</td>
                    <td className="text-right p-2">{stat.count || 0}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="2" className="p-4 text-center text-gray-400">
                    暫無數據
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 收藏轉換率 */}
      <div className="bg-zinc-800 p-6 rounded-lg">
        <h2 className="text-xl font-bold mb-4">💝 收藏轉換率 Top {interactionStats.length}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-600">
                <th className="text-left p-2">圖片</th>
                <th className="text-right p-2">打開次數</th>
                <th className="text-right p-2">DB 瀏覽</th>
                <th className="text-right p-2">點讚次數</th>
                <th className="text-right p-2">轉換率</th>
              </tr>
            </thead>
            <tbody>
              {interactionStats.length > 0 ? (
                interactionStats.map((stat, index) => (
                  <tr
                    key={stat._id || index}
                    className="border-b border-zinc-700 hover:bg-zinc-700"
                  >
                    <td className="p-2">
                      {stat.title || `圖片 ID: ${stat.imageId}`}
                    </td>
                    <td className="text-right p-2">{stat.opens || 0}</td>
                    <td className="text-right p-2">{stat.dbClicks || stat.dbViewCount || 0}</td>
                    <td className="text-right p-2">{stat.likes || 0}</td>
                    <td className="text-right p-2 font-semibold text-green-400">
                      {stat.likeConversionRate?.toFixed(2) || '0.00'}%
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="p-4 text-center text-gray-400">
                    暫無數據
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

