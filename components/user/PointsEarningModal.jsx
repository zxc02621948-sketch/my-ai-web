"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";

export default function PointsEarningModal({ isOpen, onClose }) {
  const [mounted, setMounted] = useState(false);
  const [dailySummary, setDailySummary] = useState(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // 載入每日積分統計
  useEffect(() => {
    if (!isOpen) return;

    const fetchDailySummary = async () => {
      try {
        const res = await axios.get("/api/points/daily-summary", {
          withCredentials: true,
        });
        if (res.data?.ok && res.data?.data) {
          setDailySummary(res.data.data);
        }
      } catch (error) {
        console.warn("[PointsEarningModal] 載入每日積分統計失敗:", error);
      }
    };

    fetchDailySummary();
  }, [isOpen]);

  // 鎖住背景 scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  // 點擊空白處關閉
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const earningMethods = [
    {
      type: "upload",
      icon: "📸",
      title: "上傳圖片",
      points: 5,
      limitValue: 20,
      description: "上傳 AI 生成的圖片作品",
      note: "上傳數量上限按等級計算（LV1=5張，LV2=6張，...，VIP=20張）"
    },
    {
      type: "video_upload",
      icon: "🎬",
      title: "上傳影片",
      points: 10,
      limitValue: 20,
      description: "上傳 AI 生成的影片作品",
      note: "上傳數量上限按等級計算（LV1=5部，LV2=6部，...，VIP=50部）"
    },
    {
      type: "music_upload",
      icon: "🎵",
      title: "上傳音樂",
      points: 10,
      limitValue: 20,
      description: "上傳 AI 生成的音樂作品",
      note: "上傳數量上限按等級計算（LV1=5首，LV2=6首，...，VIP=20首）"
    },
    {
      type: "like_received",
      icon: "❤️",
      title: "獲得愛心",
      points: 1,
      limitValue: 10,
      description: "你的作品收到其他用戶的讚",
      note: "終身去重（同一作品同一用戶只能獲得一次積分）"
    },
    {
      type: "like_given",
      icon: "👍",
      title: "給予愛心",
      points: 1,
      limitValue: 5,
      description: "給其他用戶的作品按讚",
      note: "給他人按讚，自讚不計。終身去重（同一作品只能獲得一次積分）"
    },
    {
      type: "comment_received",
      icon: "💬",
      title: "獲得留言",
      points: 1,
      limitValue: 5,
      description: "你的作品收到其他用戶的留言",
      note: "每日去重（同一作品同一用戶每天只能獲得一次積分）"
    },
    {
      type: "daily_login",
      icon: "🌅",
      title: "每日登入",
      points: 5,
      limitValue: 5,
      description: "每天首次登入網站",
      note: "每日 00:00 重置"
    }
  ];

  return createPortal(
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[99999]" 
      style={{ padding: '60px 16px 80px 16px' }}
      onClick={handleBackdropClick}
    >
      <div className="bg-zinc-800 rounded-xl max-w-2xl w-full max-h-full overflow-y-auto">
        {/* 標題 */}
        <div className="flex justify-between items-center p-6 border-b border-zinc-700 sticky top-0 bg-zinc-800 z-10">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <span className="text-3xl">💰</span>
            獲取積分途徑
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-2xl"
          >
            ✕
          </button>
        </div>

        {/* 內容 */}
        <div className="p-6">
          {/* 說明 */}
          <div className="bg-gradient-to-r from-yellow-900/30 to-orange-900/30 rounded-xl p-4 mb-6 border border-yellow-500/20">
            <div className="flex items-start gap-3">
              <span className="text-2xl">💡</span>
              <div className="text-sm text-yellow-200">
                <div className="font-semibold mb-2">積分規則說明</div>
                <ul className="space-y-1 text-yellow-300/90">
                  <li>• 每種上傳類型的積分上限獨立計算，互不影響</li>
                  <li>• 上傳數量上限按等級和 VIP 狀態計算</li>
                  <li>• 積分上限每日 00:00 重置</li>
                  <li>• 積分可用於購買功能、訂閱服務等</li>
                </ul>
              </div>
            </div>
          </div>

          {/* 積分獲取方式列表 */}
          <div className="space-y-4">
            {earningMethods.map((method, index) => (
              <div
                key={index}
                className="bg-zinc-700/50 rounded-xl p-4 border border-zinc-600 hover:border-yellow-500/50 transition-all duration-200"
              >
                <div className="flex items-start gap-4">
                  {/* 圖標 */}
                  <div className="text-3xl flex-shrink-0">
                    {method.icon}
                  </div>
                  
                  {/* 內容 */}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-white">
                        {method.title}
                      </h3>
                      <div className="flex flex-col items-end gap-0.5 text-right">
                        <span className="text-xl font-bold text-yellow-400">
                          +{method.points}／每日積分上限 {method.limitValue} 分
                        </span>
                        {dailySummary && dailySummary[method.type] && (
                          <span className="text-sm text-green-400">
                            已獲得 {dailySummary[method.type].today} / {dailySummary[method.type].limit} 分
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-300 mb-2">
                      {method.description}
                    </p>
                    
                    {method.note && (
                      <p className="text-xs text-gray-400 italic">
                        {method.note}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 額外提示 */}
          <div className="mt-6 p-4 bg-blue-900/20 rounded-xl border border-blue-500/30">
            <div className="flex items-start gap-3">
              <span className="text-2xl">📊</span>
              <div className="text-sm text-blue-200">
                <div className="font-semibold mb-2">提升等級獲得更多權益</div>
                <p className="text-blue-300/90">
                  等級越高，每日上傳數量上限越高，還能解鎖更多功能與獎勵。查看「等級獎勵」了解更多詳情。
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 底部按鈕 */}
        <div className="flex justify-end p-6 border-t border-zinc-700">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors"
          >
            關閉
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

