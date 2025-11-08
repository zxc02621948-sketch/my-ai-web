// app/qa/QAContent.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { usePlayer } from "@/components/context/PlayerContext";
import { useCurrentUser } from "@/contexts/CurrentUserContext";

export default function QAContent() {
  const [query, setQuery] = useState("");
  const player = usePlayer();
  const { currentUser } = useCurrentUser();

  // 教學區頁面：依釘選狀態恢復或關閉 MiniPlayer
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
      player?.setPlayerOwner?.({ userId: pinnedPlayer.userId, username: pinnedPlayer.username, allowShuffle: !!pinnedPlayer.allowShuffle });
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

  // 術語小詞典
  const glossary = {
    "Prompt（提示詞）": "用來描述你想要生成什麼圖片的文字。例如：「a beautiful girl, long hair, anime style」",
    "Checkpoint（大模型）": "主要的 AI 模型檔案，決定整體畫風和風格。每個模型都有不同的特色。",
    "LoRA（附加模型）": "小型附加模型，用來調整特定風格、角色或細節。需要搭配 Checkpoint 使用。",
    "Sampler（取樣器）": "決定圖片生成算法的工具。不同取樣器會產生不同質感和細節。",
    "VAE（色彩解碼器）": "控制圖片顏色和細節的檔案。有些模型需要指定 VAE 才能正常顯色。",
    "顯存（VRAM）": "顯示卡的記憶體。生成圖片時會大量使用，影響能生成的圖片大小。",
    "Seed（種子碼）": "控制隨機性的數字。相同的 seed 會產生相同的圖片，-1 代表隨機。",
    "CFG Scale（提示詞遵從度）": "控制 AI 多麼「聽話」的參數。數值越高越會按照你的提示詞生成。",
    "Hires.fix（高解析度修復）": "先生成小圖再放大的技術，可以產生更高解析度的圖片。",
    "Embedding / Textual Inversion": "用來學習特定風格或概念的檔案，可以讓 AI 學會新的風格。"
  };

  const faqs = useMemo(
    () => [
      {
        cat: "模型 / LoRA 基礎",
        q: "為什麼我用一樣的題詞，生出來的圖完全不同？",
        a: (
          <div className="space-y-2">
            <p>
              常見原因：
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <b>模型不同</b>：即使題詞相同，不同模型（Checkpoint）會用不同風格與訓練資料，
                畫風、構圖與細節可能差很多。請先確認使用的模型與參考作品一致。
              </li>
              <li>
                <b>沒有使用對應的 LoRA</b>：很多作品需要搭配 LoRA 才能達到相同效果。
                沒有加載相同的 LoRA，即使題詞一樣，結果也會差異很大。
              </li>
              <li>
                <b>其他參數不同</b>：取樣器（Sampler）、步數（Steps）、種子（Seed）、分辨率（Resolution）
                都會影響結果。參考別人作品時，建議一併複製這些設定。
              </li>
            </ul>
            <p>
              💡 小提示：在本站圖片下方會顯示模型名稱、LoRA 名稱與部分參數，方便複製與對照。
            </p>
          </div>
        ),
        tags: ["模型", "LoRA", "差異", "題詞不同結果"],
      },
      {
        cat: "模型 / LoRA 基礎",
        q: "模型與 LoRA 檔案要放哪裡？",
        a: (
          <div className="space-y-4">
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 text-blue-800">
              <p className="font-semibold mb-2">📁 如何找到你的 webui 資料夾？</p>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>方法1：找到 <code className="bg-blue-100 px-1 rounded">webui.bat</code> 或 <code className="bg-blue-100 px-1 rounded">webui-user.bat</code> 檔案，這就是你的 webui 資料夾</li>
                <li>方法2：桌面上的 Stable Diffusion 捷徑，右鍵「開啟檔案位置」</li>
                <li>方法3：如果你用 Git 安裝，通常在 <code className="bg-blue-100 px-1 rounded">C:\stable-diffusion-webui</code> 或 <code className="bg-blue-100 px-1 rounded">D:\stable-diffusion-webui</code></li>
              </ul>
            </div>
            
            <div className="bg-gray-50 border border-gray-300 p-4 rounded">
              <p className="font-semibold mb-3">📂 資料夾結構示意圖：</p>
              <pre className="text-sm font-mono text-gray-700 whitespace-pre-wrap">{`stable-diffusion-webui/
├── models/
│   ├── Stable-diffusion/  ← Checkpoint 放這裡
│   ├── Lora/             ← LoRA 放這裡  
│   └── VAE/              ← VAE 放這裡
├── webui.bat             ← 啟動檔案
└── ...`}</pre>
            </div>

          <div className="space-y-2">
              <div className="bg-green-50 border border-green-200 p-3 rounded">
                <p className="font-semibold text-green-800 mb-1">✅ Checkpoint（大模型）</p>
                <p className="text-sm text-green-700">
                  檔案格式：<code className="bg-green-100 px-1 rounded">.ckpt</code> 或 <code className="bg-green-100 px-1 rounded">.safetensors</code>
                </p>
                <p className="text-sm text-green-700">
                  放置位置：<code className="bg-green-100 px-1 rounded">你的webui目錄根/models/Stable-diffusion</code>
                </p>
              </div>
              
              <div className="bg-purple-50 border border-purple-200 p-3 rounded">
                <p className="font-semibold text-purple-800 mb-1">🎨 LoRA（附加模型）</p>
                <p className="text-sm text-purple-700">
                  檔案格式：<code className="bg-purple-100 px-1 rounded">.safetensors</code>
                </p>
                <p className="text-sm text-purple-700">
                  放置位置：<code className="bg-purple-100 px-1 rounded">你的webui目錄根/models/Lora</code>
                </p>
              </div>
              
              <div className="bg-orange-50 border border-orange-200 p-3 rounded">
                <p className="font-semibold text-orange-800 mb-1">🎨 VAE（色彩解碼器）</p>
                <p className="text-sm text-orange-700">
                  檔案格式：<code className="bg-orange-100 px-1 rounded">.pt</code> 或 <code className="bg-orange-100 px-1 rounded">.safetensors</code>
                </p>
                <p className="text-sm text-orange-700">
                  放置位置：<code className="bg-orange-100 px-1 rounded">你的webui目錄根/models/VAE</code>
                </p>
              </div>
            </div>

            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <p className="font-semibold text-yellow-800 mb-2">⚠️ 常見問題：</p>
              <ul className="list-disc pl-5 space-y-1 text-sm text-yellow-700">
                <li><strong>找不到資料夾？</strong> 先啟動一次 WebUI，它會自動建立資料夾</li>
                <li><strong>放錯位置？</strong> 重新放到正確位置後，重啟 WebUI</li>
                <li><strong>檔案名稱？</strong> 保持原始檔名，不要重新命名</li>
              </ul>
            </div>
          </div>
        ),
        tags: ["模型", "LoRA", "路徑", "資料夾", "新手"],
      },
      {
        cat: "新手必看",
        q: "我剛裝好 SD，接下來要做什麼？（第一次生圖完整流程）",
        a: (
          <div className="space-y-4">
            <div className="bg-green-50 border-l-4 border-green-400 p-4">
              <p className="font-semibold text-green-800 mb-2">🎯 目標：成功生成第一張圖片</p>
              <p className="text-sm text-green-700">按照以下 5 個步驟，新手也能輕鬆上手！</p>
            </div>

            <div className="space-y-3">
              <div className="bg-blue-50 border border-blue-200 p-4 rounded">
                <div className="flex items-center mb-2">
                  <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3">1</span>
                  <h3 className="font-semibold text-blue-800">下載一個模型</h3>
                </div>
                <div className="ml-9 space-y-2 text-sm text-blue-700">
                  <p><strong>推薦新手模型：</strong></p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>PONY v6</strong> - 二次元風格，簡單易用</li>
                    <li><strong>Realistic Vision</strong> - 寫實風格</li>
                    <li><strong>DreamShaper</strong> - 通用風格</li>
                  </ul>
                  <p><strong>下載位置：</strong> <a href="https://civitai.com" target="_blank" className="underline">Civitai.com</a>，選擇 Checkpoint 類型</p>
                  <p><strong>放置位置：</strong> <code className="bg-blue-100 px-1 rounded">你的webui目錄/models/Stable-diffusion/</code></p>
                </div>
              </div>

              <div className="bg-purple-50 border border-purple-200 p-4 rounded">
                <div className="flex items-center mb-2">
                  <span className="bg-purple-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3">2</span>
                  <h3 className="font-semibold text-purple-800">重新啟動 WebUI</h3>
                </div>
                <div className="ml-9 space-y-2 text-sm text-purple-700">
                  <p>下載模型後，<strong>必須重啟 WebUI</strong> 才能載入新模型</p>
                  <p>關閉 WebUI，重新執行 <code className="bg-purple-100 px-1 rounded">webui.bat</code></p>
                  <p className="text-xs text-purple-600">💡 為什麼要重啟？因為 WebUI 只會在啟動時載入模型列表</p>
                </div>
              </div>

              <div className="bg-orange-50 border border-orange-200 p-4 rounded">
                <div className="flex items-center mb-2">
                  <span className="bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3">3</span>
                  <h3 className="font-semibold text-orange-800">選擇模型</h3>
                </div>
                <div className="ml-9 space-y-2 text-sm text-orange-700">
                  <p><strong>在哪裡選：</strong> 左上角的模型下拉選單</p>
                  <p><strong>怎麼確認：</strong> 選擇你剛下載的模型名稱</p>
                  <p><strong>等待載入：</strong> 模型切換需要 10-30 秒</p>
                  <p className="text-xs text-orange-600">💡 如果沒看到模型，檢查是否放在正確資料夾</p>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 p-4 rounded">
                <div className="flex items-center mb-2">
                  <span className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3">4</span>
                  <h3 className="font-semibold text-green-800">輸入提示詞</h3>
                </div>
                <div className="ml-9 space-y-2 text-sm text-green-700">
                  <p><strong>正面提示詞（Prompt）：</strong></p>
                  <code className="bg-green-100 px-2 py-1 rounded block text-xs">beautiful girl, long hair, anime style, masterpiece</code>
                  
                  <p><strong>負面提示詞（Negative prompt）：</strong></p>
                  <code className="bg-green-100 px-2 py-1 rounded block text-xs">low quality, blurry, bad anatomy</code>
                  
                  <p><strong>基本參數：</strong></p>
                  <ul className="list-disc pl-5 space-y-1 text-xs">
                    <li>Steps: 20-30</li>
                    <li>CFG Scale: 7</li>
                    <li>Size: 512x512</li>
                  </ul>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 p-4 rounded">
                <div className="flex items-center mb-2">
                  <span className="bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3">5</span>
                  <h3 className="font-semibold text-red-800">點擊生成</h3>
                </div>
                <div className="ml-9 space-y-2 text-sm text-red-700">
                  <p><strong>按鈕位置：</strong> 右側的橘色「Generate」按鈕</p>
                  <p><strong>等待時間：</strong> 通常 30 秒到 2 分鐘（看你的顯示卡）</p>
                  <p><strong>完成後：</strong> 圖片會出現在下方，可以右鍵儲存</p>
                  <p className="text-xs text-red-600">💡 第一次生成會比較慢，之後會快一些</p>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <p className="font-semibold text-yellow-800 mb-2">🎉 恭喜！你已經成功生成第一張 AI 圖片了！</p>
              <p className="text-sm text-yellow-700">現在你可以嘗試不同的提示詞，或者下載更多模型來探索不同的風格。</p>
            </div>
          </div>
        ),
        tags: ["新手", "第一次", "生圖", "流程", "教學"],
      },
      {
        cat: "新手必看",
        q: "基本的 Prompt 怎麼寫？（提示詞入門教學）",
        a: (
          <div className="space-y-4">
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
              <p className="font-semibold text-blue-800 mb-2">📝 Prompt 基本概念</p>
              <p className="text-sm text-blue-700">Prompt 就是告訴 AI「你想要什麼」的文字描述。寫得越好，圖片越符合期待！</p>
            </div>

            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 p-4 rounded">
                <h3 className="font-semibold text-green-800 mb-2">✅ 正面提示詞結構</h3>
                <div className="space-y-2 text-sm text-green-700">
                  <p><strong>基本格式：</strong> <code className="bg-green-100 px-1 rounded">主體 + 細節 + 風格 + 品質詞</code></p>
                  
                  <div className="bg-white border border-green-300 p-3 rounded">
                    <p className="font-semibold mb-1">範例分解：</p>
                    <code className="text-xs block">{`beautiful girl, long silver hair, blue eyes, 
wearing school uniform, standing pose,
anime style, detailed face,
masterpiece, best quality, highly detailed`}</code>
                    <div className="mt-2 text-xs space-y-1">
                      <p><span className="font-semibold">主體：</span> beautiful girl</p>
                      <p><span className="font-semibold">細節：</span> long silver hair, blue eyes, wearing school uniform</p>
                      <p><span className="font-semibold">姿勢：</span> standing pose</p>
                      <p><span className="font-semibold">風格：</span> anime style</p>
                      <p><span className="font-semibold">品質：</span> masterpiece, best quality</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 p-4 rounded">
                <h3 className="font-semibold text-red-800 mb-2">❌ 負面提示詞（避免這些）</h3>
                <div className="space-y-2 text-sm text-red-700">
                  <p><strong>常用負面詞彙：</strong></p>
                  <code className="bg-red-100 px-2 py-1 rounded block text-xs">low quality, blurry, bad anatomy, deformed, ugly, duplicate, mutated hands, extra fingers, missing fingers, bad proportions</code>
                </div>
              </div>

              <div className="bg-purple-50 border border-purple-200 p-4 rounded">
                <h3 className="font-semibold text-purple-800 mb-2">🎨 不同風格範例</h3>
                <div className="space-y-3 text-sm text-purple-700">
                  <div>
                    <p className="font-semibold">二次元動漫：</p>
                    <code className="bg-purple-100 px-1 rounded text-xs">anime style, manga, cel shading, vibrant colors</code>
                  </div>
                  <div>
                    <p className="font-semibold">寫實風格：</p>
                    <code className="bg-purple-100 px-1 rounded text-xs">photorealistic, realistic, detailed skin, natural lighting</code>
                  </div>
                  <div>
                    <p className="font-semibold">油畫風格：</p>
                    <code className="bg-purple-100 px-1 rounded text-xs">oil painting, classical art, renaissance style</code>
                  </div>
                </div>
              </div>

              <div className="bg-orange-50 border border-orange-200 p-4 rounded">
                <h3 className="font-semibold text-orange-800 mb-2">⚡ 權重語法</h3>
                <div className="space-y-2 text-sm text-orange-700">
                  <p><strong>加強重要性：</strong> <code className="bg-orange-100 px-1 rounded">(關鍵詞)</code> 或 <code className="bg-orange-100 px-1 rounded">(關鍵詞:1.2)</code></p>
                  <p><strong>範例：</strong> <code className="bg-orange-100 px-1 rounded">(beautiful eyes:1.3), long (hair:1.2), anime style</code></p>
                  <p className="text-xs text-orange-600">💡 數字越大越重要，通常 1.0-1.5 就夠了</p>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <p className="font-semibold text-yellow-800 mb-2">💡 寫 Prompt 的小技巧</p>
              <ul className="list-disc pl-5 space-y-1 text-sm text-yellow-700">
                <li>用英文寫效果最好，中文也可以但效果較差</li>
                <li>用逗號分隔不同概念</li>
                <li>重要的詞放前面</li>
                <li>多試幾次，每次調整一點點</li>
                <li>參考別人的作品，學習好的 Prompt</li>
              </ul>
            </div>
          </div>
        ),
        tags: ["Prompt", "提示詞", "新手", "教學", "範例"],
      },
      {
        cat: "新手必看",
        q: "我應該下載什麼模型？（新手推薦模型）",
        a: (
          <div className="space-y-4">
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
              <p className="font-semibold text-blue-800 mb-2">🎯 新手模型選擇建議</p>
              <p className="text-sm text-blue-700">第一次使用建議先下載 1-2 個基礎模型，熟悉後再擴展。</p>
            </div>

            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 p-4 rounded">
                <h3 className="font-semibold text-green-800 mb-3">🌟 新手必備（選一個）</h3>
                <div className="space-y-3">
                  <div className="bg-white border border-green-300 p-3 rounded">
                    <h4 className="font-semibold text-green-700 mb-1">1. PONY v6</h4>
                    <ul className="text-sm text-green-600 space-y-1">
                      <li>• <strong>風格：</strong> 二次元動漫風格</li>
                      <li>• <strong>特色：</strong> 簡單易用、效果穩定</li>
                      <li>• <strong>適合：</strong> 喜歡動漫、插畫風格的用戶</li>
                      <li>• <strong>下載：</strong> Civitai 搜尋 "PONY v6"</li>
                    </ul>
                  </div>
                  
                  <div className="bg-white border border-green-300 p-3 rounded">
                    <h4 className="font-semibold text-green-700 mb-1">2. Realistic Vision</h4>
                    <ul className="text-sm text-green-600 space-y-1">
                      <li>• <strong>風格：</strong> 寫實人物風格</li>
                      <li>• <strong>特色：</strong> 細節豐富、真實感強</li>
                      <li>• <strong>適合：</strong> 喜歡寫實風格的用戶</li>
                      <li>• <strong>下載：</strong> Civitai 搜尋 "Realistic Vision"</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 border border-purple-200 p-4 rounded">
                <h3 className="font-semibold text-purple-800 mb-3">🎨 進階選擇（熟悉後可試）</h3>
                <div className="space-y-2 text-sm text-purple-700">
                  <div className="bg-white border border-purple-300 p-2 rounded">
                    <strong>DreamShaper：</strong> 通用風格，什麼都能畫
                  </div>
                  <div className="bg-white border border-purple-300 p-2 rounded">
                    <strong>Anything V5：</strong> 高品質二次元，細節豐富
                  </div>
                  <div className="bg-white border border-purple-300 p-2 rounded">
                    <strong>ChilloutMix：</strong> 亞洲面孔寫實風格
                  </div>
                </div>
              </div>

              <div className="bg-orange-50 border border-orange-200 p-4 rounded">
                <h3 className="font-semibold text-orange-800 mb-2">💡 選擇建議</h3>
                <ul className="list-disc pl-5 space-y-1 text-sm text-orange-700">
                  <li><strong>完全新手：</strong> 先選 PONY v6，最容易上手</li>
                  <li><strong>喜歡寫實：</strong> 直接選 Realistic Vision</li>
                  <li><strong>顯存不足：</strong> 選擇較小的模型（2-4GB）</li>
                  <li><strong>顯存充足：</strong> 可以嘗試 SDXL 模型</li>
                </ul>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded">
                <h3 className="font-semibold text-yellow-800 mb-2">⚠️ 注意事項</h3>
                <ul className="list-disc pl-5 space-y-1 text-sm text-yellow-700">
                  <li>模型檔案通常很大（2-7GB），確保網路穩定</li>
                  <li>下載後必須重啟 WebUI 才能使用</li>
                  <li>不要一次下載太多，先熟悉一個再換</li>
                  <li>從 Civitai 下載時注意模型類型選擇 "Checkpoint"</li>
                </ul>
              </div>
            </div>
          </div>
        ),
        tags: ["模型", "推薦", "新手", "下載", "選擇"],
      },
      {
        cat: "新手必看",
        q: "圖片生成速度很慢怎麼辦？（性能優化基礎）",
        a: (
          <div className="space-y-4">
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
              <p className="font-semibold text-blue-800 mb-2">⚡ 性能優化基礎指南</p>
              <p className="text-sm text-blue-700">讓你的 SD 跑得更快，提升使用體驗！</p>
            </div>

            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 p-4 rounded">
                <h3 className="font-semibold text-green-800 mb-3">🚀 立即改善（簡單有效）</h3>
                <div className="space-y-2 text-sm text-green-700">
                  <div className="bg-white border border-green-300 p-3 rounded">
                    <h4 className="font-semibold mb-1">1. 調整圖片尺寸</h4>
                    <p>• 從 1024x1024 降到 512x512 或 768x768</p>
                    <p>• 速度提升：約 2-3 倍</p>
                  </div>
                  <div className="bg-white border border-green-300 p-3 rounded">
                    <h4 className="font-semibold mb-1">2. 降低 Steps</h4>
                    <p>• 從 30 降到 20-25</p>
                    <p>• 速度提升：約 30-50%</p>
                  </div>
                  <div className="bg-white border border-green-300 p-3 rounded">
                    <h4 className="font-semibold mb-1">3. 關閉 Hires.fix</h4>
                    <p>• 暫時不使用高解析度修復</p>
                    <p>• 速度提升：約 50%</p>
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 border border-purple-200 p-4 rounded">
                <h3 className="font-semibold text-purple-800 mb-3">⚙️ 進階優化</h3>
                <div className="space-y-2 text-sm text-purple-700">
                  <div className="bg-white border border-purple-300 p-3 rounded">
                    <h4 className="font-semibold mb-1">4. 選擇更快的 Sampler</h4>
                    <p>• 推薦：DPM++ 2M Karras（速度快且品質好）</p>
                    <p>• 避免：DDIM（較慢）</p>
                  </div>
                  <div className="bg-white border border-purple-300 p-3 rounded">
                    <h4 className="font-semibold mb-1">5. 調整 CFG Scale</h4>
                    <p>• 從 7-8 降到 5-6（速度更快）</p>
                    <p>• 太低可能效果不佳，需要測試</p>
                  </div>
                  <div className="bg-white border border-purple-300 p-3 rounded">
                    <h4 className="font-semibold mb-1">6. 關閉不必要的擴展</h4>
                    <p>• 停用不常用的 ControlNet 等擴展</p>
                    <p>• 減少記憶體使用</p>
                  </div>
                </div>
              </div>

              <div className="bg-orange-50 border border-orange-200 p-4 rounded">
                <h3 className="font-semibold text-orange-800 mb-3">💻 硬體相關</h3>
                <div className="space-y-2 text-sm text-orange-700">
                  <div className="bg-white border border-orange-300 p-3 rounded">
                    <h4 className="font-semibold mb-1">顯示卡記憶體不足？</h4>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>降低圖片尺寸到 512x512</li>
                      <li>關閉 Hires.fix</li>
                      <li>減少 Batch size 到 1</li>
                      <li>重啟 WebUI 清理記憶體</li>
                    </ul>
                  </div>
                  <div className="bg-white border border-orange-300 p-3 rounded">
                    <h4 className="font-semibold mb-1">系統記憶體不足？</h4>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>關閉其他程式</li>
                      <li>增加虛擬記憶體</li>
                      <li>考慮升級 RAM</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 p-4 rounded">
                <h3 className="font-semibold text-red-800 mb-2">🎯 速度 vs 品質平衡</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="bg-white border border-red-300 p-3 rounded">
                    <h4 className="font-semibold text-red-700 mb-1">快速模式</h4>
                    <ul className="list-disc pl-5 space-y-1 text-red-600">
                      <li>512x512, Steps: 20</li>
                      <li>CFG: 6, 關閉 Hires.fix</li>
                      <li>適合：快速測試、批量生成</li>
                    </ul>
                  </div>
                  <div className="bg-white border border-red-300 p-3 rounded">
                    <h4 className="font-semibold text-red-700 mb-1">品質模式</h4>
                    <ul className="list-disc pl-5 space-y-1 text-red-600">
                      <li>768x768, Steps: 30</li>
                      <li>CFG: 7-8, 開啟 Hires.fix</li>
                      <li>適合：最終成品、重要作品</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ),
        tags: ["性能", "速度", "優化", "設定", "新手"],
      },
      {
        cat: "模型 / LoRA 基礎",
        q: "LoRA 怎麼使用？需要手打 <lora:...> 嗎？",
        a: (
          <div className="space-y-2">
            <p>
              現在 WebUI 通常有「附加網路 / LoRA」標籤頁，會顯示所有 LoRA
              圖卡，<b>點圖卡</b>即可自動把調用語法插入 prompt。
            </p>
            <p>與 LoRA 檔同名的圖片放一起，圖卡就會顯示那張預覽圖。</p>
          </div>
        ),
        tags: ["LoRA", "附加網路", "圖卡"],
      },
      {
        cat: "模型 / LoRA 基礎",
        q: "在哪裡下載模型？怎麼篩選？",
        a: (
          <div className="space-y-2">
            <p>
              推薦 <b>Civitai</b>。搜尋時請把類型篩選為
              <b> Checkpoint / Checkpoint Merge</b>（才是能單獨出圖的大模型）。
            </p>
            <p>LoRA / Textual Inversion / Embedding 都是附加模型，需要搭配基底 Checkpoint。</p>
            <p>挑選看：標籤、評分、下載量、更新時間、是否附推薦參數與指定 VAE。</p>
          </div>
        ),
        tags: ["Civitai", "Checkpoint", "Merge", "下載"],
      },
      {
        cat: "模型版本",
        q: "SD 1.5、SDXL、SD 2.x 有什麼差別？",
        a: (
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <b>SD 1.5</b>（512x512）：資源最多、跑得快、可控性高；LoRA 生態最豐富。
            </li>
            <li>
              <b>SD 2.x</b>（768x768）：細節較精緻，但構圖自由度較低。
            </li>
            <li>
              <b>SDXL 1.0</b>（1024x1024）：細節與自然度最佳，但顯存需求較高（建議 ≥ 8GB）。
            </li>
            <li>
              <b>相容性</b>：1.5 的 LoRA 不能直接用在 SDXL，下載前看模型頁面的 Base Model。
            </li>
          </ul>
        ),
        tags: ["1.5", "SDXL", "相容性"],
      },
      {
        cat: "模型類型",
        q: "PONY 是什麼模型？適合什麼題材？",
        a: (
          <div className="space-y-2">
            <p>
              <b>PONY</b> 是熱門的 <b>二次元/動漫風</b> 模型，擅長可愛、偶像、Vtuber
              風格人物，線條乾淨、色彩柔和。
            </p>
            <p>適合：二次元角色立繪、同人、萌系插畫。要寫實風建議改用 Realistic 系列或 SDXL 寫實模型。</p>
          </div>
        ),
        tags: ["PONY", "Anime", "二次元"],
      },
      {
        cat: "參數：取樣器/步數/CFG/ClipSkip",
        q: "取樣器（Sampler）要選哪個？",
        a: (
          <div className="space-y-2">
            <p>取樣器決定生成演算法，影響細節與穩定性。</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <b>DPM++ 2M Karras</b>：穩定、細節好，通用首選。
              </li>
              <li>
                <b>DPM++ SDE Karras</b>：質感更柔和。
              </li>
              <li>
                <b>Euler a</b>：速度快、風格隨性。
              </li>
              <li>
                <b>Restart</b>：新版常見推薦，有時能減少瑕疵，可一試。
              </li>
            </ul>
          </div>
        ),
        tags: ["Sampler", "Restart", "DPM++"],
      },
      {
        cat: "參數：取樣器/步數/CFG/ClipSkip",
        q: "Steps 要多少？",
        a: <div>一般 20–30 已足夠；再高多半回報遞減。啟用 Hires 時兩階段可各自設定。</div>,
        tags: ["Steps", "步數"],
      },
      {
        cat: "參數：取樣器/步數/CFG/ClipSkip",
        q: "CFG Scale 是什麼？",
        a: <div>提示詞遵從度（越高越聽話）。建議 5–8；太低不聽話，太高容易怪異或過飽和。</div>,
        tags: ["CFG"],
      },
      {
        cat: "參數：取樣器/步數/CFG/ClipSkip",
        q: "Clip Skip（跳過層）要設多少？",
        a: <div>常用 1 或 2，依模型訓練設定而定；臉部或風格不對時可嘗試切換。</div>,
        tags: ["ClipSkip"],
      },
      {
        cat: "VAE / Hires",
        q: "VAE 要不要選？",
        a: (
          <div className="space-y-2">
            <p>
              控制顏色/細節的解碼器。有些模型<b>指定 VAE</b>才會正常顯色。
            </p>
            <p>
              安裝：放在 <code>models/VAE</code>，在設定中選取；無特別需求可用預設{" "}
              <code>vae-ft-mse-840000</code>。
            </p>
          </div>
        ),
        tags: ["VAE"],
      },
      {
        cat: "VAE / Hires",
        q: "高解析度修復怎麼用？",
        a: (
          <div className="space-y-2">
            <p>啟用 Hires.fix：先小圖，再放大做二次細化。</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>初始尺寸 512–768；放大倍率 1.5–2.0。</li>
              <li>放大演算法：Latent（細節多）、R-ESRGAN 4x（寫實感）。</li>
            </ul>
          </div>
        ),
        tags: ["Hires", "放大"],
      },
      {
        cat: "種子碼 / 批量",
        q: "種子碼（Seed）是什麼？",
        a: <div>控制隨機性：同 prompt/參數/種子 → 可重現同圖；<code>-1</code> 為每次隨機。</div>,
        tags: ["Seed", "種子碼"],
      },
      {
        cat: "種子碼 / 批量",
        q: "怎麼無限生圖？",
        a: (
              <div className="space-y-4">
                <div className="bg-green-50 border-l-4 border-green-400 p-4">
                  <p className="font-semibold text-green-800 mb-2">♾️ 無限生圖功能</p>
                  <p className="text-sm text-green-700">自動連續生成圖片，適合批量創作和測試不同效果。</p>
                </div>

                <div className="space-y-3">
                  <div className="bg-blue-50 border border-blue-200 p-4 rounded">
                    <h3 className="font-semibold text-blue-800 mb-2">🚀 啟動無限生圖</h3>
                    <div className="space-y-2 text-sm text-blue-700">
                      <div className="bg-white border border-blue-300 p-3 rounded">
                        <p className="font-semibold mb-1">方法 1：右鍵啟動（推薦）</p>
                        <p>1. 找到橘色的「<strong>Generate</strong>」按鈕</p>
                        <p>2. 在按鈕上<strong>按右鍵</strong></p>
                        <p>3. 選擇「<strong>Generate forever</strong>」</p>
                        <p className="text-xs text-blue-600 mt-1">💡 Mac 用戶：按住 Control 鍵再點擊</p>
                      </div>
                      <div className="bg-white border border-blue-300 p-3 rounded">
                        <p className="font-semibold mb-1">方法 2：快捷鍵</p>
                        <p>按 <code className="bg-blue-100 px-1 rounded">Ctrl+Shift+Enter</code></p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-purple-50 border border-purple-200 p-4 rounded">
                    <h3 className="font-semibold text-purple-800 mb-3">⚙️ 設定選項</h3>
                    <div className="space-y-2 text-sm text-purple-700">
                      <div className="bg-white border border-purple-300 p-3 rounded">
                        <h4 className="font-semibold mb-1">🔄 每張都不同（隨機效果）</h4>
                        <p>• 種子碼設為 <code className="bg-purple-100 px-1 rounded">-1</code></p>
                        <p>• 或勾選「隨機種子」選項</p>
                        <p>• 適合：尋找靈感、測試不同效果</p>
                      </div>
                      <div className="bg-white border border-purple-300 p-3 rounded">
                        <h4 className="font-semibold mb-1">🎯 固定構圖微調</h4>
                        <p>• 使用固定種子碼（例如：123456）</p>
                        <p>• 只調整 Prompt 中的細節</p>
                        <p>• 適合：精細調整、風格測試</p>
                      </div>
                      <div className="bg-white border border-purple-300 p-3 rounded">
                        <h4 className="font-semibold mb-1">📊 批量設定</h4>
                        <p>• <strong>Batch count：</strong> 每次生成的批次數</p>
                        <p>• <strong>Batch size：</strong> 每批次的圖片數量</p>
                        <p>• 適合：控制生成數量但非無限</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-red-50 border border-red-200 p-4 rounded">
                    <h3 className="font-semibold text-red-800 mb-2">⏹️ 停止無限生圖</h3>
                    <div className="space-y-2 text-sm text-red-700">
                      <div className="bg-white border border-red-300 p-3 rounded">
                        <h4 className="font-semibold mb-1">停止方法</h4>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>點擊「<strong>Stop</strong>」按鈕（會變成橘色）</li>
                          <li>按鍵盤 <strong>Esc</strong> 鍵</li>
                          <li>按快捷鍵 <code className="bg-red-100 px-1 rounded">Ctrl+C</code></li>
                          <li>關閉瀏覽器分頁（最後手段）</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 p-4 rounded">
                    <h3 className="font-semibold text-yellow-800 mb-2">💡 使用技巧</h3>
                    <ul className="list-disc pl-5 space-y-1 text-sm text-yellow-700">
                      <li><strong>節省時間：</strong> 先用低 Steps（15-20）快速測試</li>
                      <li><strong>節省空間：</strong> 定期清理不需要的圖片</li>
                      <li><strong>監控記憶體：</strong> 無限生圖會持續使用顯存</li>
                      <li><strong>網路穩定：</strong> 確保網路連線穩定（如果使用線上模型）</li>
                      <li><strong>溫度控制：</strong> 長時間運行注意電腦溫度</li>
                    </ul>
                  </div>
                </div>
              </div>
            ),
            tags: ["Batch", "自動化", "無限", "批量", "連續"],
          },
          // 常見錯誤分類
          {
            cat: "常見錯誤",
            q: "CUDA out of memory 錯誤怎麼辦？",
            a: (
              <div className="space-y-3">
                <div className="bg-red-50 border-l-4 border-red-400 p-4">
                  <p className="font-semibold text-red-800 mb-2">❌ 錯誤原因</p>
                  <p className="text-sm text-red-700">顯示卡記憶體（VRAM）不夠用，通常是因為圖片太大或模型太大。</p>
                </div>
                
                <div className="space-y-2">
                  <div className="bg-green-50 border border-green-200 p-3 rounded">
                    <h3 className="font-semibold text-green-800 mb-2">✅ 解決方法（按優先順序）</h3>
                    <ul className="list-disc pl-5 space-y-1 text-sm text-green-700">
                      <li><strong>降低圖片解析度：</strong> 從 512x512 改成 512x768 或 768x512</li>
                      <li><strong>關閉 Hires.fix：</strong> 暫時不用高解析度修復</li>
                      <li><strong>減少 Batch size：</strong> 一次只生成 1 張圖片</li>
                      <li><strong>降低 Steps：</strong> 從 30 降到 20</li>
                      <li><strong>重啟 WebUI：</strong> 清除記憶體快取</li>
                      <li><strong>更換較小的模型：</strong> 使用 SD 1.5 而不是 SDXL</li>
                    </ul>
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-200 p-3 rounded">
                    <h3 className="font-semibold text-blue-800 mb-2">💡 預防措施</h3>
                    <ul className="list-disc pl-5 space-y-1 text-sm text-blue-700">
                      <li>4GB 顯存：建議 512x512，不開 Hires.fix</li>
                      <li>6GB 顯存：可以試試 768x768</li>
                      <li>8GB 以上：可以嘗試 SDXL 和 Hires.fix</li>
                    </ul>
                  </div>
                </div>
              </div>
            ),
            tags: ["錯誤", "記憶體", "CUDA", "VRAM", "解決"],
          },
          {
            cat: "常見錯誤",
            q: "圖片全黑或全綠怎麼辦？",
            a: (
              <div className="space-y-3">
                <div className="bg-red-50 border-l-4 border-red-400 p-4">
                  <p className="font-semibold text-red-800 mb-2">❌ 錯誤原因</p>
                  <p className="text-sm text-red-700">通常是 VAE 問題，或者模型沒有正確載入。</p>
                </div>
                
                <div className="space-y-2">
                  <div className="bg-green-50 border border-green-200 p-3 rounded">
                    <h3 className="font-semibold text-green-800 mb-2">✅ 解決方法</h3>
                    <ul className="list-disc pl-5 space-y-1 text-sm text-green-700">
                      <li><strong>檢查 VAE：</strong> 設定 → VAE → 選擇「Automatic」或「None」</li>
                      <li><strong>重新下載模型：</strong> 檔案可能損壞，重新下載</li>
                      <li><strong>檢查模型格式：</strong> 確認是 .ckpt 或 .safetensors</li>
                      <li><strong>重啟 WebUI：</strong> 完全關閉後重新啟動</li>
                      <li><strong>更換模型：</strong> 試試其他模型看是否正常</li>
                    </ul>
                  </div>
                  
                  <div className="bg-yellow-50 border border-yellow-200 p-3 rounded">
                    <h3 className="font-semibold text-yellow-800 mb-2">⚠️ 特殊情況</h3>
                    <ul className="list-disc pl-5 space-y-1 text-sm text-yellow-700">
                      <li>如果只有特定模型出問題：該模型可能有問題</li>
                      <li>如果所有模型都出問題：可能是 WebUI 安裝問題</li>
                      <li>如果圖片有顏色但很怪：嘗試不同的 VAE</li>
                    </ul>
                  </div>
                </div>
              </div>
            ),
            tags: ["錯誤", "VAE", "全黑", "全綠", "顏色"],
          },
          {
            cat: "常見錯誤",
            q: "WebUI 無法啟動或閃退怎麼辦？",
            a: (
              <div className="space-y-3">
                <div className="bg-red-50 border-l-4 border-red-400 p-4">
                  <p className="font-semibold text-red-800 mb-2">❌ 常見原因</p>
                  <p className="text-sm text-red-700">缺少依賴、Python 版本問題、顯示卡驅動過舊。</p>
                </div>
                
                <div className="space-y-2">
                  <div className="bg-green-50 border border-green-200 p-3 rounded">
                    <h3 className="font-semibold text-green-800 mb-2">✅ 解決步驟</h3>
                    <ul className="list-disc pl-5 space-y-1 text-sm text-green-700">
                      <li><strong>更新顯示卡驅動：</strong> 到官網下載最新驅動</li>
                      <li><strong>檢查 Python：</strong> 確認安裝 Python 3.10.x</li>
                      <li><strong>重新安裝：</strong> 刪除整個資料夾，重新安裝</li>
                      <li><strong>檢查防火牆：</strong> 允許 WebUI 通過防火牆</li>
                      <li><strong>以管理員身分執行：</strong> 右鍵「以系統管理員身分執行」</li>
                    </ul>
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-200 p-3 rounded">
                    <h3 className="font-semibold text-blue-800 mb-2">🔍 檢查方法</h3>
                    <ul className="list-disc pl-5 space-y-1 text-sm text-blue-700">
                      <li>查看錯誤訊息：通常在命令提示字元視窗中</li>
                      <li>檢查 webui-user.bat：確認設定正確</li>
                      <li>嘗試不同版本：下載較穩定的版本</li>
                    </ul>
                  </div>
                </div>
              </div>
            ),
            tags: ["錯誤", "啟動", "閃退", "依賴", "驅動"],
          },
          {
            cat: "常見錯誤",
            q: "LoRA 沒有效果怎麼辦？",
            a: (
              <div className="space-y-3">
                <div className="bg-red-50 border-l-4 border-red-400 p-4">
                  <p className="font-semibold text-red-800 mb-2">❌ 可能原因</p>
                  <p className="text-sm text-red-700">權重太低、位置錯誤、模型不相容、沒有重啟 WebUI。</p>
                </div>
                
                <div className="space-y-2">
                  <div className="bg-green-50 border border-green-200 p-3 rounded">
                    <h3 className="font-semibold text-green-800 mb-2">✅ 檢查清單</h3>
                    <ul className="list-disc pl-5 space-y-1 text-sm text-green-700">
                      <li><strong>檔案位置：</strong> 確認放在 models/Lora/ 資料夾</li>
                      <li><strong>檔案格式：</strong> 確認是 .safetensors 格式</li>
                      <li><strong>重啟 WebUI：</strong> 下載後必須重啟才能載入</li>
                      <li><strong>權重設定：</strong> 嘗試 0.8-1.2 的權重值</li>
                      <li><strong>位置順序：</strong> LoRA 放在 prompt 前面效果更好</li>
                    </ul>
                  </div>
                  
                  <div className="bg-purple-50 border border-purple-200 p-3 rounded">
                    <h3 className="font-semibold text-purple-800 mb-2">🎯 使用技巧</h3>
                    <ul className="list-disc pl-5 space-y-1 text-sm text-purple-700">
                      <li><strong>權重測試：</strong> 從 0.5 開始，逐步調整到 1.5</li>
                      <li><strong>搭配模型：</strong> 確認 LoRA 與當前模型相容</li>
                      <li><strong>提示詞配合：</strong> 加入相關的描述詞</li>
                      <li><strong>多個 LoRA：</strong> 權重總和不要超過 2.0</li>
                    </ul>
                  </div>
                </div>
              </div>
            ),
            tags: ["LoRA", "沒效果", "權重", "相容性", "使用"],
          },
          {
            cat: "常見錯誤",
            q: "圖片跟範例差很多怎麼辦？",
            a: (
              <div className="space-y-3">
                <div className="bg-red-50 border-l-4 border-red-400 p-4">
                  <p className="font-semibold text-red-800 mb-2">❌ 常見原因</p>
                  <p className="text-sm text-red-700">模型不同、參數不同、LoRA 不同、或者缺少重要設定。</p>
                </div>
                
         <div className="space-y-2">
                  <div className="bg-green-50 border border-green-200 p-3 rounded">
                    <h3 className="font-semibold text-green-800 mb-2">✅ 檢查項目</h3>
                    <ul className="list-disc pl-5 space-y-1 text-sm text-green-700">
                      <li><strong>模型是否相同：</strong> 確認使用相同的 Checkpoint</li>
                      <li><strong>LoRA 是否載入：</strong> 檢查所有必要的 LoRA</li>
                      <li><strong>參數設定：</strong> CFG、Steps、Sampler 是否相同</li>
                      <li><strong>VAE 設定：</strong> 確認 VAE 選項正確</li>
                      <li><strong>Seed 設定：</strong> 使用固定 Seed 測試</li>
                    </ul>
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-200 p-3 rounded">
                    <h3 className="font-semibold text-blue-800 mb-2">💡 改善方法</h3>
                    <ul className="list-disc pl-5 space-y-1 text-sm text-blue-700">
                      <li><strong>逐步複製：</strong> 先複製 Prompt，再複製參數</li>
                      <li><strong>檢查版本：</strong> 確認模型版本與範例一致</li>
                      <li><strong>微調參數：</strong> 小幅度調整 CFG 和 Steps</li>
                      <li><strong>參考設定：</strong> 查看模型頁面的推薦設定</li>
           </ul>
                  </div>
                </div>
         </div>
        ),
            tags: ["差異", "範例", "參數", "設定", "複製"],
      },
    ],
    []
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return faqs;
    const q = query.toLowerCase();
    return faqs.filter(
      (item) =>
        item.q.toLowerCase().includes(q) ||
        item.cat.toLowerCase().includes(q) ||
        (item.tags || []).some((t) => t.toLowerCase().includes(q))
    );
  }, [faqs, query]);

  return (
    <main className="min-h-screen bg-[#111] text-zinc-100">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl md:text-3xl font-bold">Stable Diffusion 新手生成 Q&A</h1>
          <a href="/" className="text-sm text-zinc-300 hover:text-white underline">
            回首頁
          </a>
        </header>

        <div className="mb-6">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="輸入關鍵字（例如：PONY、CFG、VAE、Restart）"
            className="w-full rounded-xl bg-zinc-900 border border-white/10 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

            {/* 術語小詞典 */}
            <details className="mb-6 bg-zinc-800/60 border border-white/10 rounded-xl overflow-hidden">
              <summary className="cursor-pointer select-none px-4 py-3 flex items-center justify-between gap-3 hover:bg-zinc-700/50 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📚</span>
                  <span className="text-base font-semibold text-white">術語小詞典</span>
                  <span className="text-xs text-zinc-400">（點擊展開）</span>
                </div>
                <span className="text-zinc-400 text-sm">新手必看</span>
              </summary>
              <div className="px-4 pb-4 border-t border-white/10">
                <p className="text-sm text-zinc-300 mb-3">常見的 AI 繪圖術語解釋，幫助新手快速理解：</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(glossary).map(([term, definition]) => (
                    <div key={term} className="bg-zinc-900/60 border border-white/5 p-3 rounded-lg">
                      <dt className="font-semibold text-blue-400 text-sm mb-1">{term}</dt>
                      <dd className="text-xs text-zinc-300 leading-relaxed">{definition}</dd>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-zinc-500 mt-3">
                  💡 提示：如果遇到不認識的術語，可以用上面的搜尋框搜尋相關問題
                </p>
              </div>
            </details>

        <section className="space-y-3">
          {filtered.map((item, idx) => (
            <details key={idx} className="rounded-xl bg-zinc-900/60 border border-white/10">
              <summary className="cursor-pointer select-none px-4 py-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-zinc-400">{item.cat}</div>
                  <div className="text-base md:text-lg text-white">{item.q}</div>
                </div>
                <span className="text-zinc-400 text-sm">點我展開</span>
              </summary>
              <div className="px-4 pb-4 text-sm text-zinc-200 leading-relaxed">{item.a}</div>
            </details>
          ))}

          {filtered.length === 0 && (
            <div className="text-sm text-zinc-400">找不到相關問題，換個關鍵字試試～</div>
          )}
        </section>

        <footer className="mt-10 text-xs text-zinc-500">
          最後更新：2025-08-10 · 若有遺漏/錯誤歡迎回報，我們會持續更新。
        </footer>
      </div>
    </main>
  );
}
