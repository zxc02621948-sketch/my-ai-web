// app/qa/QAContent.jsx
"use client";

import { useMemo, useState } from "react";

export default function QAContent() {
  const [query, setQuery] = useState("");

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
          <div className="space-y-2">
            <p>
              Checkpoint（<code>.ckpt</code> / <code>.safetensors</code>）放：
              <code className="bg-zinc-800 px-1.5 py-0.5 rounded">
                你的webui目錄根/models/Stable-diffusion
              </code>
            </p>
            <p>
              LoRA 放：
              <code className="bg-zinc-800 px-1.5 py-0.5 rounded">
                你的webui目錄根/models/Lora
              </code>
            </p>
            <p>
              VAE（可選）放：
              <code className="bg-zinc-800 px-1.5 py-0.5 rounded">
                你的webui目錄根/models/VAE
              </code>
            </p>
          </div>
        ),
        tags: ["模型", "LoRA", "路徑", "資料夾"],
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
         <div className="space-y-2">
           <p>現在可直接在 <b>「生成（Generate）」按鈕按右鍵</b>，選 <b>「Generate forever」</b>，就會自動連續出圖。</p>
           <ul className="list-disc pl-5 space-y-1">
             <li>想每張都不同：把種子設為 <code>-1</code> 或勾隨機。</li>
             <li>想固定構圖反覆微調：用固定種子碼（非 -1）。</li>
             <li>要控制一次多張但非無限：用 <b>Batch count / Batch size</b>。</li>
             <li>停止無限：按「停止（Stop）」或鍵盤 <b>Esc</b>。</li>
           </ul>
         </div>
        ),
        tags: ["Batch", "自動化"],
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
