"use client";

import Link from "next/link";

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

        {/* 本地生成詳細說明 */}
        <section className="rounded-2xl border border-white/10 bg-zinc-900/70 p-6 sm:p-8 shadow-lg shadow-black/20">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-white sm:text-3xl">🎨 本地生成（Local Generation）</h2>
            <p className="mt-3 text-sm text-zinc-300 sm:text-base">
              本地生成指在自己的電腦上使用 Stable Diffusion / ComfyUI / WebUI 等工具創作 AI 圖片與影片。
            </p>
            <p className="mt-2 text-sm text-zinc-300 sm:text-base">
              所有運算都在本地執行，不依賴線上伺服器，也不受每日點數或審核限制。
            </p>
          </div>

          {/* 適合人群 */}
          <div className="mb-8">
            <h3 className="mb-4 text-xl font-semibold text-white sm:text-2xl">🔥 本地生成適合誰？</h3>
            <ul className="space-y-2 text-sm text-zinc-300 sm:text-base">
              <li className="flex items-start gap-2">
                <span className="mt-1 text-blue-400">•</span>
                <span>希望完全掌握畫面細節與風格一致的人</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 text-blue-400">•</span>
                <span>需要大量產出、不想被每日點數或排程限制的創作者</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 text-blue-400">•</span>
                <span>喜歡研究、探索、自訂工作流的玩家</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 text-blue-400">•</span>
                <span>需要 4K、8K、多階段修復或自動化大量輸出的人</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 text-blue-400">•</span>
                <span>在意隱私、不希望素材或提示詞外流的人</span>
              </li>
            </ul>
            <p className="mt-4 rounded-lg border border-blue-500/30 bg-blue-500/10 p-4 text-sm text-blue-200 sm:text-base">
              如果你想真正控制作品，而不是抽盲盒，本地生成是最佳選擇。
            </p>
          </div>

          {/* 核心優勢 */}
          <div className="mb-8">
            <h3 className="mb-4 text-xl font-semibold text-white sm:text-2xl">🏆 本地生成的核心優勢</h3>
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                <h4 className="mb-2 text-base font-semibold text-emerald-200 sm:text-lg">完整創作流程可控</h4>
                <p className="text-sm text-zinc-300 sm:text-base">
                  模型、LoRA、ControlNet、修復、Upscale、節點流程全部自己掌控。
                </p>
              </div>
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                <h4 className="mb-2 text-base font-semibold text-emerald-200 sm:text-lg">可一次大量生成、甚至一鍵無限產圖</h4>
                <p className="text-sm text-zinc-300 sm:text-base">
                  可設定 LoRA 池、自動抽卡、多批次輸出，只要電腦能撐就能自動創作大量變化版本。
                </p>
              </div>
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                <h4 className="mb-2 text-base font-semibold text-emerald-200 sm:text-lg">不受平台限制</h4>
                <p className="text-sm text-zinc-300 sm:text-base">
                  無每日點數、無排程、無審核、無題材限制。
                </p>
              </div>
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                <h4 className="mb-2 text-base font-semibold text-emerald-200 sm:text-lg">更深層的品質優化能力</h4>
                <p className="text-sm text-zinc-300 sm:text-base">
                  臉部修復、局部重繪、細節加強、4K / 8K upscale、姿勢控制等線上平台難做到。
                </p>
              </div>
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                <h4 className="mb-2 text-base font-semibold text-emerald-200 sm:text-lg">長期成本最低</h4>
                <p className="text-sm text-zinc-300 sm:text-base">
                  一次買顯卡、永久使用，不會因為作品數量花更多錢。
                </p>
              </div>
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                <h4 className="mb-2 text-base font-semibold text-emerald-200 sm:text-lg">隱私安全</h4>
                <p className="text-sm text-zinc-300 sm:text-base">
                  作品、原圖、模型與提示詞全部留在自己機器，不會外流。
                </p>
              </div>
            </div>
          </div>

          {/* 現實限制 */}
          <div className="mb-8">
            <h3 className="mb-4 text-xl font-semibold text-white sm:text-2xl">⚙️ 本地生成的現實限制</h3>
            <ul className="space-y-2 text-sm text-zinc-300 sm:text-base">
              <li className="flex items-start gap-2">
                <span className="mt-1 text-amber-400">•</span>
                <span>初次安裝與環境設定約 30～60 分鐘</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 text-amber-400">•</span>
                <span>生成速度依硬體與工作流複雜度而定</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 text-amber-400">•</span>
                <span>需要管理模型檔案與儲存空間</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 text-amber-400">•</span>
                <span>模型商用需確認授權</span>
              </li>
            </ul>
          </div>

          {/* 硬體建議表 */}
          <div className="mb-8">
            <h3 className="mb-4 text-xl font-semibold text-white sm:text-2xl">🖥 本地硬體建議表（含影片生成）</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300 sm:text-base">
                      顯卡等級
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300 sm:text-base">
                      圖片生成速度（完整流程 768～1024px）
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300 sm:text-base">
                      本地影片生成
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-300 sm:text-base">
                      建議用途
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  <tr>
                    <td className="px-4 py-4 text-sm font-medium text-zinc-200 sm:text-base">
                      RTX 3060 / 3060Ti 12GB
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-300 sm:text-base">
                      60～120 秒 / 張
                    </td>
                    <td className="px-4 py-4 text-sm text-red-300 sm:text-base">
                      ❌ 幾乎無法 / 容易糊掉或爆顯存
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-300 sm:text-base">
                      入門、純圖創作
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-4 text-sm font-medium text-zinc-200 sm:text-base">
                      RTX 3070 / 3070Ti / 4060Ti 16G
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-300 sm:text-base">
                      50～90 秒 / 張
                    </td>
                    <td className="px-4 py-4 text-sm text-amber-300 sm:text-base">
                      ⚠️ 可跑但不流暢 / 簡易短片
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-300 sm:text-base">
                      中階創作
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-4 text-sm font-medium text-zinc-200 sm:text-base">
                      RTX 4070 / 4070 Super 12GB
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-300 sm:text-base">
                      40～70 秒 / 張
                    </td>
                    <td className="px-4 py-4 text-sm text-emerald-300 sm:text-base">
                      ✅ 可順跑 8～12秒影片 (AnimateDiff / SVD)
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-300 sm:text-base">
                      推薦甜蜜點
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-4 text-sm font-medium text-zinc-200 sm:text-base">
                      RTX 4080 / 4080 Super 16GB
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-300 sm:text-base">
                      25～50 秒 / 張
                    </td>
                    <td className="px-4 py-4 text-sm text-blue-300 sm:text-base">
                      ⭐ 流暢生成影片 / 多模型修復
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-300 sm:text-base">
                      影片與大量工作流
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-4 text-sm font-medium text-zinc-200 sm:text-base">
                      RTX 4090 24GB
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-300 sm:text-base">
                      18～35 秒 / 張
                    </td>
                    <td className="px-4 py-4 text-sm text-purple-300 sm:text-base">
                      💎 最佳影片體驗、Full 控制
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-300 sm:text-base">
                      專業創作者
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-4 space-y-2 text-sm text-zinc-400 sm:text-base">
              <p>📌 短結論：從 RTX 4070 開始，才真正能順跑本地影片生成。</p>
              <p>📌 VRAM 決定能不能跑，架構決定跑得快不快。</p>
            </div>
          </div>

          {/* 總結 */}
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4 text-center">
            <h3 className="mb-2 text-lg font-semibold text-blue-200 sm:text-xl">🎯 一句話總結</h3>
            <p className="text-sm font-medium text-blue-200 sm:text-base">
              本地生成最適合想要「自由、掌控、大量創作、並追求作品品質」的創作者。
            </p>
          </div>

          {/* 教學區連結 */}
          <div className="mt-6">
            <h3 className="mb-4 text-xl font-semibold text-white sm:text-2xl">📚 相關教學</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <Link
                href="/install-guide"
                className="group relative rounded-xl border-2 border-blue-400/60 bg-gradient-to-br from-blue-500/40 via-blue-600/30 to-cyan-500/40 p-5 shadow-lg shadow-blue-500/20 transition-all hover:border-blue-400/80 hover:from-blue-500/50 hover:via-blue-600/40 hover:to-cyan-500/50 hover:shadow-xl hover:shadow-blue-500/30 hover:scale-105"
              >
                <div className="mb-3 text-3xl">📦</div>
                <h4 className="mb-2 text-lg font-bold text-white sm:text-xl">安裝教學</h4>
                <p className="text-sm text-blue-100 sm:text-base">
                  Stable Diffusion 安裝與環境設定完整教學
                </p>
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-400/0 to-cyan-400/0 group-hover:from-blue-400/10 group-hover:to-cyan-400/10 transition-opacity pointer-events-none" />
              </Link>
              <Link
                href="/qa"
                className="group relative rounded-xl border-2 border-emerald-400/60 bg-gradient-to-br from-emerald-500/40 via-green-600/30 to-teal-500/40 p-5 shadow-lg shadow-emerald-500/20 transition-all hover:border-emerald-400/80 hover:from-emerald-500/50 hover:via-green-600/40 hover:to-teal-500/50 hover:shadow-xl hover:shadow-emerald-500/30 hover:scale-105"
              >
                <div className="mb-3 text-3xl">❓</div>
                <h4 className="mb-2 text-lg font-bold text-white sm:text-xl">新手生成 Q&A</h4>
                <p className="text-sm text-emerald-100 sm:text-base">
                  常見問題解答與生成技巧教學
                </p>
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-emerald-400/0 to-teal-400/0 group-hover:from-emerald-400/10 group-hover:to-teal-400/10 transition-opacity pointer-events-none" />
              </Link>
              <Link
                href="/models"
                className="group relative rounded-xl border-2 border-purple-400/60 bg-gradient-to-br from-purple-500/40 via-pink-600/30 to-rose-500/40 p-5 shadow-lg shadow-purple-500/20 transition-all hover:border-purple-400/80 hover:from-purple-500/50 hover:via-pink-600/40 hover:to-rose-500/50 hover:shadow-xl hover:shadow-purple-500/30 hover:scale-105"
              >
                <div className="mb-3 text-3xl">🎨</div>
                <h4 className="mb-2 text-lg font-bold text-white sm:text-xl">獲取模型</h4>
                <p className="text-sm text-purple-100 sm:text-base">
                  模型與 LoRA 資源取得指南
                </p>
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-purple-400/0 to-rose-400/0 group-hover:from-purple-400/10 group-hover:to-rose-400/10 transition-opacity pointer-events-none" />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
