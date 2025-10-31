"use client";

import React, { useState, useEffect } from "react";
import { useCurrentUser } from "@/contexts/CurrentUserContext";
import { usePlayer } from "@/components/context/PlayerContext";

export default function InstallGuide() {
  const { currentUser } = useCurrentUser(); // 使用 Context
  const player = usePlayer(); // 使用 Player Context
  const [isLoginOpen, setLoginOpen] = useState(false);
  const [isRegisterOpen, setRegisterOpen] = useState(false);

  // 教學區播放器控制邏輯（參考首頁）
  useEffect(() => {
    // 等待 currentUser 載入完成
    if (currentUser === undefined) {
      return;
    }
    
    // 檢查是否有釘選播放器
    const pinnedPlayer = currentUser?.user?.pinnedPlayer || currentUser?.pinnedPlayer;
    const hasPinnedPlayer = pinnedPlayer?.userId && 
      pinnedPlayer?.expiresAt && 
      new Date(pinnedPlayer.expiresAt) > new Date();
    
    if (hasPinnedPlayer) {
      // 有釘選播放器：恢復播放清單與狀態（與首頁一致，允許空播放清單時也顯示）
      const playlist = pinnedPlayer.playlist || [];
      const currentIndex = pinnedPlayer.currentIndex || 0;
      const currentTrack = playlist[currentIndex];

      if (playlist.length > 0) {
        player?.setPlaylist?.(playlist);
        player?.setActiveIndex?.(currentIndex);
        if (currentTrack) {
          player?.setSrc?.(currentTrack.url);
          player?.setOriginUrl?.(currentTrack.url);
          player?.setTrackTitle?.(currentTrack.title || currentTrack.url);
        }
      }

      // 設置擁有者與模式，並確保顯示
      player?.setPlayerOwner?.({ userId: pinnedPlayer.userId, username: pinnedPlayer.username });
      player?.setShareMode?.("global");
      player?.setMiniPlayerEnabled?.(true);

      // 通知全域（確保 MiniPlayer 的 isPinned 立即同步）
      try {
        window.dispatchEvent(new CustomEvent('pinnedPlayerChanged', {
          detail: { isPinned: true, pinnedPlayer }
        }));
      } catch {}
    } else {
      // 沒有釘選播放器，禁用 MiniPlayer（教學區不應該顯示播放器）
      player?.setMiniPlayerEnabled?.(false);
    }
  }, [currentUser]);

  // 即時響應釘選變更事件（取消釘選時立即關閉，不需重整）
  useEffect(() => {
    const handlePinnedChange = (e) => {
      if (e?.detail?.isPinned) {
        player?.setMiniPlayerEnabled?.(true);
      } else {
        player?.setMiniPlayerEnabled?.(false);
      }
    };
    window.addEventListener('pinnedPlayerChanged', handlePinnedChange);
    return () => window.removeEventListener('pinnedPlayerChanged', handlePinnedChange);
  }, []);

  const guides = [
    {
      id: "sdwebui",
      title: "🟢 SD WebUI（標準版）",
      level: "⭐☆☆☆☆（非常簡單）",
      purpose: "穩定繪圖入門款，功能完整、社群最大",
      pros: "安裝最容易，新手可直接上手\n社群資源、模型、教學最多\n擴充插件豐富（ControlNet、LoRA、Inpaint…）\n適合練習 prompt 與理解基礎參數",
      cons: "介面略舊、設定分散\n效能表現不如 ComfyUI\n僅限 PC 使用",
      recommended: "AI 繪圖新手、想快速出成果者",
      url: "https://www.youtube.com/watch?v=4HCPrO1vrIQ",
      duration: "約 45 分鐘",
      steps: [
        { step: 1, action: "下載 Git 和 Python 3.10", time: "10 分鐘", detail: "安裝必要的運行環境" },
        { step: 2, action: "下載 WebUI 安裝包", time: "5 分鐘", detail: "從 GitHub 下載原始碼" },
        { step: 3, action: "執行安裝腳本", time: "20 分鐘", detail: "自動下載依賴和模型" },
        { step: 4, action: "首次啟動設定", time: "5 分鐘", detail: "檢查顯示卡和基本設定" },
        { step: 5, action: "下載第一個模型", time: "5 分鐘", detail: "從 Civitai 下載推薦模型" }
      ]
    },
    {
      id: "reforge",
      title: "🔵 WebUI-ReForge（強化版）",
      level: "⭐⭐☆☆☆（稍有基礎可上手）",
      purpose: "WebUI 強化整合版，操作更順、效率更高",
      pros: "更現代的 UI、整合度高\n支援批量處理與多圖流程\n維持與 SD WebUI 相容",
      cons: "官方更新穩定度略低\n中文教學相對少\n僅限 PC 使用",
      recommended: "已有 WebUI 基礎、想優化流程的使用者",
      url: "https://www.youtube.com/watch?v=BBvjHMbkqxw",
      duration: "約 40 分鐘",
      steps: [
        { step: 1, action: "確認系統需求", time: "5 分鐘", detail: "檢查 Python 和顯示卡驅動" },
        { step: 2, action: "下載 ReForge 版本", time: "5 分鐘", detail: "從官方倉庫下載" },
        { step: 3, action: "執行安裝程序", time: "25 分鐘", detail: "自動安裝和配置" },
        { step: 4, action: "啟動和測試", time: "5 分鐘", detail: "確認功能正常運作" }
      ]
    },
    {
      id: "comfyui",
      title: "🟠 ComfyUI（節點式工作流）",
      level: "⭐⭐⭐⭐☆（進階）",
      purpose: "模組化節點控制，可自由打造流程與動畫",
      pros: "效能穩定、省顯存\n工作流邏輯清楚，可視化每一步\n支援批量、差分、影片生成等進階功能\n可完全自訂創作流程",
      cons: "學習曲線高，需要理解節點邏輯\n初期會覺得像在看電路圖\n僅限 PC 使用",
      recommended: "熟悉 WebUI、追求自動化與高控制力的進階使用者",
      url: "https://www.youtube.com/watch?v=7WZCvVrw7To",
      duration: "約 60 分鐘",
      steps: [
        { step: 1, action: "安裝 Python 環境", time: "10 分鐘", detail: "設定 Python 3.10 和 pip" },
        { step: 2, action: "下載 ComfyUI", time: "5 分鐘", detail: "從 GitHub 克隆倉庫" },
        { step: 3, action: "安裝依賴套件", time: "20 分鐘", detail: "安裝 PyTorch 和其他套件" },
        { step: 4, action: "下載模型和節點", time: "15 分鐘", detail: "下載基礎模型和擴展" },
        { step: 5, action: "學習節點操作", time: "10 分鐘", detail: "理解基本節點邏輯" }
      ]
    },
  ];

  return (
    <>

           <div className="max-w-3xl mx-auto py-10 px-4 text-white">
             <h1 className="text-2xl font-bold mb-6">📦 安裝教學導引</h1>
             
             {/* 安裝前須知 */}
             <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6 text-blue-900 rounded-r-lg">
               <h2 className="font-semibold mb-3">📋 安裝前須知</h2>
               <div className="space-y-3 text-sm">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                     <h3 className="font-semibold mb-2">💻 電腦需求</h3>
                     <ul className="list-disc pl-5 space-y-1">
                       <li><strong>作業系統：</strong> Windows 10/11</li>
                       <li><strong>顯示卡：</strong> NVIDIA GTX 1060 以上（建議 RTX 3060）</li>
                       <li><strong>記憶體：</strong> 8GB RAM 以上（建議 16GB）</li>
                       <li><strong>硬碟空間：</strong> 20GB 以上可用空間</li>
                       <li><strong>網路：</strong> 穩定網路連線（下載模型用）</li>
                     </ul>
                   </div>
                   <div>
                     <h3 className="font-semibold mb-2">⏱️ 準備工作</h3>
                     <ul className="list-disc pl-5 space-y-1">
                       <li><strong>安裝時間：</strong> 30-60 分鐘</li>
                       <li><strong>學習時間：</strong> 1-2 小時</li>
                       <li><strong>需要準備：</strong> 耐心和穩定的網路</li>
                       <li><strong>成功率：</strong> 95%（按步驟操作）</li>
                     </ul>
                   </div>
                 </div>
                 <div className="bg-yellow-100 border border-yellow-300 p-3 rounded">
                   <p className="font-semibold text-yellow-800">⚠️ 重要提醒</p>
                   <p className="text-yellow-700">所有版本皆需於電腦環境中操作安裝，手機與平板裝置無法直接使用。</p>
                 </div>
               </div>
             </div>
             
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
              <li><strong>✅ 優點：</strong><div className="mt-1">{g.pros.split('\n').map((line, idx) => <div key={idx}>{line}</div>)}</div></li>
              <li><strong>⚠️ 缺點：</strong><div className="mt-1">{g.cons.split('\n').map((line, idx) => <div key={idx}>{line}</div>)}</div></li>
              <li><strong>👍 推薦對象：</strong>{g.recommended}</li>
              <li><strong>⏱️ 安裝時間：</strong><span className="text-blue-400">{g.duration}</span></li>
            </ul>

            {/* 安裝步驟摘要 */}
            <details className="mt-4 bg-zinc-900/60 border border-white/10 rounded-lg overflow-hidden">
              <summary className="cursor-pointer select-none px-3 py-2 flex items-center justify-between gap-3 hover:bg-zinc-700/50 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📋</span>
                  <span className="text-sm font-semibold text-white">安裝步驟摘要</span>
                  <span className="text-xs text-zinc-400">（點擊展開）</span>
                </div>
                <span className="text-zinc-400 text-xs">{g.duration}</span>
              </summary>
              <div className="px-3 pb-3 border-t border-white/10">
                <p className="text-xs text-zinc-300 mb-3">快速了解安裝流程，適合不想看完整影片的用戶：</p>
                <div className="space-y-2">
                  {g.steps.map((step, idx) => (
                    <div key={idx} className="bg-zinc-800/60 border border-white/5 p-3 rounded-lg">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                          {step.step}
                        </span>
                        <span className="font-semibold text-blue-400 text-sm">{step.action}</span>
                        <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full ml-auto">
                          {step.time}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 ml-8">{step.detail}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-zinc-500 mt-3">
                  💡 建議：第一次安裝還是建議觀看完整影片，確保每個步驟都正確執行
                </p>
              </div>
            </details>

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
              <span className="ml-2 text-xs bg-blue-500 px-2 py-0.5 rounded-full">{g.duration}</span>
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
