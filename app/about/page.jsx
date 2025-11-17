export const metadata = {
  title: '關於本站 - AI創界',
  description: '了解AI創界的誕生故事、目標願景，以及人與AI協作的開發歷程。',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-zinc-950 -mt-2 md:-mt-16">
      {/* 頁面標題 */}
      <div className="bg-zinc-900 shadow-sm border-b border-zinc-700">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-3 sm:gap-6">
            {/* 左側：標題和描述 */}
            <div>
              <h1 className="text-3xl font-bold text-white">💫 關於 AI創界</h1>
              <p className="mt-1 text-gray-400">人與AI協作創造的世界</p>
            </div>
            
            {/* 中間：關於本站、版本資訊和法律連結（手機版隱藏） */}
            <div className="hidden md:flex items-center gap-4 text-xs text-gray-400 flex-1 justify-center flex-wrap">
              <div className="flex items-center gap-2">
                <a href="/about" className="hover:text-white transition">關於本站</a>
                <span className="text-gray-600">•</span>
                <span className="text-sm text-yellow-400">版本 v0.8.0（2025-11-05）🎉</span>
                <a href="/changelog" className="text-sm underline hover:text-white">
                  查看更新內容
                </a>
              </div>
              <div className="flex items-center gap-2">
                <a href="/privacy" className="hover:text-white transition">隱私政策</a>
                <span className="text-gray-600">•</span>
                <a href="/terms" className="hover:text-white transition">服務條款</a>
              </div>
            </div>
            
            {/* 右側：預留空間 */}
            <div className="flex-shrink-0">
              {/* 未來可以添加其他功能 */}
            </div>
          </div>
        </div>
      </div>

      {/* 主要內容 */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="prose prose-invert max-w-none">
          
          {/* 關於 AI創界 */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
              <span className="text-3xl mr-3">💫</span>
              關於 AI創界
            </h2>
            <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-700">
              <p className="text-gray-300 leading-relaxed text-lg mb-4">
                這個網站，沒有團隊、沒有投資、沒有華麗的行銷。<br/>
                它由一個人和一個 AI 一起慢慢建構出來。
              </p>
              
              <p className="text-gray-300 leading-relaxed mb-4">
                我從不懂程式、也不會設計，<br/>
                但我想做出一個地方——讓人能分享、交流、欣賞 AI 創作的世界。
              </p>
              
              <p className="text-gray-300 leading-relaxed mb-4">
                於是我開始和 AI 一起工作，<br/>
                每天一點一滴地討論、修改、修復、再重建。<br/>
                所有的頁面、按鈕、介面、功能，<br/>
                都是透過與 AI 對話誕生的結果。
              </p>
              
              <p className="text-gray-300 leading-relaxed mb-4">
                AI 幫我寫程式、修錯誤，<br/>
                我負責構思、設計、決定方向。<br/>
                這是一場「人與 AI」真正的協作實驗，<br/>
                也證明了只要有想法，即使一個人，也能創造整個世界。
              </p>
            </div>
          </div>

          {/* 我們的目標 */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
              <span className="text-3xl mr-3">🌱</span>
              我們的目標
            </h2>
            <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-700">
              <p className="text-gray-300 leading-relaxed mb-4">
                AI創界 不只是圖像的展示平台，<br/>
                更是一個讓創作者彼此啟發、累積靈感的地方。
              </p>
              
              <p className="text-gray-300 leading-relaxed mb-4">
                我們相信：
              </p>
              
              <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-600">
                <p className="text-gray-300 leading-relaxed text-center font-medium">
                  未來的創作，不再是「人 vs AI」，<br/>
                  而是「人 × AI」，<br/>
                  一起把靈感變成現實。
                </p>
              </div>
            </div>
          </div>

          {/* 開發方式 */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
              <span className="text-3xl mr-3">🛠️</span>
              開發方式
            </h2>
            <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-700">
              <ul className="text-gray-300 leading-relaxed space-y-3">
                <li className="flex items-start">
                  <span className="text-green-400 mr-2">✓</span>
                  完全由 AI 協助開發（包含程式碼、介面、設計思考）
                </li>
                <li className="flex items-start">
                  <span className="text-green-400 mr-2">✓</span>
                  由個人維護、持續更新中
                </li>
                <li className="flex items-start">
                  <span className="text-green-400 mr-2">✓</span>
                  目前仍處於測試階段，感謝所有參與者的建議與包容 ❤️
                </li>
              </ul>
            </div>
          </div>

          {/* 想支持這個網站嗎？ */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
              <span className="text-3xl mr-3">☕</span>
              想支持這個網站嗎？
            </h2>
            <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-700">
              <p className="text-gray-300 leading-relaxed mb-4">
                最簡單的方式就是——<br/>
                留下你的足跡、按個愛心、或分享一張你喜歡的作品。
              </p>
              
              <p className="text-gray-300 leading-relaxed mb-6">
                每一次互動，都是讓這個世界更接近完整的一步。
              </p>
              
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-4 text-center">
                <p className="text-white font-medium">
                  「本頁文字也是由 AI 與站長共同撰寫」😉
                </p>
              </div>
            </div>
          </div>

          {/* 行動呼籲 */}
          <div className="text-center">
            <div className="bg-zinc-900 rounded-lg p-8 border border-zinc-700">
              <h3 className="text-xl font-bold text-white mb-4">🚀 開始探索 AI創界</h3>
              <p className="text-gray-300 mb-6">發現更多精彩的 AI 創作作品</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a 
                  href="/" 
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors font-medium"
                >
                  🖼️ 瀏覽圖片作品
                </a>
                <a 
                  href="/videos" 
                  className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg transition-colors font-medium"
                >
                  🎬 觀看影片作品
                </a>
                <a 
                  href="/music" 
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition-colors font-medium"
                >
                  🎵 聆聽音樂作品
                </a>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
