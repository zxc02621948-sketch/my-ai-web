"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useCurrentUser } from "@/contexts/CurrentUserContext";
import { usePlayer } from "@/components/context/PlayerContext";

export default function ModelInfoPage() {
  const { currentUser } = useCurrentUser(); // 使用 Context
  const player = usePlayer();
  
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false); // ✅ 控制上傳圖片 modal

  // 教學區頁面：依釘選狀態恢復或關閉 MiniPlayer（與首頁/教學指南一致）
  useEffect(() => {
    if (currentUser === undefined) return;
    const pinnedPlayer = currentUser?.user?.pinnedPlayer || currentUser?.pinnedPlayer;
    const hasPinnedPlayer = pinnedPlayer?.userId && pinnedPlayer?.expiresAt && new Date(pinnedPlayer.expiresAt) > new Date();

    if (hasPinnedPlayer) {
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

      player?.setPlayerOwner?.({ userId: pinnedPlayer.userId, username: pinnedPlayer.username });
      player?.setShareMode?.("global");
      player?.setMiniPlayerEnabled?.(true);
      try {
        window.dispatchEvent(new CustomEvent('pinnedPlayerChanged', { detail: { isPinned: true, pinnedPlayer } }));
      } catch {}
    } else {
      player?.setMiniPlayerEnabled?.(false);
    }
  }, [currentUser]);

  // 即時響應釘選變更
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

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-4xl mx-auto px-4 py-8 mt-24">
        <h1 className="text-3xl font-bold mb-6 text-center">模型介紹與獲取</h1>

        {/* civitai.com 按鈕 */}
        <div className="text-center mb-8">
          <a
            href="https://civitai.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition"
          >
            前往 civitai.com 模型網站
          </a>
        </div>

        {/* civitai 使用說明區塊 */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">如何使用 civitai.com？</h2>
          <p className="text-gray-300 mb-4">
            Civitai 是目前最大的 Stable Diffusion 模型分享平台，包含了成千上萬的 <strong>Checkpoint 模型</strong>、
            <strong>LoRA 模型</strong>、<strong>Embedding</strong>、<strong>Hypernetwork</strong>…等資源。
            如果你想找模型來使用，可以依照以下步驟操作：
          </p>

          <ol className="list-decimal list-inside text-gray-300 space-y-2 pl-4">
            <li>進入 <strong>civitai.com</strong> 後，點選上方的 <strong>Models</strong> 頁籤</li>
            <li>點右上角的 <strong>Filters</strong>（過濾器）打開篩選器</li>
            <li>在 <strong>Type</strong> 類型中選擇：
              <ul className="list-disc list-inside ml-4 mt-1">
                <li><strong>Checkpoint</strong>：完整主模型（.safetensors）</li>
                <li><strong>LoRA</strong>：附加微調模型，可搭配主模型使用</li>
                <li><strong>Textual Inversion</strong>：小型提示詞嵌入強化詞</li>
              </ul>
            </li>
            <li>可進一步選擇 <strong>Style（風格）</strong> 或 <strong>Model Base（底模）</strong></li>
          </ol>

          <h3 className="text-xl font-semibold mt-6 mb-2 text-yellow-300">小知識：Pony 系列模型</h3>
          <p className="text-gray-300 mb-4">
            如果你是小馬控，可以在搜尋中輸入 <code>pony</code>，就能找到專門訓練小馬角色的 LoRA 或模型。
            常見如 <strong>Pony Diffusion</strong>、<strong>mlp_character</strong> 等都能生成高還原度角色圖。
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-2 text-pink-400">SD 1.x vs SDXL 的差異</h3>
          <ul className="list-disc list-inside text-gray-300 space-y-2 pl-4">
            <li><strong>SD 1.x</strong>：速度較快，模型較小（通常 4GB 以下），資源最多，支援最廣</li>
            <li><strong>SDXL</strong>：畫質細節更高，支援自然語言理解，檔案較大（6～9GB），對硬體要求較高</li>
            <li>SDXL 的 LoRA 通常與 1.x 不相容，要分開使用</li>
          </ul>
        </section>

        {/* Stable Diffusion 示意圖 */}
        <div className="mb-6">
          <Image
            src="/models/stablediffusion.jpg"
            alt="Stable Diffusion 示意圖"
            width={800}
            height={400}
            className="rounded-lg mx-auto"
          />
          <p className="text-sm text-gray-400 text-center mt-2">※ Stable Diffusion WebUI 的生成介面畫面</p>
        </div>

        {/* Stable Diffusion 說明 */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-2">什麼是 Stable Diffusion？</h2>
          <p className="text-gray-300">
            Stable Diffusion 是一種生成式 AI 模型，能夠根據提示文字（prompt）生成高品質圖像。
            它是目前最受歡迎的 AI 繪圖系統之一，支援多種擴充功能、樣式模型與角色微調技術。
          </p>
        </section>

        {/* LoRA 說明 + 使用教學 + 小技巧 */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-2">什麼是 LoRA？</h2>
          <p className="text-gray-300 mb-4">
            LoRA（Low-Rank Adaptation）是一種微調技術，讓使用者可以透過小量訓練，擴充 AI 模型的風格或角色能力。
            它不會改變原始模型本體，而是用「附加」的方式加入特定效果，因此載入快速又節省資源。
          </p>

          <h3 className="text-xl font-semibold mt-4 mb-2">如何使用 LoRA？</h3>
          <ol className="list-decimal list-inside text-gray-300 space-y-2 pl-4">
            <li>
              從 <a href="https://civitai.com/" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">Civitai</a> 下載 LoRA 檔案（通常是 <code>.safetensors</code> 格式）
            </li>
            <li>
              將檔案放入 Stable Diffusion 資料夾中的：
              <span className="text-yellow-300"> <code>/models/Lora/</code> </span>
            </li>
            <li>
              開啟 WebUI（如 Automatic1111），在下方的 <strong>LoRA 選單</strong> 中載入你放的模型
            </li>
            <li>
              在正面提示詞中插入：
              <code className="bg-zinc-800 px-2 py-1 rounded mx-1 text-sm">&lt;lora:模型名稱:1&gt;</code><br />
              例如：<code className="bg-zinc-800 px-2 py-1 rounded text-sm">&lt;lora:JapaneseSchoolGirl_v2:0.8&gt;</code>
            </li>
            <li>
              調整後即可搭配主模型進行生成 🎨
            </li>
          </ol>

          <p className="text-gray-300 mt-4">
            提醒：LoRA 名稱需與檔案名稱一致，冒號後的數字為強度，通常 0.6～1.0 是常見值。
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-2 text-green-400">小技巧：讓 LoRA 顯示預覽圖</h3>
          <p className="text-gray-300">
            如果你想讓 LoRA 模型在 WebUI 中顯示預覽圖，只要準備一張圖片（如 <code>.png</code>），
            放進 <code className="bg-zinc-800 px-2 py-1 rounded text-sm">/models/Lora/</code> 資料夾，
            並且命名為 <strong>跟模型同名</strong>（例如：<code>JapaneseSchoolGirl_v2.png</code>），
            WebUI 就會自動將它當作該 LoRA 模型的預覽圖來顯示，非常方便辨識與選擇。
          </p>
        </section>

        {/* 推薦模型清單 */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-2">推薦模型清單</h2>
          <ul className="list-disc list-inside text-gray-300 space-y-1">
            <li><strong>Pony Diffusion</strong>：專為小馬角色創作的模型</li>
            <li><strong>PVC Style Model</strong>：日系可愛風格，適合角色精緻繪製</li>
            <li><strong>Anything V5</strong>：萬用型模型，支援二次元與寫實風格</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
