// app/test-fix-power-coupon/page.jsx
// 測試修復權力券分數的頁面

"use client";

import { useState } from "react";
import axios from "axios";
import { notify } from "@/components/common/GlobalNotificationManager";

export default function TestFixPowerCouponPage() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);

  const handleFix = async () => {
    setLoading(true);
    setResults(null);
    
    try {
      const response = await axios.post("/api/admin/fix-power-coupon-scores", {}, {
        withCredentials: true
      });

      if (response.data.success) {
        setResults(response.data);
        notify.success("修復成功", response.data.message);
      } else {
        notify.error("修復失敗", response.data.message || "請稍後再試");
      }
    } catch (error) {
      console.error("修復失敗:", error);
      notify.error("修復失敗", error.response?.data?.message || "請稍後再試");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">修復權力券分數</h1>
        
        <button
          onClick={handleFix}
          disabled={loading}
          className={`px-6 py-3 rounded-lg font-medium transition-colors ${
            loading
              ? "bg-gray-600 text-gray-400 cursor-not-allowed"
              : "bg-purple-600 hover:bg-purple-700 text-white"
          }`}
        >
          {loading ? "修復中..." : "開始修復"}
        </button>

        {results && (
          <div className="mt-8 space-y-4">
            <div className="bg-zinc-800 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">{results.message}</h2>
              
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg mb-2">📊 修復統計</h3>
                  <ul className="space-y-2">
                    <li>圖片：修復 {results.results.images.fixed}/{results.results.images.total} 張</li>
                    <li>影片：修復 {results.results.videos.fixed}/{results.results.videos.total} 個</li>
                    <li>音樂：修復 {results.results.music.fixed}/{results.results.music.total} 首</li>
                  </ul>
                </div>

                {results.results.images.details.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-lg mb-2">🖼️ 修復的圖片</h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {results.results.images.details.map((detail, index) => (
                        <div key={index} className="bg-zinc-700 rounded p-3 text-sm">
                          <div className="font-medium">{detail.title}</div>
                          <div className="text-gray-400 mt-1">
                            舊分數: {detail.oldScore} → 新分數: {detail.newScore}
                            {detail.difference > 0 && (
                              <span className="text-green-400 ml-2">(+{detail.difference})</span>
                            )}
                            {detail.isExpired && (
                              <span className="text-red-400 ml-2">(已過期)</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {results.results.videos.details.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-lg mb-2">🎬 修復的影片</h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {results.results.videos.details.map((detail, index) => (
                        <div key={index} className="bg-zinc-700 rounded p-3 text-sm">
                          <div className="font-medium">{detail.title}</div>
                          <div className="text-gray-400 mt-1">
                            舊分數: {detail.oldScore} → 新分數: {detail.newScore}
                            {detail.difference > 0 && (
                              <span className="text-green-400 ml-2">(+{detail.difference})</span>
                            )}
                            {detail.isExpired && (
                              <span className="text-red-400 ml-2">(已過期)</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {results.results.music.details.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-lg mb-2">🎵 修復的音樂</h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {results.results.music.details.map((detail, index) => (
                        <div key={index} className="bg-zinc-700 rounded p-3 text-sm">
                          <div className="font-medium">{detail.title}</div>
                          <div className="text-gray-400 mt-1">
                            舊分數: {detail.oldScore} → 新分數: {detail.newScore}
                            {detail.difference > 0 && (
                              <span className="text-green-400 ml-2">(+{detail.difference})</span>
                            )}
                            {detail.isExpired && (
                              <span className="text-red-400 ml-2">(已過期)</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

