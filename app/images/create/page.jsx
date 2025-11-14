"use client";

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
          <h1 className="text-3xl font-bold text-white sm:text-4xl">AI 圖像創作選擇說明</h1>
          <p className="max-w-3xl text-sm text-zinc-300 sm:text-base">
            本頁提供主流 AI 圖生圖服務的特色、定價與操作流程。內容將陸續補完，先建立框架方便日後填充詳細指南。
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10 sm:px-10 sm:py-16">
        {/* 對比說明 */}
        <section className="rounded-2xl border border-white/10 bg-zinc-900/70 p-6 sm:p-8 shadow-lg shadow-black/20">
          <h2 className="mb-6 text-xl font-semibold text-white sm:text-2xl">平台對比</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300 sm:text-base">
                    特點
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-emerald-300 sm:text-base">
                    SeaArt（雲端生成）
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-blue-300 sm:text-base">
                    本地生成（Stable Diffusion / ComfyUI）
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                <tr>
                  <td className="px-4 py-4 text-sm font-medium text-zinc-200 sm:text-base">
                    開始門檻
                  </td>
                  <td className="px-4 py-4 text-sm text-zinc-300 sm:text-base">
                    最快開始，無需硬體
                  </td>
                  <td className="px-4 py-4 text-sm text-zinc-300 sm:text-base">
                    完全自由，無限制大量生成
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-4 text-sm font-medium text-zinc-200 sm:text-base">
                    成本考量
                  </td>
                  <td className="px-4 py-4 text-sm text-zinc-300 sm:text-base">
                    花少量訂閱費省時間
                  </td>
                  <td className="px-4 py-4 text-sm text-zinc-300 sm:text-base">
                    花時間省錢（已有顯卡即免費）
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-4 text-sm font-medium text-zinc-200 sm:text-base">
                    操作與功能
                  </td>
                  <td className="px-4 py-4 text-sm text-zinc-300 sm:text-base">
                    自動優化 & 超簡單操作
                  </td>
                  <td className="px-4 py-4 text-sm text-zinc-300 sm:text-base">
                    可自訂模型 / 抽卡池 / 深度工作流
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-4 text-sm font-medium text-zinc-200 sm:text-base">
                    內容限制
                  </td>
                  <td className="px-4 py-4 text-sm text-zinc-300 sm:text-base">
                    支援18+（平台內僅自用，可下載外部分享）
                  </td>
                  <td className="px-4 py-4 text-sm text-zinc-300 sm:text-base">
                    18+ 不受限制，自由分享與分類
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
            <p className="text-sm font-medium text-emerald-200 sm:text-base">
              沒有最好，只有最適合你。
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
