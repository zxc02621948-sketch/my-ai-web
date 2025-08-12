// app/terms/page.jsx
export const metadata = { title: "服務條款與免責聲明 | 你的站名" };

export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-10 text-zinc-100">
      <h1 className="text-2xl font-bold mb-6">服務條款與免責聲明</h1>

      <section className="space-y-4 mb-8">
        <h2 className="text-xl font-semibold">一、免責聲明</h2>
        <p>
          本平台僅提供用戶分享與瀏覽內容之空間，不事先審查用戶上傳內容，
          亦不對內容之真實性、合法性、完整性或品質負責。任何內容之合法性由上傳者自行負責。
        </p>
        <p>
          若本平台接獲檢舉或主管機關通知某內容可能違反法律，將立即暫時移除或封鎖該內容，
          並得依情節停權或刪除帳號。平台將保留處理紀錄，以備必要時提供。
        </p>
      </section>

      <section className="space-y-4 mb-8">
        <h2 className="text-xl font-semibold">二、禁止事項</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>上傳或分享任何違反中華民國（台灣）法律之內容，包括但不限於兒少性剝削、侵害著作權、詐欺、誹謗、散布惡意程式等。</li>
          <li>假冒他人身份或冒用他人著作上傳。</li>
          <li>干擾、破壞或試圖未經授權存取本平台之服務。</li>
        </ul>
      </section>

      <section className="space-y-4 mb-8">
        <h2 className="text-xl font-semibold">三、內容分級與錯標處理</h2>
        <p>
          上傳者須依內容性質正確標註分級（一般 / 15+ / 18+）。若經檢舉或審核確認存在錯標，
          平台得重新分級、下架或停權。屢次錯標視為重大違規。
        </p>
      </section>

      <section className="space-y-4 mb-8">
        <h2 className="text-xl font-semibold">四、成人內容特別條款（18+）</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>上傳者須確認作品中所有角色（含虛構、繪圖、AI 生成）之設定年齡均為 <strong>18 歲以上</strong>。</li>
          <li>允許高中制服題材，但角色年齡須設定為 18 歲或以上；<strong>禁止國中、小學、幼兒園制服</strong>及其他低齡化扮裝。</li>
          <li>不得出現明顯兒童化場景或符號（如幼兒房、兒童遊樂場、奶嘴、娃娃屋等）。</li>
          <li>不得將成人內容錯標為 15+ 或一般分級。平台可逕行重新分級、下架並視情節停權。</li>
        </ul>
        <p className="text-sm text-zinc-400">
          註：平台市場以台灣地區為主，相關規範以中華民國法律為依據。若使用海外託管/傳輸服務，平台亦保留依其服務條款採取必要調整或限制之權利。
        </p>
      </section>

      <section className="space-y-4 mb-8">
        <h2 className="text-xl font-semibold">五、通知—移除機制</h2>
        <p>
          任何人可透過平台提供之檢舉管道反映疑似違法或不當內容。平台經評估後，得暫時移除或封鎖該內容，並通知上傳者陳述。
        </p>
      </section>

      <section className="space-y-2 mb-8 text-sm text-zinc-400">
        <p>最近更新：{new Date().toISOString().slice(0, 10)}</p>
        <p>如對本條款有任何疑問，請使用平台提供之聯絡方式與我們聯繫。</p>
      </section>
    </main>
  );
}
