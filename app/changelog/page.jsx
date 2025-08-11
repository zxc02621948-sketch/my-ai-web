// app/changelog/page.jsx
import Link from "next/link";

export default function ChangelogPage() {
  return (
    <div className="relative min-h-screen bg-black text-white">
      {/* 回首頁按鈕固定左上角 */}
      <Link
        href="/"
        className="absolute top-0 left-0 m-2 px-3 py-1 bg-white text-black rounded hover:bg-gray-100 font-semibold z-50"
      >
        ← 回首頁
      </Link>

      {/* 內容區 */}
      <div className="max-w-2xl mx-auto py-10 px-4">
        <h1 className="text-2xl font-bold mb-6">📝 更新日誌</h1>

      {/* v0.7.6 - 新增 */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">v0.7.6（2025-08-11）</h2>
        <ul className="list-disc list-inside space-y-1 text-gray-300">
          <li>✏️ 可編輯已上傳內容</li>
          <li>🎨 UI 按鈕優化</li>
          <li>❓ 新增新手生成 Q&amp;A</li>
          <li>📱 手機版本上線</li>
          <li>🖼️ 上傳圖片自動抓取提詞</li>
          <li>⚙️ 圖片新增生成參數</li>
        </ul>
      </div>

      {/* 下面是舊版本的更新日誌，保留不動 */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">v0.7.51（2025-08-01）</h2>
        <ul className="list-disc list-inside space-y-1 text-gray-300">
          <li>🐛 修復部分圖片無法正常顯示的問題</li>
          <li>⚡ 提升頁面載入速度</li>
        </ul>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">v0.7.41（2025-07-20）</h2>
        <ul className="list-disc list-inside space-y-1 text-gray-300">
          <li>🆕 新增標籤篩選功能</li>
          <li>🎯 優化搜尋結果排序</li>
        </ul>
      </div>

        {/* v0.7.5 - 新增 */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-2">v0.7.5（2025-08-07）</h2>
          <ul className="list-disc list-inside space-y-1 text-gray-300">
            <li>🐞 多項視覺錯誤與結構異常修正，提升穩定性</li>
            <li>📝 可自訂已追蹤名單的備註說明</li>
            <li>🏷️ 點擊大圖的標籤可自動索引並搜尋相關圖片</li>
          </ul>
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-2">v0.7.4（2025-08-04）</h2>
          <ul className="list-disc list-inside space-y-1 text-gray-300">
            <li>📊 「👁️ 人數」改用 visitId 統計，避免浮動 IP 重複計算</li>
            <li>🧠 統計系統支援 visitId + IP 雙模式，保留舊資料</li>
            <li>🖼️ 頁面底部加入廣告預留區，高度與位置模擬實際廣告</li>
            <li>🧭 所有頁面新增「回首頁」按鈕導引</li>
            <li>🛠️ 回報按鈕位置調整，避免被廣告遮住</li>
          </ul>
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-2">v0.7.3（2025-08-02）</h2>
          <ul className="list-disc list-inside space-y-1 text-gray-300">
            <li>💬 留言區支援使用者頭像與點擊個人頁面</li>
            <li>🔍 圖片大圖可放大拖曳查看</li>
            <li>🔔 新增通知系統（留言 / 回覆 / 按讚）</li>
            <li>📝 新增編輯個人資料（暱稱、簡介、備用信箱）</li>
            <li>🖼️ 修正圖片顯示比例與留言同步錯誤</li>
          </ul>
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-2">v0.7.2（2025-07-30）</h2>
          <ul className="list-disc list-inside space-y-1 text-gray-300">
            <li>✨ 首頁圖片展示與個人頁作品區完成</li>
            <li>✅ 建立註冊、登入、信箱驗證與找回密碼功能</li>
            <li>📦 串接 Cloudflare Images 與 MongoDB</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
