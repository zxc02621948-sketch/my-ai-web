export default function UploadStep1({ rating, setRating, onNext }) {

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">選擇圖片分級</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => {
            setRating("all");
            onNext();
          }}
          className="p-4 rounded text-white bg-green-600 hover:bg-green-700"
        >
          一般（All）
        </button>
        <button
          onClick={() => {
            setRating("15");
            onNext();
          }}
          className="p-4 rounded text-white bg-yellow-500 hover:bg-yellow-600"
        >
          15+（輕限）
        </button>
        <button
          onClick={() => {
            setRating("18");
            onNext();
          }}
          className="p-4 rounded text-white bg-red-600 hover:bg-red-700"
        >
          18+（限制）
        </button>
      </div>
      <div className="text-sm text-zinc-400">
        請選擇本次上傳圖片的適合年齡分級，再進行後續填寫。
      </div>
    </div>
  );
}