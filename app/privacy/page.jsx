// app/privacy/page.jsx
export const metadata = {
  title: "隱私政策 | AI 創界",
  description: "AI 創界隱私政策 - 了解我們如何收集、使用和保護您的個人資料"
};

export default function PrivacyPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-10 text-zinc-100">
      <h1 className="text-3xl font-bold mb-8">隱私政策</h1>
      
      <div className="space-y-8">
        <section>
          <p className="text-sm text-zinc-400 mb-6">
            最後更新日期：2025 年 10 月 15 日
          </p>
          <p className="mb-4">
            歡迎使用 AI 創界（以下簡稱「本平台」）。我們重視您的隱私權，本隱私政策說明我們如何收集、使用、揭露和保護您的個人資料。
            使用本平台即表示您同意本隱私政策的內容。
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">一、我們收集的資料</h2>
          
          <div className="ml-4 space-y-4">
            <div>
              <h3 className="text-xl font-semibold text-zinc-200 mb-2">1.1 帳號資料</h3>
              <p className="text-zinc-300">
                當您註冊帳號時，我們會收集：
              </p>
              <ul className="list-disc pl-6 space-y-1 text-zinc-300 mt-2">
                <li>電子郵件地址（必填）</li>
                <li>用戶名稱（必填）</li>
                <li>密碼（經過加密處理）</li>
                <li>性別（選填）</li>
                <li>個人簡介（選填）</li>
                <li>備用電子郵件（選填）</li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-zinc-200 mb-2">1.2 使用資料</h3>
              <p className="text-zinc-300">
                我們會自動收集您使用本平台的相關資訊：
              </p>
              <ul className="list-disc pl-6 space-y-1 text-zinc-300 mt-2">
                <li>IP 位址</li>
                <li>瀏覽器類型和版本</li>
                <li>裝置資訊</li>
                <li>訪問時間和頁面</li>
                <li>搜索記錄</li>
                <li>點擊和互動記錄</li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-zinc-200 mb-2">1.3 內容資料</h3>
              <p className="text-zinc-300">
                您上傳或發布的內容，包括：
              </p>
              <ul className="list-disc pl-6 space-y-1 text-zinc-300 mt-2">
                <li>圖片及其元數據（Prompt、模型、參數等）</li>
                <li>評論和討論內容</li>
                <li>私人訊息</li>
                <li>回饋和舉報內容</li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-zinc-200 mb-2">1.4 Cookie 和追蹤技術</h3>
              <p className="text-zinc-300">
                我們使用 Cookie 和類似技術來：
              </p>
              <ul className="list-disc pl-6 space-y-1 text-zinc-300 mt-2">
                <li>維持您的登入狀態</li>
                <li>記住您的偏好設定</li>
                <li>分析網站使用情況</li>
                <li>改善用戶體驗</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">二、資料的使用目的</h2>
          <p className="text-zinc-300">我們收集的資料用於：</p>
          <ul className="list-disc pl-6 space-y-2 text-zinc-300">
            <li><strong>提供服務：</strong>處理您的註冊、登入、上傳、評論等功能</li>
            <li><strong>改善體驗：</strong>個人化內容推薦、優化介面設計</li>
            <li><strong>安全維護：</strong>防止詐騙、濫用和非法活動</li>
            <li><strong>溝通聯繫：</strong>發送系統通知、回應您的查詢</li>
            <li><strong>法律合規：</strong>遵守相關法律法規要求</li>
            <li><strong>數據分析：</strong>了解使用趨勢，改進服務品質</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">三、資料的分享與揭露</h2>
          <p className="text-zinc-300">我們不會出售您的個人資料。但在以下情況下可能分享或揭露：</p>
          <ul className="list-disc pl-6 space-y-2 text-zinc-300">
            <li><strong>公開內容：</strong>您上傳的圖片、評論等公開內容將對其他用戶可見</li>
            <li><strong>服務提供商：</strong>與協助我們運營的第三方服務商（如雲端儲存 Cloudflare）分享必要資料</li>
            <li><strong>法律要求：</strong>在法律要求或政府機關合法請求時</li>
            <li><strong>權利保護：</strong>為保護本平台、用戶或公眾的權利、財產或安全</li>
            <li><strong>業務轉讓：</strong>在合併、收購或資產出售等情況下</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">四、資料的保存期限</h2>
          <p className="text-zinc-300">我們會根據不同類型的資料設定保存期限：</p>
          <ul className="list-disc pl-6 space-y-2 text-zinc-300">
            <li><strong>帳號資料：</strong>保存至帳號刪除或法律要求期限</li>
            <li><strong>內容資料：</strong>保存至您主動刪除或帳號停用</li>
            <li><strong>日誌資料：</strong>通常保存 90 天</li>
            <li><strong>法律紀錄：</strong>依法律規定保存（如舉報記錄）</li>
          </ul>
          <div className="mt-4 p-4 bg-amber-900/20 border border-amber-500/30 rounded-lg">
            <p className="text-amber-200 text-sm">
              <strong>⚠️ 重要提醒：</strong>
            </p>
            <p className="text-zinc-300 text-sm mt-2">
              如您的內容或行為違反本平台的服務條款或相關法律法規，
              我們保留隨時刪除相關內容、暫停或終止您的帳號的權利，且不另行通知。
              違規紀錄將依法律要求保存，以備必要時提供給主管機關。
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">五、資料安全</h2>
          <p className="text-zinc-300">我們採取合理的技術和組織措施保護您的資料：</p>
          <ul className="list-disc pl-6 space-y-2 text-zinc-300">
            <li>使用 HTTPS 加密傳輸</li>
            <li>密碼經過雜湊加密儲存</li>
            <li>限制資料存取權限</li>
            <li>定期安全審查和更新</li>
            <li>監控可疑活動</li>
          </ul>
          <p className="text-zinc-300 mt-4">
            然而，沒有任何傳輸或儲存方法是 100% 安全的。我們無法保證絕對安全，但會盡最大努力保護您的資料。
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">六、您的權利</h2>
          <p className="text-zinc-300">根據適用的法律，您擁有以下權利：</p>
          <ul className="list-disc pl-6 space-y-2 text-zinc-300">
            <li><strong>存取權：</strong>查看我們持有的您的個人資料</li>
            <li><strong>更正權：</strong>要求更正不準確的資料（可在設定頁面自行修改）</li>
            <li><strong>刪除權：</strong>要求刪除您的個人資料（刪除帳號即可）</li>
            <li><strong>限制處理：</strong>在特定情況下限制資料處理</li>
            <li><strong>資料可攜權：</strong>要求以結構化格式（如 JSON、CSV）取得您的個人資料副本</li>
            <li><strong>反對權：</strong>反對特定的資料處理活動</li>
          </ul>
          <p className="text-zinc-300 mt-4">
            如需行使上述權利，請透過回饋系統或電子郵件聯繫我們。
          </p>
          
          <div className="mt-4 p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
            <p className="text-green-200 text-sm font-semibold mb-2">
              ⚙️ 快速設定隱私偏好
            </p>
            <p className="text-zinc-300 text-sm mb-3">
              您可以直接在設定頁面管理您的隱私偏好，無需聯繫我們：
            </p>
            <a 
              href="/settings/privacy"
              className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all"
            >
              🔒 前往隱私設定
            </a>
          </div>
          
          <div className="mt-4 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
            <p className="text-blue-200 text-sm font-semibold mb-2">
              💡 什麼是「資料可攜權」？
            </p>
            <p className="text-zinc-300 text-sm mb-2">
              簡單來說，就是您可以要求我們把您在平台上的資料（如上傳的圖片、評論、個人資料等）
              整理成一個檔案給您，方便您保存備份。
            </p>
            <p className="text-zinc-400 text-xs">
              例如：您可以要求匯出所有上傳的圖片清單、評論記錄等，
              我們會提供 JSON 或 CSV 格式的檔案供您下載保存。
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">七、未成年人隱私</h2>
          <p className="text-zinc-300">
            本平台不針對 13 歲以下的兒童。我們不會故意收集 13 歲以下兒童的個人資料。
            如果您發現我們無意中收集了此類資料，請立即通知我們，我們將盡快刪除。
          </p>
          <p className="text-zinc-300 mt-4">
            18 歲以下用戶在使用本平台前，建議先徵得家長或監護人的同意。
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">八、第三方連結</h2>
          <p className="text-zinc-300">
            本平台可能包含第三方網站或服務的連結（如 Civitai、YouTube）。
            我們不對這些第三方的隱私政策或做法負責。建議您查看這些網站的隱私政策。
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">九、跨境資料傳輸</h2>
          <p className="text-zinc-300">
            您的資料可能會被傳輸至您所在國家或地區以外的地方進行處理和儲存。
            我們會確保這些傳輸符合適用的資料保護法律。
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">十、政策變更</h2>
          <p className="text-zinc-300">
            我們可能會不時更新本隱私政策。重大變更時，我們會在平台上發布通知。
            建議您定期查看本頁面以了解最新政策。
          </p>
          <p className="text-zinc-300 mt-4">
            繼續使用本平台即表示您接受更新後的隱私政策。
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">十一、聯繫我們</h2>
          <p className="text-zinc-300">
            如果您對本隱私政策有任何疑問、意見或請求，請透過以下方式聯繫我們：
          </p>
          <ul className="list-none space-y-2 text-zinc-300 ml-4">
            <li>📧 <strong>平台回饋系統：</strong>使用網站右下角的回饋按鈕</li>
            <li>💬 <strong>站內訊息：</strong>聯繫管理員</li>
          </ul>
          <p className="text-zinc-300 mt-4">
            我們會在收到您的請求後的合理時間內回覆。
          </p>
        </section>

        <section className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 mt-8">
          <h2 className="text-xl font-semibold text-white mb-3">📋 相關文件</h2>
          <div className="flex flex-wrap gap-3">
            <a href="/terms" className="text-blue-400 hover:text-blue-300 underline">
              服務條款
            </a>
          </div>
        </section>

        <div className="text-center text-sm text-zinc-500 mt-12 pb-8">
          <p>© 2025 AI 創界. 保留所有權利。</p>
        </div>
      </div>
    </main>
  );
}

