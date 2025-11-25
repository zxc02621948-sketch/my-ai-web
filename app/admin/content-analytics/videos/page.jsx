"use client";

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function VideoAnalyticsPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(7);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await axios.get(
          `/api/admin/content-analytics/videos?days=${days}`
        );
        if (response.data.success && response.data.data) {
          setData(response.data.data);
        } else {
          setError('無法獲取數據');
        }
      } catch (err) {
        console.error('獲取影片分析數據失敗:', err);
        setError(err.response?.data?.error || '載入失敗');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [days]);

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
    playStartStats = [],
    watchStats = {},
    playStartCount = 0,
    playCompleteCount = 0,
    avgWatchRounds = 0,
    bufferingStats = [],
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
          href="/admin/content-analytics/images"
          className="px-3 py-1 bg-pink-600 text-white rounded hover:bg-pink-700 font-semibold"
        >
          🖼️ 圖片分析
        </Link>
        <div className="ml-auto flex items-center gap-2">
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

      <h1 className="text-2xl font-bold mb-6">🎬 影片分析</h1>

      {/* 總覽統計 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-zinc-800 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-400">平均觀看時長</h3>
          <p className="text-2xl font-bold">
            {watchStats.avgWatchDuration ? Math.round(watchStats.avgWatchDuration) : 0} 秒
          </p>
          <p className="text-sm text-zinc-400 mt-1">
            總觀看: {watchStats.totalWatches || 0} 次
          </p>
          <p className="text-xs text-zinc-500 mt-1">從打開彈窗到關閉的平均時長</p>
        </div>
        <div className="bg-zinc-800 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-green-400">平均觀看輪數</h3>
          <p className="text-2xl font-bold">
            {avgWatchRounds.toFixed(2)} 輪
          </p>
          <p className="text-sm text-zinc-400 mt-1">
            完成: {playCompleteCount} / 開始: {playStartCount}
          </p>
          <p className="text-xs text-zinc-500 mt-1">平均每個播放會觀看多少輪</p>
        </div>
        <div className="bg-zinc-800 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-red-400">平均卡頓次數</h3>
          <p className="text-2xl font-bold">
            {bufferingStats[0]?.avgBufferCount?.toFixed(2) || '0.00'}
          </p>
          <p className="text-sm text-zinc-400 mt-1">最卡影片的平均值</p>
        </div>
      </div>

      {/* 播放開始成功率（最低的） */}
      <div className="bg-zinc-800 p-6 rounded-lg mb-8">
        <h2 className="text-xl font-bold mb-4">⚠️ 播放失敗率最高的影片</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-600">
                <th className="text-left p-2">影片</th>
                <th className="text-right p-2">播放開始</th>
                <th className="text-right p-2">錯誤次數</th>
                <th className="text-right p-2">成功率</th>
              </tr>
            </thead>
            <tbody>
              {playStartStats.length > 0 ? (
                playStartStats.map((stat, index) => (
                  <tr
                    key={stat._id || index}
                    className="border-b border-zinc-700 hover:bg-zinc-700"
                  >
                    <td className="p-2">
                      {stat.title || `影片 ID: ${stat.videoId}`}
                    </td>
                    <td className="text-right p-2">{stat.playStarts || 0}</td>
                    <td className="text-right p-2 text-red-400">
                      {stat.errors || 0}
                    </td>
                    <td className="text-right p-2 font-semibold">
                      {stat.successRate?.toFixed(2) || '0.00'}%
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="p-4 text-center text-gray-400">
                    暫無數據
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 平均卡頓次數 */}
      <div className="bg-zinc-800 p-6 rounded-lg">
        <h2 className="text-xl font-bold mb-4">🔴 最卡影片 Top {bufferingStats.length}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-600">
                <th className="text-left p-2">影片</th>
                <th className="text-right p-2">平均卡頓次數</th>
                <th className="text-right p-2">總卡頓次數</th>
                <th className="text-right p-2">平均緩衝時長</th>
              </tr>
            </thead>
            <tbody>
              {bufferingStats.length > 0 ? (
                bufferingStats.map((stat, index) => (
                  <tr
                    key={stat._id || index}
                    className="border-b border-zinc-700 hover:bg-zinc-700"
                  >
                    <td className="p-2">
                      {stat.title || `影片 ID: ${stat.videoId}`}
                    </td>
                    <td className="text-right p-2 text-yellow-400 font-semibold">
                      {stat.avgBufferCount?.toFixed(2) || '0.00'}
                    </td>
                    <td className="text-right p-2">{stat.totalBufferCount || 0}</td>
                    <td className="text-right p-2">
                      {stat.avgBufferDuration?.toFixed(2) || '0.00'} 秒
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="p-4 text-center text-gray-400">
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

