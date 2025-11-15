"use client";

import Link from "next/link";

const MUSIC_PLATFORMS = [
  {
    id: "suno",
    name: "🚀 推薦 AI 音樂創作平台：Suno AI",
    description: "目前歌曲品質、樂器層次、完整性與可編輯能力最強的平台之一。支援完整歌曲創作，並提供專業工作流程等級的進階工具。",
    features: {
      title: "✨ Suno 功能亮點",
      items: [
        "生成完整歌曲（Verse / Chorus / Bridge）",
        "自然人聲、多種歌手聲線可選",
        "可用多種語言自然演唱（中文 / 英文 / 日文 / 韓文 / 台語）",
        "多樂器層次與高品質混音",
        "可延長歌曲、替換段落、續寫與細節修正",
        "內建線上編輯器",
        "可分離人聲、可分軌分離所有樂器",
        "可單獨下載各樂器音軌，支援混音與二次製作",
        "支援下載 MP3 / WAV / MV 音訊視覺化影片",
        "支援分享、重製與多版本對比",
      ],
    },
    formats: {
      title: "🎧 下載格式與輸出能力",
      items: [
        { name: "MP3", supported: true },
        { name: "WAV", supported: true },
        { name: "MV 視覺化影片輸出", supported: true },
        { name: "分軌下載（Drums / Bass / Guitar / Vocal / etc）", supported: true },
        { name: "單獨人聲 / 伴奏", supported: true },
        { name: "STEM 多軌混音", supported: true },
      ],
    },
    recommendations: {
      title: "🥁 功能推薦給誰？",
      items: [
        { user: "想快速完成完整歌曲", reason: "生成快速、可修正、可續寫" },
        { user: "影片配樂製作者", reason: "可下載無人聲版、可依畫面延長" },
        { user: "Vtuber / 實況主 / 配音者", reason: "可自製主題曲與背景音樂" },
        { user: "音樂製作人", reason: "可分軌混音、可做二次創作" },
      ],
    },
    pricing: {
      title: "💰 訂閱成本與產能",
      items: [
        { plan: "月訂閱", price: "約 10 美金 / 月", capacity: "約 500 首歌曲份額（含完整版續寫能力）" },
        { plan: "免費方案", price: "提供少量測試", capacity: "生成次數與功能受限" },
      ],
    },
    links: [
      { label: "🔗 前往 Suno AI 創作", href: "https://suno.ai" },
    ],
    cta: {
      title: "🎶 立即開始 AI 音樂創作",
      description: "點擊前往 Suno AI，開始你的第一首 AI 歌曲👇",
    },
  },
  {
    id: "topmediai",
    name: "🎬 TopMediaAI｜音樂 × 動態視覺影片一鍵生成",
    description: "TopMediaAI 是一款中文 AI 音樂與影片生成平台，能創作具旋律與人聲演唱的歌曲，同時可以搭配動態視覺影片、AI 對嘴動畫與翻唱效果。相比 Suno，它更適合影音創作者與短影音內容製作者，而不是純音樂後製工程。",
    features: {
      title: "✨ 主要特色",
      items: [
        "AI 歌曲生成（含人聲演唱）：旋律、人聲以及伴奏都有一定水準，效果穩定",
        "上傳照片 AI 對嘴唱歌：能讓角色 / Vtuber / 真人照片跟著歌詞自動對嘴",
        "AI 翻唱功能：可將歌曲轉換為不同聲線重新演唱",
        "音樂 × 動態視覺影片：一鍵輸出 MP4 動態背景視覺，節奏自動同步",
        "中文平台、中文介面：上手快、操作流程清楚，適合亞洲使用者",
        "多用途工具整合：翻唱、影片、文字轉語音（計費分開，不共用點數）",
      ],
    },
    pricing: {
      title: "💰 方案與生成成本",
      items: [
        { plan: "音樂創作月方案", price: "NT$299", capacity: "500 點，每次生成兩首歌（1.5點/首 → 共3點/次），約可生成 160～170 次歌曲組合" },
      ],
      notes: [
        "音樂方案的點數無法用於文字轉語音、影片製作、AI模擬人聲等其他服務",
        "下載 MP3 時不會內嵌封面，需自行後製加入",
      ],
    },
    comparison: {
      title: "🔥 TopMediaAI vs Suno 比較表",
      items: [
        { item: "核心定位", suno: "完整歌曲創作、專業人聲與分軌混音", topmediai: "影音整合創作：歌曲 + 動態影片" },
        { item: "音樂品質", suno: "商業級、自然語言演唱、混音強", topmediai: "音樂與人聲水準良好，但細緻度略低於 Suno" },
        { item: "語言能力", suno: "中文 / 日文 / 英文 / 台語 / 韓文佳", topmediai: "中文友好、其他語言效果因風格而異" },
        { item: "周邊能力", suno: "延長、替換、分軌、MV 影片", topmediai: "AI 對嘴、AI 翻唱、動態影片" },
        { item: "影片視覺", suno: "基礎 MV 輸出", topmediai: "強項：多種視覺模板、節奏動畫" },
        { item: "介面", suno: "英文", topmediai: "全中文" },
        { item: "成本", suno: "約 10美 / 500首", topmediai: "299 TWD / 約 160+ 組" },
        { item: "檔案輸出", suno: "MP3 / WAV / 分軌 / MV", topmediai: "MP3 / MP4（無內嵌封面）" },
        { item: "適合用戶", suno: "音樂創作者、配樂者", topmediai: "短影音剪輯者、Vtuber、YouTuber" },
      ],
    },
    recommendations: {
      title: "👍 適合哪些人？",
      items: [
        { user: "做角色主題曲 / 高品質歌曲", reason: "推薦 Suno" },
        { user: "做可直接發布的音樂 + 視覺影片", reason: "推薦 TopMediaAI" },
        { user: "中文介面 / 無音樂背景也能使用", reason: "推薦 TopMediaAI" },
        { user: "AI 翻唱、AI 對嘴表演影片", reason: "推薦 TopMediaAI" },
      ],
    },
    warnings: {
      title: "⚠ 注意事項",
      items: [
        "音樂方案點數不能用於其他工具",
        "MP3 不內嵌封面",
        "若追求極致後製與混音細節，需透過其他 DAW 完成",
      ],
    },
    conclusion: {
      title: "🟣 小結論",
      items: [
        "✨ TopMediaAI = 最快完成可直接上傳 Shorts / Reels / TikTok 的音樂 + 動態視覺影片解決方案",
        "🎵 Suno = 創作真正具表現力、可成為作品核心的完整歌曲",
      ],
    },
    links: [
      { label: "前往 TopMediaAI 創作影片音樂", href: "https://topmediaai.com" },
    ],
    cta: {
      title: "🎬 立即開始 AI 音樂與影片創作",
      description: "點擊前往 TopMediaAI，開始你的第一首 AI 音樂 + 動態視覺影片👇",
    },
  },
];

