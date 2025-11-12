"use client";

import Link from "next/link";

const MUSIC_PLATFORMS = [
  {
    id: "suno",
    name: "Suno.ai",
    description: "（待補）主打歌詞驅動的 AI 音樂平台。",
    pricing: "（待補）定價與免費額度說明",
    guidePoints: [
      "如何建立帳號與初次設定（待補）",
      "生成歌曲的步驟流程（待補）",
      "匯出與授權須知（待補）",
    ],
    links: [
      { label: "官方網站", href: "https://suno.ai" },
    ],
  },
  {
    id: "udio",
    name: "Udio",
    description: "（待補）以速度與風格多樣化著稱的 AI 音樂生成工具。",
    pricing: "（待補）免費額度與付費方案比較",
    guidePoints: [
      "平台特色與適用場景（待補）",
      "如何設定歌曲結構與風格（待補）",
      "下載檔案與版權注意事項（待補）",
    ],
    links: [
      { label: "官方網站", href: "https://www.udio.com" },
    ],
  },
  {
    id: "riffusion",
    name: "Riffusion / 其他工具",
    description: "（待補）可視化音樂生成、開源社群方案整理。",
    pricing: "（待補）免費 / 付費資源整理",
    guidePoints: [
      "安裝與環境需求（待補）",
      "提示詞撰寫建議（待補）",
      "音檔後製流程建議（待補）",
    ],
    links: [
      { label: "Riffusion GitHub", href: "https://github.com/riffusion/riffusion" },
    ],
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
            首次建置以架構為主，細節內容將逐步補完，歡迎先行閱讀並提供回饋。
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10 sm:px-10 sm:py-16 space-y-12">
        <section className="rounded-2xl border border-white/10 bg-black/30 p-6 sm:p-8 shadow-xl shadow-black/20">
          <h2 className="text-2xl font-semibold text-white">如何挑選適合的平台？</h2>
          <p className="mt-3 text-sm text-zinc-300 sm:text-base">
            建議依照創作目的、授權需求、預算與輸出格式等面向來評估。以下為待補充的指引重點：
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-6 text-sm text-zinc-300 sm:text-base">
            <li>作品用途（商業 / 非商業）、授權與著作權規範（待補）</li>
            <li>平台產出品質、速度與可控性比較（待補）</li>
            <li>支援的語言、歌詞輸入與合作功能（待補）</li>
            <li>匯出格式、後製流程與與本地工作流程整合（待補）</li>
          </ul>
        </section>

        <section className="space-y-8">
          {MUSIC_PLATFORMS.map((platform) => (
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
                      {platform.guidePoints.map((point, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="mt-1 text-orange-300">•</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-orange-200">
                      定價與方案（待補）
                    </h4>
                    <p className="mt-2 rounded-lg bg-black/30 p-4 text-sm text-zinc-300">
                      {platform.pricing}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
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
          ))}
        </section>
      </main>
    </div>
  );
}
