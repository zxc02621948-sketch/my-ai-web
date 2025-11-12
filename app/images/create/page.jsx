"use client";

import Link from "next/link";

const IMAGE_PLATFORMS = [
  {
    id: "stable-diffusion",
    name: "Stable Diffusion 生態系",
    description: "（待補）開源自架 / 雲端服務，支援 LoRA、ControlNet 等擴充。",
    pricing: "（待補）本地部署成本 vs. 雲端計算定價比較。",
    guidePoints: [
      "安裝 WebUI / Forge / ComfyUI 的流程（待補）",
      "模型與 LoRA 資源管理（待補）",
      "進階工作流與後製建議（待補）",
    ],
    links: [
      { label: "Stable Diffusion 生態系安裝教學", href: "/install-guide" },
      { label: "獲取模型指南", href: "/models" },
      { label: "新手生成 Q&A", href: "/qa" },
    ],
  },
  {
    id: "midjourney",
    name: "Midjourney",
    description: "（待補）主打 Discord 指令操作與高品質成品的付費平台。",
    pricing: "（待補）方案價格、影像輸出限制與使用授權。",
    guidePoints: [
      "加入 Discord 伺服器與訂閱流程（待補）",
      "常用提示詞與參數格式（待補）",
      "Upscale / Variation 操作重點（待補）",
    ],
    links: [
      { label: "官方網站", href: "https://www.midjourney.com" },
    ],
  },
  {
    id: "novelai",
    name: "NovelAI / 其他雲端服務",
    description: "（待補）偏向動漫風格的訂閱服務與線上生成工具整理。",
    pricing: "（待補）不同 tiers、影像尺寸與授權比較。",
    guidePoints: [
      "帳號設定與模型選擇（待補）",
      "Prompt / Negative Prompt 構造（待補）",
      "品質調校與後製建議（待補）",
    ],
    links: [
      { label: "NovelAI", href: "https://novelai.net" },
    ],
  },
];

export default function ImageCreationHubPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-white/10 bg-gradient-to-r from-emerald-500/20 via-green-500/10 to-sky-500/20">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-10 sm:px-10">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-200">
              Image Creation Hub
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white sm:text-4xl">AI 圖像創作平台總覽</h1>
          <p className="max-w-3xl text-sm text-zinc-300 sm:text-base">
            本頁提供主流 AI 圖生圖服務的特色、定價與操作流程。內容將陸續補完，先建立框架方便日後填充詳細指南。
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-12 px-6 py-10 sm:px-10 sm:py-16">
        <section className="rounded-2xl border border-white/10 bg-black/30 p-6 sm:p-8 shadow-xl shadow-black/20">
          <h2 className="text-2xl font-semibold text-white">挑選平台前的評估重點</h2>
          <p className="mt-3 text-sm text-zinc-300 sm:text-base">
            以下整理多數創作者會關注的面向，實際內容待補充：
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-6 text-sm text-zinc-300 sm:text-base">
            <li>產出風格、品質與可重現性（待補）</li>
            <li>提示詞設計、參數調整與進階功能（待補）</li>
            <li>版權授權、商用條款與社群規範（待補）</li>
            <li>後製工作流與其他工具整合（待補）</li>
          </ul>
        </section>

        <section className="space-y-8">
          {IMAGE_PLATFORMS.map((platform) => (
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
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-emerald-200">指南重點</h4>
                    <ul className="mt-3 space-y-2 rounded-lg bg-black/30 p-4 text-sm text-zinc-300">
                      {platform.guidePoints.map((point, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="mt-1 text-emerald-300">•</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-emerald-200">定價與方案（待補）</h4>
                    <p className="mt-2 rounded-lg bg-black/30 p-4 text-sm text-zinc-300">{platform.pricing}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-emerald-200">快速連結</h4>
                    <div className="mt-3 grid gap-3">
                      {platform.links.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          target={link.href.startsWith("http") ? "_blank" : undefined}
                          className="inline-flex items-center justify-between rounded-lg border border-emerald-400/30 bg-emerald-500/5 px-4 py-3 text-sm font-medium text-emerald-100 transition hover:bg-emerald-500/20 hover:text-white"
                        >
                          <span>{link.label}</span>
                          <span aria-hidden className="text-lg">↗</span>
                        </Link>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-emerald-200">備註 / 資源（待補）</h4>
                    <p className="mt-2 rounded-lg bg-black/30 p-4 text-sm text-zinc-300">
                      可補充官方教學、社群範例、模型下載站等連結。
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
