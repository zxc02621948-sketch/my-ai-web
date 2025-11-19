"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function PointsEarningModal({ isOpen, onClose }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

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
      icon: "📸",
      title: "上傳圖片",
      points: "+5",
      limit: "每日積分上限 20 分",
      description: "上傳 AI 生成的圖片作品",
      note: "上傳數量上限按等級計算（LV1=5張，LV2=6張，...，VIP=20張）"
    },
    {
      icon: "🎬",
      title: "上傳影片",
      points: "+10",
      limit: "每日積分上限 20 分",
      description: "上傳 AI 生成的影片作品",
      note: "上傳數量上限按等級計算（LV1=5部，LV2=6部，...，VIP=50部）"
    },
    {
      icon: "🎵",
      title: "上傳音樂",
      points: "+10",
      limit: "每日積分上限 20 分",
      description: "上傳 AI 生成的音樂作品",
      note: "上傳數量上限按等級計算（LV1=5首，LV2=6首，...，VIP=20首）"
    },
    {
      icon: "❤️",
      title: "獲得愛心",
      points: "+1",
      limit: "每日上限 10 分",
      description: "你的作品收到其他用戶的讚",
      note: "終身去重（同一作品同一用戶只能獲得一次積分）"
    },
    {
      icon: "👍",
      title: "給予愛心",
      points: "+1",
      limit: "每日上限 5 分",
      description: "給其他用戶的作品按讚",
      note: "給他人按讚，自讚不計。終身去重（同一作品只能獲得一次積分）"
    },
    {
      icon: "💬",
      title: "獲得留言",
      points: "+1",
      limit: "每日上限 5 分",
      description: "你的作品收到其他用戶的留言",
      note: "每日去重（同一作品同一用戶每天只能獲得一次積分）"
    },
    {
      icon: "🌅",
      title: "每日登入",
      points: "+5",
      limit: "每日一次",
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
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-bold text-yellow-400">
                          {method.points}
                        </span>
                        <span className="text-sm text-gray-400">
                          {method.limit}
                        </span>
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

