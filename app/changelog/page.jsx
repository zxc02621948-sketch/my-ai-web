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

      {/* v0.8.0 - 大版本更新 */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2 text-yellow-400">v0.8.0（2025-01-20）🎉 大版本更新</h2>
        
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-purple-400 mb-2">🎬 影片系統</h3>
          <ul className="list-disc list-inside space-y-1 text-gray-300 ml-4">
            <li>完整的影片上傳功能（支援多種格式，自動提取元數據）</li>
            <li>整合 YouTube 播放器，支援釘選功能</li>
            <li>影片搜索功能（標題、標籤、描述搜索）</li>
            <li>影片排序系統（熱門、最新、最舊、隨機、最多讚）</li>
            <li>無限滾動載入更多影片內容</li>
            <li>完整的影片評論系統，支援回覆</li>
            <li>影片檢舉功能，管理員審核</li>
            <li>影片編輯功能（標題、描述、標籤）</li>
            <li>影片統計與熱門度計算</li>
          </ul>
        </div>

        <div className="mb-4">
          <h3 className="text-lg font-semibold text-blue-400 mb-2">🎵 音樂系統</h3>
          <ul className="list-disc list-inside space-y-1 text-gray-300 ml-4">
            <li>音樂播放功能整合</li>
            <li>音樂搜索功能</li>
            <li>音樂排序系統</li>
            <li>音樂熱門度計算</li>
          </ul>
        </div>

        <div className="mb-4">
          <h3 className="text-lg font-semibold text-cyan-400 mb-2">🎵 播放器系統</h3>
          <ul className="list-disc list-inside space-y-1 text-gray-300 ml-4">
            <li>新增個人頁播放器功能（支援 YouTube 音樂）</li>
            <li>迷你播放器「釘選」功能（LV3 解鎖）</li>
            <li>可拖動迷你播放器，支援手機端安全邊界</li>
            <li>播放器訂閱系統（積分制月訂閱）</li>
            <li>播放進度、音量、循環狀態自動保存</li>
          </ul>
        </div>

        <div className="mb-4">
          <h3 className="text-lg font-semibold text-purple-400 mb-2">🎨 頭像框與調色盤</h3>
          <ul className="list-disc list-inside space-y-1 text-gray-300 ml-4">
            <li>新增多種頭像框（商店購買或等級解鎖）</li>
            <li>LV4 解鎖：⚔️ 戰損軍事頭像框</li>
            <li>LV5 解鎖：🌿 花園自然頭像框</li>
            <li>頭像框調色盤功能（LV2 解鎖，20 積分/次）</li>
            <li>自定義頭像框顏色（支援漸變色）</li>
            <li>頭像框在各處正確顯示（評論、個人頁、追蹤列表等）</li>
          </ul>
        </div>

        <div className="mb-4">
          <h3 className="text-lg font-semibold text-green-400 mb-2">🏆 等級與積分系統</h3>
          <ul className="list-disc list-inside space-y-1 text-gray-300 ml-4">
            <li>新增 10 個等級（LV1 - LV10），每級解鎖不同獎勵</li>
            <li>等級基於「累計獲得積分」而非當前餘額</li>
            <li>新增積分紀錄頁面，完整追蹤收支</li>
            <li>每日登入獎勵系統</li>
            <li>上傳圖片、收到讚、評論等獲得積分</li>
            <li>積分商店（頭像框、權力券、播放器訂閱等）</li>
            <li>權力券系統（限時加倍獲得積分）</li>
          </ul>
        </div>

        <div className="mb-4">
          <h3 className="text-lg font-semibold text-green-400 mb-2">🔍 搜索功能升級</h3>
          <ul className="list-disc list-inside space-y-1 text-gray-300 ml-4">
            <li>統一搜索功能（圖片、影片、音樂一鍵搜索）</li>
            <li>智能過濾與快速搜索</li>
            <li>搜索歷史記錄</li>
            <li>清空搜索回到全部內容</li>
          </ul>
        </div>

        <div className="mb-4">
          <h3 className="text-lg font-semibold text-orange-400 mb-2">💬 評論系統升級</h3>
          <ul className="list-disc list-inside space-y-1 text-gray-300 ml-4">
            <li>5層反垃圾機制（內容長度、頻率限制、重複檢測等）</li>
            <li>評論檢舉功能</li>
            <li>管理員檢舉處理系統</li>
            <li>評論影響圖片熱門度計算</li>
            <li>更好的錯誤提示與用戶體驗</li>
          </ul>
        </div>

        <div className="mb-4">
          <h3 className="text-lg font-semibold text-red-400 mb-2">🛡️ 檢舉與管理系統</h3>
          <ul className="list-disc list-inside space-y-1 text-gray-300 ml-4">
            <li>完整的檢舉系統（分類錯誤、分級錯誤、違規內容等）</li>
            <li>管理員可更改圖片分類/分級</li>
            <li>檢舉處理自動發送站內信通知</li>
            <li>檢舉人收到處理結果通知</li>
            <li>統一的通知系統（全部使用站內信）</li>
          </ul>
        </div>

        <div className="mb-4">
          <h3 className="text-lg font-semibold text-cyan-400 mb-2">📬 站內信系統</h3>
          <ul className="list-disc list-inside space-y-1 text-gray-300 ml-4">
            <li>完整的站內信功能（管理員可發送，用戶可回覆）</li>
            <li>會話式聊天介面</li>
            <li>封存/恢復功能</li>
            <li>未讀訊息提醒</li>
            <li>系統通知自動發送</li>
          </ul>
        </div>

        <div className="mb-4">
          <h3 className="text-lg font-semibold text-orange-400 mb-2">🖼️ 圖片展示優化</h3>
          <ul className="list-disc list-inside space-y-1 text-gray-300 ml-4">
            <li>新增「作品展示」與「創作參考」分頁</li>
            <li>元數據質量標準（⭐ 優質圖、✓ 標準圖、普通圖）</li>
            <li>「揭開創作秘密」按鈕（畫廊模式臨時顯示元數據）</li>
            <li>上傳時自動讀取寬高與元數據</li>
            <li>圖片模態框佈局優化</li>
          </ul>
        </div>

        <div className="mb-4">
          <h3 className="text-lg font-semibold text-pink-400 mb-2">👤 個人頁面升級</h3>
          <ul className="list-disc list-inside space-y-1 text-gray-300 ml-4">
            <li>混合顯示功能（圖片和影片統一展示）</li>
            <li>按創建時間和點讚時間智能排序</li>
            <li>視覺區分不同媒體類型</li>
            <li>頭像點擊導航功能</li>
            <li>編輯與刪除按鈕位置優化</li>
          </ul>
        </div>

        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-400 mb-2">📱 用戶體驗優化</h3>
          <ul className="list-disc list-inside space-y-1 text-gray-300 ml-4">
            <li>個人頁按鈕權限優化（只有本人可見特定按鈕）</li>
            <li>手機版教學按鈕優化</li>
            <li>導航自動滾動到頂部</li>
            <li>討論論壇載入優化</li>
            <li>重複 API 呼叫優化（性能提升）</li>
            <li>播放器位置優化（避免邊緣遮擋）</li>
          </ul>
        </div>

        <div className="mb-4">
          <h3 className="text-lg font-semibold text-indigo-400 mb-2">📄 法律與隱私</h3>
          <ul className="list-disc list-inside space-y-1 text-gray-300 ml-4">
            <li>新增隱私政策頁面</li>
            <li>新增 404 錯誤頁面</li>
            <li>新增 Sitemap（SEO 優化）</li>
            <li>新增隱私設定功能</li>
            <li>頁尾法律連結整合</li>
          </ul>
        </div>

        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-400 mb-2">🐛 錯誤修復</h3>
          <ul className="list-disc list-inside space-y-1 text-gray-300 ml-4">
            <li>修復測試訂閱過期後按鈕仍顯示啟用</li>
            <li>修復積分紀錄顯示錯誤（管理員發送、負數顯示）</li>
            <li>修復舊用戶累計積分為 0 的問題</li>
            <li>修復頭像框在追蹤列表不顯示</li>
            <li>修復圖片模態框標題與按鈕排版</li>
            <li>修復站內信封存內容殘留</li>
            <li>修復影片縮圖消失問題</li>
            <li>修復播放器釘選狀態同步問題</li>
            <li>修復評論系統重複 key 錯誤</li>
            <li>修復檢舉系統 API 錯誤</li>
            <li>清理冗餘代碼與測試檔案</li>
          </ul>
        </div>
      </div>

      {/* v0.7.6 - 舊版本 */}
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
