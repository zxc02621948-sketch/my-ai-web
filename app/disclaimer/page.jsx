export const metadata = { title: "免責聲明" };

export default function DisclaimerPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-10 text-zinc-100">
      <h1 className="text-2xl font-bold mb-6">免責聲明</h1>
      <p className="mb-4">
        本平台為使用者提供內容分享與瀏覽之服務，對使用者上傳或張貼之內容不負事前審查之義務。
        若經檢舉或接獲主管機關通知，平台將立即採取必要措施（如暫時移除、封鎖、停權）。
      </p>
      <p className="text-sm text-zinc-400">本頁內容為輔助說明，完整規範請參閱《服務條款與免責聲明》。</p>
    </main>
  );
}
