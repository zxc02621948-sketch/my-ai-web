"use client";

import Link from "next/link";

const VIDEO_PLATFORMS = [
  {
    id: "sora",
    name: "SORA",
    description: "OpenAI 的文字生成影片 AI 模型，可產生高品質、逼真的動態影片。",
    pricing: "（待補）需透過 OpenAI 產品使用。",
    guidePoints: [
      "文字提示詞撰寫技巧（待補）",
      "影片長度與格式限制（待補）",
      "風格與構圖控制建議（待補）",
    ],
    links: [
      { label: "官方網站", href: "https://openai.com/sora" },
    ],
  },
  {
    id: "oiioii",
    name: "OiiOii",
    description: "AI 動畫創作平台，支援多代理角色協作，可從提示詞產生完整動畫短片。",
    pricing: "（待補）目前需邀請碼，可至官方 Discord 領取。",
    guidePoints: [
      "劇本與角色設定流程（待補）",
      "漫畫轉影片、音樂 MV 生成（待補）",
      "風格學習與參考圖上傳（待補）",
    ],
    links: [
      { label: "官方網站", href: "https://www.oiioii.ai" },
    ],
  },
  {
    id: "runway",
    name: "Runway Gen-2 / Gen-3",
    description: "（待補）影像到影像、文字到影片的指標性平台。",
    pricing: "（待補）免費額度、點數制與訂閱方案比較。",
    guidePoints: [
      "素材上傳與提示詞撰寫（待補）",
      "時間軸編輯與影片長度限制（待補）",
      "匯出格式、授權與合作範例（待補）",
    ],
    links: [
      { label: "官方網站", href: "https://runwayml.com" },
    ],
  },
  {
    id: "pika",
    name: "Pika Labs",
    description: "（待補）社群導向、快速生成的短影片工具。",
    pricing: "（待補）免費／付費方案與輸出解析度。",
    guidePoints: [
      "加入伺服器與建立專案（待補）",
      "風格與動作控制參數介紹（待補）",
      "背景音樂與字幕整合建議（待補）",
    ],
    links: [
      { label: "官方網站", href: "https://pika.art" },
    ],
  },
  {
    id: "krea",
    name: "Krea / 其他 AI 影片工具",
    description: "（待補）多平台整合、社群共享範本與開源資源整理。",
    pricing: "（待補）各平台收費方式與限制。",
    guidePoints: [
      "素材搜尋與範本管理（待補）",
      "影片合成與後製流程（待補）",
      "授權範圍與商用注意事項（待補）",
    ],
    links: [
      { label: "Krea AI", href: "https://www.krea.ai" },
    ],
  },
];

export default function VideoCreationHubPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-white/10 bg-gradient-to-r from-purple-500/20 via-fuchsia-500/10 to-blue-500/20">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-10 sm:px-10">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-purple-400/40 bg-purple-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-purple-200">
              Video Creation Hub
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white sm:text-4xl">AI 影片創作平台總覽</h1>
          <p className="max-w-3xl text-sm text-zinc-300 sm:text-base">
            匯整常見的 AI 影片生成工具與操作流程，協助你找到適合的工作流程。內容目前為雛形，後續會補齊詳細教學與比較表。
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-12 px-6 py-10 sm:px-10 sm:py-16">
        <section className="rounded-2xl border border-white/10 bg-black/30 p-6 sm:p-8 shadow-xl shadow-black/20">
          <h2 className="text-2xl font-semibold text-white">選擇影片平台之前</h2>
          <p className="mt-3 text-sm text-zinc-300 sm:text-base">
            建議從以下角度評估，細節尚待補充：
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-6 text-sm text-zinc-300 sm:text-base">
            <li>輸出品質、影片長度與解析度限制（待補）</li>
            <li>提示詞、參數控制與動態特效功能（待補）</li>
            <li>授權條款、商用限制與素材來源（待補）</li>
            <li>與影音後製、音效、字幕等流程整合（待補）</li>
          </ul>
        </section>

        <section className="space-y-8">
          {VIDEO_PLATFORMS.map((platform) => (
            <article
              key={platform.id}
              className="rounded-2xl border border-white/10 bg-zinc-900/70 p-6 sm:p-8 shadow-lg shadow-black/20"
            >
              <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-white sm:text-2xl">{platform.name}</h3>
                  <p className="text-sm text-zinc-300 sm:text-base">{platform.description}</p>
                </div>
              </header>

              <div className="mt-5 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-purple-200">指南重點</h4>
                    <ul className="mt-3 space-y-2 rounded-lg bg-black/30 p-4 text-sm text-zinc-300">
                      {platform.guidePoints.map((point, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="mt-1 text-purple-300">•</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-purple-200">定價與方案（待補）</h4>
                    <p className="mt-2 rounded-lg bg-black/30 p-4 text-sm text-zinc-300">{platform.pricing}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-purple-200">快速連結</h4>
                    <div className="mt-3 grid gap-3">
                      {platform.links.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          target="_blank"
                          className="inline-flex items-center justify-between rounded-lg border border-purple-400/30 bg-purple-500/5 px-4 py-3 text-sm font-medium text-purple-100 transition hover:bg-purple-500/20 hover:text-white"
                        >
                          <span>{link.label}</span>
                          <span aria-hidden className="text-lg">↗</span>
                        </Link>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-purple-200">備註 / 資源（待補）</h4>
                    <p className="mt-2 rounded-lg bg-black/30 p-4 text-sm text-zinc-300">
                      可補充官方文件、範例影片、後製教學與社群討論連結。
                    </p>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
