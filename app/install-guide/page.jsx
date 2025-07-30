"use client";

import React, { useEffect, useState } from "react";
import Header from "@/components/common/Header";
import { jwtDecode } from "jwt-decode";
import { getTokenFromCookie } from "@/lib/cookie";

export default function InstallGuide() {
  const [currentUser, setCurrentUser] = useState(undefined);

  useEffect(() => {
    const token = getTokenFromCookie();
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setCurrentUser(decoded);
      } catch {
        setCurrentUser(null);
      }
    } else {
      setCurrentUser(null);
    }
  }, []);

  const guides = [
    {
      id: "sdwebui",
      title: "🟢 SD WebUI（標準版）",
      level: "⭐☆☆☆☆（非常簡單）",
      purpose: "穩定繪圖基礎款，功能完整、社群最大",
      pros: "安裝簡單、資源最多、相容性好、教學多",
      cons: "介面偏老、設定項目偏多、邏輯零散。僅限 PC 使用",
      recommended: "初學者或剛接觸 AI 繪圖的使用者",
      url: "https://www.youtube.com/watch?v=4HCPrO1vrIQ",
    },
    {
      id: "reforge",
      title: "🔵 WebUI-ReForge（強化版）",
      level: "⭐⭐☆☆☆（稍有基礎可上手）",
      purpose: "功能優化版本，介面整合、資源集中",
      pros: "操作更順、批量處理快、UI 友善",
      cons: "更新不一定穩、說明較少。僅限 PC 使用",
      recommended: "有 SDWebUI 基礎、想優化流程的人",
      url: "https://www.youtube.com/watch?v=BBvjHMbkqxw&t=410s",
    },
    {
      id: "comfyui",
      title: "🟠 ComfyUI（節點式）",
      level: "⭐⭐⭐⭐☆（進階）",
      purpose: "模組化節點工作流，靈活自由",
      pros: "流程清楚、效果可控、自定義超強",
      cons: "初期學習曲線高、需理解節點邏輯。僅限 PC 使用",
      recommended: "熟悉繪圖流程、追求極致控制感的進階使用者",
      url: "https://www.youtube.com/watch?v=g0xYOVybAVc",
    },
  ];

  return (
    <>
      <Header currentUser={currentUser} />

      <div className="max-w-3xl mx-auto py-10 px-4 text-white">
        <h1 className="text-2xl font-bold mb-6">📦 安裝教學導引</h1>
        <p className="text-yellow-400 text-base font-semibold mb-6">
          ⚠️ 所有版本皆需於電腦環境中操作安裝，手機與平板裝置無法直接使用。
        </p>
        <p className="text-gray-400 text-sm mb-8">
          以下為目前常見的三種 Stable Diffusion 安裝版本簡介，包含用途、特點與教學影片連結。
          可依照需求與使用經驗選擇適合的版本。
        </p>

        {guides.map((g) => (
          <div key={g.id} className="bg-zinc-800 rounded p-4 border border-zinc-700 mb-6">
            <h2 className="text-xl font-semibold mb-2">{g.title}</h2>
            <ul className="text-sm text-gray-300 space-y-1">
              <li><strong>🔥 使用難易度：</strong>{g.level}</li>
              <li><strong>📌 用途：</strong>{g.purpose}</li>
              <li><strong>✅ 優點：</strong>{g.pros}</li>
              <li><strong>⚠️ 缺點：</strong>{g.cons}</li>
              <li><strong>👍 推薦對象：</strong>{g.recommended}</li>
            </ul>

            <a
              href={g.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" className="w-5 h-5 mr-2 fill-white">
                <path d="M549.7 124.1c-6.3-23.7-24.9-42.4-48.5-48.7C456.4 64 288 64 288 64S119.6 64 74.8 75.4c-23.6 6.3-42.2 25-48.5 48.7C16 168.6 16 256 16 256s0 87.4 10.3 131.9c6.3 23.7 24.9 42.4 48.5 48.7C119.6 448 288 448 288 448s168.4 0 213.2-11.4c23.6-6.3 42.2-25 48.5-48.7C560 343.4 560 256 560 256s0-87.4-10.3-131.9zM232 336V176l142 80-142 80z" />
              </svg>
              前往教學影片
            </a>

            <p className="text-xs text-gray-400 mt-1">
              📺 教學影片來源：由 <span className="font-medium text-white">杰克艾米立</span> 製作
            </p>

            <p className="text-xs text-gray-500 mt-2">
              📝 本站僅提供影片連結與簡介，安裝步驟請依教學影片為主。
              有操作問題建議至影片留言處詢問原作者。
            </p>
          </div>
        ))}
      </div>
    </>
  );
}
