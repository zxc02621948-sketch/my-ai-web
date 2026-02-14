"use client";

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getApiErrorMessage, isAuthError } from '@/lib/clientAuthError';

export default function MusicAnalyticsPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(7);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`/api/admin/content-analytics/music?days=${days}`);
        if (response.data.success && response.data.data) {
          setData(response.data.data);
        } else {
          setError('無法獲取數據');
        }
      } catch (err) {
        if (!isAuthError(err)) {
          console.error('獲取音樂分析數據失敗:', err);
        }
        setError(getApiErrorMessage(err, '載入失敗'));
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
    topBufferingSongs = [],
    errorStats = [],
    bufferStats = {},
    completionRate = 0,
    deviceStats = [],
    hourlyStats = [],
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
          href="/admin/ad-analytics"
          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 font-semibold"
        >
          💰 廣告統計
        </Link>
        <Link
          href="/admin/content-analytics/images"
          className="px-3 py-1 bg-pink-600 text-white rounded hover:bg-pink-700 font-semibold"
        >
          🖼️ 圖片分析
        </Link>
        <Link
          href="/admin/content-analytics/videos"
          className="px-3 py-1 bg-orange-600 text-white rounded hover:bg-orange-700 font-semibold"
        >
          🎬 影片分析
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

      <h1 className="text-2xl font-bold mb-6">🎧 音樂播放分析</h1>

      {/* 總覽統計 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-zinc-800 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-yellow-400">平均緩衝時長</h3>
          <p className="text-2xl font-bold">
            {bufferStats.avgBufferDuration?.toFixed(2) || '0.00'} 秒
          </p>
          <p className="text-sm text-zinc-400 mt-1">
            總緩衝事件: {bufferStats.totalBufferingEvents || 0}
          </p>
        </div>
        <div className="bg-zinc-800 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-green-400">播放完成率</h3>
          <p className="text-2xl font-bold">{completionRate.toFixed(1)}%</p>
          <p className="text-sm text-zinc-400 mt-1">播放開始 → 播放完成</p>
        </div>
        <div className="bg-zinc-800 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-red-400">總緩衝次數</h3>
          <p className="text-2xl font-bold">{bufferStats.totalBufferCount || 0}</p>
          <p className="text-sm text-zinc-400 mt-1">所有歌曲累計</p>
        </div>
      </div>

      {/* Top 10 最卡歌曲 */}
      <div className="bg-zinc-800 p-6 rounded-lg mb-8">
        <h2 className="text-xl font-bold mb-4">🔴 Top 10 最卡歌曲</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-600">
                <th className="text-left p-2">歌曲</th>
                <th className="text-right p-2">平均緩衝時長</th>
                <th className="text-right p-2">緩衝次數</th>
                <th className="text-right p-2">緩衝事件數</th>
              </tr>
            </thead>
            <tbody>
              {topBufferingSongs.length > 0 ? (
                topBufferingSongs.map((song, index) => (
                  <tr
                    key={song._id || index}
                    className="border-b border-zinc-700 hover:bg-zinc-700"
                  >
                    <td className="p-2">
                      {song.title || `音樂 ID: ${song.musicId}`}
                    </td>
                    <td className="text-right p-2 text-yellow-400 font-semibold">
                      {song.avgBufferDuration?.toFixed(2) || '0.00'} 秒
                    </td>
                    <td className="text-right p-2">{song.totalBufferCount || 0}</td>
                    <td className="text-right p-2 text-zinc-400">
                      {song.totalBufferingEvents || 0}
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

      {/* 播放失敗比例 */}
      <div className="bg-zinc-800 p-6 rounded-lg mb-8">
        <h2 className="text-xl font-bold mb-4">❌ 播放失敗統計</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-600">
                <th className="text-left p-2">歌曲</th>
                <th className="text-right p-2">播放開始</th>
                <th className="text-right p-2">錯誤次數</th>
                <th className="text-right p-2">失敗率</th>
              </tr>
            </thead>
            <tbody>
              {errorStats.length > 0 ? (
                errorStats.map((stat, index) => (
                  <tr
                    key={stat._id || index}
                    className="border-b border-zinc-700 hover:bg-zinc-700"
                  >
                    <td className="p-2">
                      {stat.title || `音樂 ID: ${stat.musicId}`}
                    </td>
                    <td className="text-right p-2">{stat.playStarts || 0}</td>
                    <td className="text-right p-2 text-red-400">
                      {stat.errors || 0}
                    </td>
                    <td className="text-right p-2 font-semibold">
                      {((stat.errorRate || 0) * 100).toFixed(2)}%
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

      {/* 設備與網路分佈 */}
      <div className="bg-zinc-800 p-6 rounded-lg mb-8">
        <h2 className="text-xl font-bold mb-4">📱 設備與網路分佈</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-600">
                <th className="text-left p-2">設備類型</th>
                <th className="text-left p-2">網路類型</th>
                <th className="text-right p-2">播放次數</th>
                <th className="text-left p-2">分佈圖</th>
              </tr>
            </thead>
            <tbody>
              {deviceStats.length > 0 ? (
                (() => {
                  const maxCount = Math.max(...deviceStats.map((d) => d.count || 0), 1);
                  return deviceStats.map((stat, index) => (
                    <tr
                      key={index}
                      className="border-b border-zinc-700 hover:bg-zinc-700"
                    >
                      <td className="p-2">
                        {stat._id.deviceType || 'unknown'}
                      </td>
                      <td className="p-2">{stat._id.networkType || 'unknown'}</td>
                      <td className="text-right p-2">{stat.count || 0}</td>
                      <td className="p-2">
                        <div className="bg-zinc-700 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full"
                            style={{
                              width: `${((stat.count || 0) / maxCount) * 100}%`,
                            }}
                          ></div>
                        </div>
                      </td>
                    </tr>
                  ));
                })()
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

      {/* 時段統計 */}
      <div className="bg-zinc-800 p-6 rounded-lg">
        <h2 className="text-xl font-bold mb-4">⏰ 播放時段分佈</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-600">
                <th className="text-left p-2">時段</th>
                <th className="text-right p-2">播放次數</th>
                <th className="text-left p-2">分布圖</th>
              </tr>
            </thead>
            <tbody>
              {hourlyStats.length > 0 ? (
                (() => {
                  const maxCount = Math.max(...hourlyStats.map((h) => h.count || 0), 1);
                  return hourlyStats.map((stat, index) => (
                    <tr
                      key={index}
                      className="border-b border-zinc-700 hover:bg-zinc-700"
                    >
                      <td className="p-2">{stat._id || 'N/A'}</td>
                      <td className="text-right p-2">{stat.count || 0}</td>
                      <td className="p-2">
                        <div className="bg-zinc-700 rounded-full h-2">
                          <div
                            className="bg-purple-500 h-2 rounded-full"
                            style={{
                              width: `${((stat.count || 0) / maxCount) * 100}%`,
                            }}
                          ></div>
                        </div>
                      </td>
                    </tr>
                  ));
                })()
              ) : (
                <tr>
                  <td colSpan="3" className="p-4 text-center text-gray-400">
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

