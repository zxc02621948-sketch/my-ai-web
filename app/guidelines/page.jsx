export const metadata = { title: "社群規範" };

export default function GuidelinesPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-10 text-zinc-100">
      <h1 className="text-2xl font-bold mb-6">社群規範</h1>
      <ul className="list-disc pl-6 space-y-2">
        <li>尊重創作者與其他用戶，不騷擾、不歧視。</li>
        <li>不得發布違法或侵權內容。</li>
        <li>分級與標籤需準確，避免誤導。</li>
        <li>經檢舉之內容，平台得暫時下架並進行審核。</li>
      </ul>
      <p className="text-sm text-zinc-400 mt-6">本頁會持續更新，以平台公告為準。</p>
    </main>
  );
}
