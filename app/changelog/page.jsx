// app/changelog/page.jsx
export default function ChangelogPage() {
  return (
    <div className="max-w-2xl mx-auto py-10 px-4 text-white">
      <h1 className="text-2xl font-bold mb-6">📝 更新日誌</h1>

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
  );
}
