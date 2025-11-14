"use client";

import Link from "next/link";

const IMAGE_PLATFORMS = [
  {
    id: "stable-diffusion",
    name: "Stable Diffusion 生態系",
    description: "開源自架 / 雲端服務，支援 LoRA、ControlNet 等擴充。",
    infoTitle: "優點與缺點",
    pricing: {
      pros: [
        "完全掌控模型與擴充，工作流可依需求高度客製",
        "可離線運行並保留資料主權，不受平台規範限制",
        "除了硬體、電力或雲端資源外，生成本身不需額外費用",
      ],
      cons: [
        "需要自備 GPU 或支付雲端運算費用",
        "環境部署與更新維護門檻較高",
      ],
    },
    rating: 5,
    learningDifficulty: 4,
    guidePoints: [
      "安裝 WebUI / Forge / ComfyUI 的流程",
      "模型與 LoRA 資源管理",
      "進階工作流與後製建議",
    ],
    links: [
      { label: "Stable Diffusion 生態系安裝教學", href: "/install-guide" },
      { label: "獲取模型指南", href: "/models" },
      { label: "新手生成 Q&A", href: "/qa" },
    ],
  },
];

const renderStars = (value, activeClass, inactiveClass) =>
  Array.from({ length: 5 }, (_, idx) => (
    <span key={idx} className={idx < value ? activeClass : inactiveClass}>
      ★
    </span>
  ));

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
            以下整理多數創作者會關注的面向：
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-6 text-sm text-zinc-300 sm:text-base">
            <li>產出風格、品質與可重現性</li>
            <li>提示詞設計、參數調整與進階功能</li>
            <li>版權授權、商用條款與社群規範</li>
            <li>後製工作流與其他工具整合</li>
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
                {(typeof platform.rating === "number" ||
                  typeof platform.learningDifficulty === "number") && (
                  <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-3">
                    {typeof platform.learningDifficulty === "number" && (
                      <div className="inline-flex items-center gap-3 rounded-full border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-100">
                        <span className="uppercase tracking-wide text-amber-200">
                          學習難度
                        </span>
                        <span
                          aria-label={`學習難度 ${platform.learningDifficulty} / 5`}
                          className="text-lg"
                        >
                          {renderStars(
                            platform.learningDifficulty,
                            "text-amber-300",
                            "text-amber-900",
                          )}
                        </span>
                      </div>
                    )}
                    {typeof platform.rating === "number" && (
                      <div className="inline-flex items-center gap-3 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100">
                        <span className="uppercase tracking-wide text-emerald-200">
                          推薦指數
                        </span>
                        <span
                          aria-label={`推薦指數 ${platform.rating} / 5`}
                          className="text-lg"
                        >
                          {renderStars(platform.rating, "text-emerald-300", "text-emerald-800")}
                        </span>
                      </div>
                    )}
                  </div>
                )}
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
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-emerald-200">
                      {platform.infoTitle ?? "定價與方案"}
                    </h4>
                    {Array.isArray(platform.pricing?.pros) ? (
                      <div className="mt-2 space-y-3 rounded-lg bg-black/30 p-4 text-sm text-zinc-300">
                        <div>
                          <p className="font-semibold text-emerald-200">優點</p>
                          <ul className="mt-2 list-disc space-y-1 pl-5">
                            {platform.pricing.pros.map((item, idx) => (
                              <li key={`pros-${platform.id}-${idx}`}>{item}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="font-semibold text-rose-200">缺點</p>
                          <ul className="mt-2 list-disc space-y-1 pl-5">
                            {platform.pricing.cons?.map((item, idx) => (
                              <li key={`cons-${platform.id}-${idx}`}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 rounded-lg bg-black/30 p-4 text-sm text-zinc-300">
                        {platform.pricing}
                      </p>
                    )}
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
                      此生態擁有豐富教學懶人包與多語系社群資源，從入門到進階皆有對應學習路線與應用範例。
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