export default function MusicCreationHubPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-white/10 bg-gradient-to-r from-orange-500/20 via-amber-500/10 to-red-500/20">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-10 sm:px-10">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-orange-400/40 bg-orange-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-orange-200">
              Music Creation Hub
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white sm:text-4xl">
            AI 音樂創作平台總覽
          </h1>
          <p className="max-w-3xl text-sm text-zinc-300 sm:text-base">
            這裡整理了常見的 AI 音樂生成平台，包含特色、定價、操作流程與授權注意事項。
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10 sm:px-10 sm:py-16 space-y-12">
        <section className="rounded-2xl border border-white/10 bg-black/30 p-6 sm:p-8 shadow-xl shadow-black/20">
          <h2 className="text-2xl font-semibold text-white mb-6">🎵 AI 音樂創作說明</h2>
          
          <div className="space-y-4 text-sm text-zinc-300 sm:text-base">
            <p>
              目前 AI 音樂無法像 AI 圖片 / 影片一樣在本地生成。
            </p>
            
            <p className="font-medium text-white">原因是：</p>
            
            <ul className="space-y-2 pl-6 list-disc">
              <li>音樂模型的製作難度極高（需要旋律、和弦、節奏、人聲、混音、多階段結構）</li>
              <li>版權限制複雜（涉及唱片、作曲、編曲、人聲授權等）</li>
              <li>沒有成熟的開放模型社群（不像 Stable Diffusion 那樣能下載並本地運行）</li>
            </ul>
            
            <p className="pt-2">
              因此目前全球的 AI 音樂創作都必須依靠雲端平台。
            </p>
          </div>
        </section>

        <section className="space-y-8">
          {MUSIC_PLATFORMS.map((platform) => {
            // Suno AI 特殊渲染
            if (platform.id === "suno" || platform.id === "topmediai") {
              return (
                <article
                  key={platform.id}
                  className="rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900/90 via-zinc-900/70 to-black/50 p-8 sm:p-10 shadow-xl shadow-black/40"
                >
                  <header className="mb-8">
                    <h3 className="text-3xl font-bold text-white sm:text-4xl mb-4">
                      {platform.name}
                    </h3>
                    <p className="text-base text-zinc-200 sm:text-lg leading-relaxed max-w-4xl">
                      {platform.description}
                    </p>
                  </header>

                  <div className="space-y-8">
                    {/* 第一層：兩欄布局（功能亮點 + 價格） */}
                    <div className="grid gap-8 lg:grid-cols-2">
                      {/* 左側：功能亮點 */}
                      <div className="space-y-8">
                        {/* 功能亮點 */}
                        {platform.features && (
                          <div className="rounded-xl border border-orange-400/20 bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-transparent p-6">
                            <h4 className="text-xl font-bold text-orange-200 mb-5 flex items-center gap-2">
                              <span className="text-2xl">{platform.features.title.split(" ")[0]}</span>
                              <span>{platform.features.title.split(" ").slice(1).join(" ")}</span>
                            </h4>
                            <ul className="space-y-3 text-sm text-zinc-200 sm:text-base">
                              {platform.features.items.map((item, index) => (
                                <li key={index} className="flex items-start gap-3">
                                  <span className="mt-1.5 text-orange-400 text-lg shrink-0">•</span>
                                  <span className="leading-relaxed">{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* 右側：格式或價格 */}
                      <div className="space-y-8">
                        {/* 下載格式與輸出能力（僅在沒有價格時顯示在右側，Suno AI 會移到全寬） */}
                        {platform.formats && !platform.pricing && (
                          <div className="rounded-xl border border-blue-400/20 bg-gradient-to-br from-blue-500/10 via-cyan-500/5 to-transparent p-6">
                            <h4 className="text-xl font-bold text-blue-200 mb-5 flex items-center gap-2">
                              <span className="text-2xl">{platform.formats.title.split(" ")[0]}</span>
                              <span>{platform.formats.title.split(" ").slice(1).join(" ")}</span>
                            </h4>
                            <div className="overflow-x-auto">
                              <table className="w-full border-collapse text-sm sm:text-base">
                                <thead>
                                  <tr className="border-b border-blue-400/30">
                                    <th className="text-left py-3 px-4 font-semibold text-white bg-blue-500/20">內容</th>
                                    <th className="text-center py-3 px-4 font-semibold text-white bg-blue-500/20">支援</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {platform.formats.items.map((item, index) => (
                                    <tr key={index} className="border-b border-white/5 hover:bg-blue-500/10 transition-colors">
                                      <td className="py-3 px-4 text-zinc-200">{item.name}</td>
                                      <td className="py-3 px-4 text-center">
                                        {item.supported ? (
                                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-sm">✔</span>
                                        ) : (
                                          <span className="text-zinc-500">✗</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* 訂閱成本與產能 */}
                        {platform.pricing && (
                          <div className="rounded-xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent p-6">
                            <h4 className="text-xl font-bold text-emerald-200 mb-5 flex items-center gap-2">
                              <span className="text-2xl">{platform.pricing.title.split(" ")[0]}</span>
                              <span>{platform.pricing.title.split(" ").slice(1).join(" ")}</span>
                            </h4>
                            <div className="overflow-x-auto">
                              <table className="w-full border-collapse text-sm sm:text-base">
                                <thead>
                                  <tr className="border-b border-emerald-400/30">
                                    <th className="text-left py-3 px-4 font-semibold text-white bg-emerald-500/20">方案</th>
                                    <th className="text-left py-3 px-4 font-semibold text-white bg-emerald-500/20">大約價格</th>
                                    <th className="text-left py-3 px-4 font-semibold text-white bg-emerald-500/20">可創作數量</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {platform.pricing.items.map((item, index) => (
                                    <tr key={index} className="border-b border-white/5 hover:bg-emerald-500/10 transition-colors">
                                      <td className="py-3 px-4 text-zinc-200 font-medium">{item.plan}</td>
                                      <td className="py-3 px-4 text-zinc-300">{item.price}</td>
                                      <td className="py-3 px-4 text-zinc-300">{item.capacity}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            {/* ✅ 價格注意事項 */}
                            {platform.pricing.notes && platform.pricing.notes.length > 0 && (
                              <div className="mt-4 pt-4 border-t border-emerald-400/20">
                                <p className="text-xs font-semibold text-emerald-300 mb-2">📌 注意：</p>
                                <ul className="space-y-1 text-xs text-zinc-300">
                                  {platform.pricing.notes.map((note, index) => (
                                    <li key={index} className="flex items-start gap-2">
                                      <span className="mt-1 text-emerald-400">•</span>
                                      <span>{note}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 第二層：下載格式與輸出能力（Suno AI 專用，全寬） */}
                    {platform.id === "suno" && platform.formats && (
                      <div className="rounded-xl border border-blue-400/20 bg-gradient-to-br from-blue-500/10 via-cyan-500/5 to-transparent p-6">
                        <h4 className="text-xl font-bold text-blue-200 mb-5 flex items-center gap-2">
                          <span className="text-2xl">{platform.formats.title.split(" ")[0]}</span>
                          <span>{platform.formats.title.split(" ").slice(1).join(" ")}</span>
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse text-sm sm:text-base">
                            <thead>
                              <tr className="border-b border-blue-400/30">
                                <th className="text-left py-3 px-4 font-semibold text-white bg-blue-500/20">內容</th>
                                <th className="text-center py-3 px-4 font-semibold text-white bg-blue-500/20">支援</th>
                              </tr>
                            </thead>
                            <tbody>
                              {platform.formats.items.map((item, index) => (
                                <tr key={index} className="border-b border-white/5 hover:bg-blue-500/10 transition-colors">
                                  <td className="py-3 px-4 text-zinc-200">{item.name}</td>
                                  <td className="py-3 px-4 text-center">
                                    {item.supported ? (
                                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-sm">✔</span>
                                    ) : (
                                      <span className="text-zinc-500">✗</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* 第三層：功能推薦給誰（全寬） */}
                    {platform.recommendations && (
                      <div className="rounded-xl border border-purple-400/20 bg-gradient-to-br from-purple-500/10 via-pink-500/5 to-transparent p-6">
                        <h4 className="text-xl font-bold text-purple-200 mb-5 flex items-center gap-2">
                          <span className="text-2xl">{platform.recommendations.title.split(" ")[0]}</span>
                          <span>{platform.recommendations.title.split(" ").slice(1).join(" ")}</span>
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse text-sm sm:text-base">
                            <thead>
                              <tr className="border-b border-purple-400/30">
                                <th className="text-left py-3 px-4 font-semibold text-white bg-purple-500/20">使用者類型</th>
                                <th className="text-left py-3 px-4 font-semibold text-white bg-purple-500/20">適合原因</th>
                              </tr>
                            </thead>
                            <tbody>
                              {platform.recommendations.items.map((item, index) => (
                                <tr key={index} className="border-b border-white/5 hover:bg-purple-500/10 transition-colors">
                                  <td className="py-3 px-4 text-zinc-200 font-medium">{item.user}</td>
                                  <td className="py-3 px-4 text-zinc-300">{item.reason}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* ✅ Suno AI 專用：CTA */}
                    {platform.id === "suno" && platform.cta && (
                      <div className="rounded-xl border-2 border-orange-400/40 bg-gradient-to-r from-orange-500/20 via-amber-500/15 to-red-500/20 p-6 shadow-lg shadow-orange-500/20">
                        <h4 className="text-xl font-bold text-orange-200 mb-3 flex items-center gap-2">
                          <span>{platform.cta.title.split(" ")[0]}</span>
                          <span className="text-base">{platform.cta.title.split(" ").slice(1).join(" ")}</span>
                        </h4>
                        <p className="text-sm text-zinc-200 mb-4">
                          {platform.cta.description}
                        </p>
                        {platform.links && platform.links.length > 0 && (
                          <div className="flex gap-3 flex-wrap">
                            {platform.links.map((link) => (
                              <Link
                                key={link.href}
                                href={link.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 rounded-xl border-2 border-orange-400/70 bg-gradient-to-r from-orange-500/50 via-amber-500/40 to-red-500/50 px-6 py-3 text-base font-bold text-white shadow-xl shadow-orange-500/30 transition-all hover:border-orange-400 hover:from-orange-500/60 hover:via-amber-500/50 hover:to-red-500/60 hover:shadow-2xl hover:shadow-orange-500/40 hover:scale-105 active:scale-100"
                              >
                                <span>{link.label}</span>
                                <span className="text-lg">→</span>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ✅ TopMediaAI 專用：全寬區塊（比較表、注意事項、結論、CTA） */}
                  {platform.comparison && (
                    <div className="mt-8 space-y-6">
                      {/* TopMediaAI vs Suno 比較表 */}
                      <div className="rounded-xl border border-yellow-400/20 bg-gradient-to-br from-yellow-500/10 via-amber-500/5 to-transparent p-6">
                        <h4 className="text-xl font-bold text-yellow-200 mb-5 flex items-center gap-2">
                          <span className="text-2xl">{platform.comparison.title.split(" ")[0]}</span>
                          <span>{platform.comparison.title.split(" ").slice(1).join(" ")}</span>
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse text-sm sm:text-base">
                            <thead>
                              <tr className="border-b border-yellow-400/30">
                                <th className="text-left py-3 px-4 font-semibold text-white bg-yellow-500/20">項目</th>
                                <th className="text-left py-3 px-4 font-semibold text-white bg-yellow-500/20">Suno</th>
                                <th className="text-left py-3 px-4 font-semibold text-white bg-yellow-500/20">TopMediaAI</th>
                              </tr>
                            </thead>
                            <tbody>
                              {platform.comparison.items.map((item, index) => (
                                <tr key={index} className="border-b border-white/5 hover:bg-yellow-500/10 transition-colors">
                                  <td className="py-3 px-4 text-zinc-200 font-medium">{item.item}</td>
                                  <td className="py-3 px-4 text-zinc-300">{item.suno}</td>
                                  <td className="py-3 px-4 text-zinc-300">{item.topmediai}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* 注意事項 */}
                      {platform.warnings && (
                        <div className="rounded-xl border border-red-400/20 bg-gradient-to-br from-red-500/10 via-orange-500/5 to-transparent p-6">
                          <h4 className="text-xl font-bold text-red-200 mb-4 flex items-center gap-2">
                            <span className="text-2xl">{platform.warnings.title.split(" ")[0]}</span>
                            <span>{platform.warnings.title.split(" ").slice(1).join(" ")}</span>
                          </h4>
                          <ul className="space-y-2 text-sm text-zinc-200 sm:text-base">
                            {platform.warnings.items.map((item, index) => (
                              <li key={index} className="flex items-start gap-2">
                                <span className="mt-1.5 text-red-400 text-lg shrink-0">•</span>
                                <span className="leading-relaxed">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* 小結論 */}
                      {platform.conclusion && (
                        <div className="rounded-xl border border-purple-400/20 bg-gradient-to-br from-purple-500/10 via-pink-500/5 to-transparent p-6">
                          <h4 className="text-xl font-bold text-purple-200 mb-4 flex items-center gap-2">
                            <span className="text-2xl">{platform.conclusion.title.split(" ")[0]}</span>
                            <span>{platform.conclusion.title.split(" ").slice(1).join(" ")}</span>
                          </h4>
                          <ul className="space-y-2 text-sm text-zinc-200 sm:text-base">
                            {platform.conclusion.items.map((item, index) => (
                              <li key={index} className="flex items-start gap-2">
                                <span className="mt-1.5 text-purple-400 text-lg shrink-0">•</span>
                                <span className="leading-relaxed">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* CTA */}
                      {platform.cta && (
                        <div className="rounded-xl border-2 border-orange-400/40 bg-gradient-to-r from-orange-500/20 via-amber-500/15 to-red-500/20 p-6 shadow-lg shadow-orange-500/20">
                          <h4 className="text-xl font-bold text-orange-200 mb-3 flex items-center gap-2">
                            <span>{platform.cta.title.split(" ")[0]}</span>
                            <span className="text-base">{platform.cta.title.split(" ").slice(1).join(" ")}</span>
                          </h4>
                          <p className="text-sm text-zinc-200 mb-4">
                            {platform.cta.description}
                          </p>
                          {platform.links && platform.links.length > 0 && (
                            <div className="flex gap-3 flex-wrap">
                              {platform.links.map((link) => (
                                <Link
                                  key={link.href}
                                  href={link.href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 rounded-xl border-2 border-orange-400/70 bg-gradient-to-r from-orange-500/50 via-amber-500/40 to-red-500/50 px-6 py-3 text-base font-bold text-white shadow-xl shadow-orange-500/30 transition-all hover:border-orange-400 hover:from-orange-500/60 hover:via-amber-500/50 hover:to-red-500/60 hover:shadow-2xl hover:shadow-orange-500/40 hover:scale-105 active:scale-100"
                                >
                                  <span>{link.label}</span>
                                  <span className="text-lg">→</span>
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            }

            // 其他平台保持原有渲染
            return (
              <article
                key={platform.id}
                className="rounded-2xl border border-white/10 bg-zinc-900/70 p-6 sm:p-8 shadow-lg shadow-black/20"
              >
                <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-white sm:text-2xl">
                      {platform.name}
                    </h3>
                    <p className="text-sm text-zinc-300 sm:text-base">
                      {platform.description}
                    </p>
                  </div>
                </header>

                <div className="mt-5 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold uppercase tracking-wide text-orange-200">
                        使用指南重點
                      </h4>
                      <ul className="mt-3 space-y-2 rounded-lg bg-black/30 p-4 text-sm text-zinc-300">
                        {platform.guidePoints?.map((point, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="mt-1 text-orange-300">•</span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {platform.pricing && (
                      <div>
                        <h4 className="text-sm font-semibold uppercase tracking-wide text-orange-200">
                          定價與方案（待補）
                        </h4>
                        <p className="mt-2 rounded-lg bg-black/30 p-4 text-sm text-zinc-300">
                          {platform.pricing}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    {platform.links && platform.links.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold uppercase tracking-wide text-orange-200">
                          快速連結
                        </h4>
                        <div className="mt-3 grid gap-3">
                          {platform.links.map((link) => (
                            <Link
                              key={link.href}
                              href={link.href}
                              target="_blank"
                              className="inline-flex items-center justify-between rounded-lg border border-orange-400/30 bg-orange-500/5 px-4 py-3 text-sm font-medium text-orange-100 transition hover:bg-orange-500/20 hover:text-white"
                            >
                              <span>{link.label}</span>
                              <span aria-hidden className="text-lg">↗</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <h4 className="text-sm font-semibold uppercase tracking-wide text-orange-200">
                        備註 / 資源（待補）
                      </h4>
                      <p className="mt-2 rounded-lg bg-black/30 p-4 text-sm text-zinc-300">
                        可補充社群討論區、教學影片或官方文件等參考資訊。
                      </p>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </main>
    </div>
  );
}
