// ImageInfoBox.jsx
import { useRef, useState, useMemo } from "react";
import axios from "axios";
import { X, Trash2, Download, Clipboard, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ImageInfoBox({ image, currentUser, onClose, onEdit }) {
  const positiveRef = useRef();
  const negativeRef = useRef();
  const paramsRef = useRef();
  const [copiedField, setCopiedField] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    const confirmed = window.confirm("你確定要刪除這張圖片嗎？");
    if (!confirmed) return;
    if (!image || !image._id) {
      alert("找不到圖片資訊，無法刪除！");
      return;
    }
    const token = document.cookie.match(/token=([^;]+)/)?.[1];
    if (!token) return;
    try {
      const res = await axios.post(
        "/api/delete-image",
        { imageId: image._id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.status === 200) {
        alert("圖片刪除成功！");
        onClose?.();
        window.scrollTo(0, 0);
        setTimeout(() => window.location.reload(), 50);
      } else {
        alert("刪除失敗，請稍後再試。");
      }
    } catch (err) {
      console.error("❌ 刪除圖片失敗", err);
      alert("刪除失敗，請稍後再試。");
    }
  };

  const copyText = (text, field) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const copyFromRef = (ref, field) => {
    if (ref.current) copyText(ref.current.innerText, field);
  };

  const getRatingLabel = (rating) => {
    switch (rating) {
      case "18":
        return <span className="bg-red-500 text-white text-xs px-2 py-1 rounded">18+</span>;
      case "15":
        return <span className="bg-yellow-500 text-white text-xs px-2 py-1 rounded">15+</span>;
      default:
        return <span className="bg-green-600 text-white text-xs px-2 py-1 rounded">一般</span>;
    }
  };

  const downloadUrl = `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${image.imageId}/public?download=true`;

  // ======= 生成參數彙整 =======
  const adv = useMemo(
    () => ({
      model: image.modelName?.trim(),
      lora: image.loraName?.trim(),
      steps: image.steps,
      sampler: image.sampler,
      cfgScale: image.cfgScale,
      seed: image.seed,
      clipSkip: image.clipSkip,
      width: image.width,
      height: image.height,
      modelHash: image.modelHash,
    }),
    [image]
  );

  const hasAdvanced = useMemo(
    () =>
      Object.values(adv).some(
        (v) => v !== undefined && v !== null && String(v).toString().trim() !== ""
      ),
    [adv]
  );

  const buildA1111ParameterString = () => {
    // 用 A1111 常見格式組一行，僅加入存在的欄位
    const parts = [];
    if (image.positivePrompt) parts.push(image.positivePrompt);
    if (image.negativePrompt) parts.push(`Negative prompt: ${image.negativePrompt}`);
    const kv = [];
    if (adv.steps) kv.push(`Steps: ${adv.steps}`);
    if (adv.sampler) kv.push(`Sampler: ${adv.sampler}`);
    if (adv.cfgScale) kv.push(`CFG scale: ${adv.cfgScale}`);
    if (adv.seed) kv.push(`Seed: ${adv.seed}`);
    if (adv.width && adv.height) kv.push(`Size: ${adv.width}x${adv.height}`);
    if (adv.clipSkip) kv.push(`Clip skip: ${adv.clipSkip}`);
    if (adv.model) kv.push(`Model: ${adv.model}`);
    if (adv.modelHash) kv.push(`Model hash: ${adv.modelHash}`);
    if (adv.lora) kv.push(`LoRA: ${adv.lora}`);
    parts.push(kv.join(", "));
    return parts.filter(Boolean).join("\n");
  };

  const paramsString = buildA1111ParameterString();

  return (
    <div className="relative w-full overflow-x-hidden break-words space-y-4">
      {/* 標題與工具列 */}
      <div className="flex justify-between items-start mb-3">
        <div className="text-xl font-bold leading-tight text-white">
          {image.title || "（無標題）"}
        </div>

        <div className="flex items-center gap-2">
          {/* 編輯放在下載左邊；僅作者或管理員可見 */}
          {currentUser &&
            ((String(currentUser._id) === String(image.user?._id)) || currentUser.isAdmin) && (
              <button
                onClick={onEdit}
                className="flex items-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded shadow transition"
                title="編輯圖片資料"
              >
                <Pencil size={16} />
              </button>
            )}

          {/* 下載原圖 */}
          <a
            href={downloadUrl}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded shadow transition"
            title="下載原圖"
          >
            <Download size={16} />
          </a>

          {/* 刪除（作者/管理員） */}
          {currentUser &&
            ((String(currentUser._id) === String(image.user?._id)) || currentUser.isAdmin) && (
              <button
                onClick={handleDelete}
                className="flex items-center gap-1 px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded shadow transition"
                title="刪除圖片"
              >
                <Trash2 size={16} />
              </button>
            )}

          {/* 關閉 */}
          <button
            onClick={onClose}
            className="text-white hover:text-red-400 transition"
            title="關閉視窗"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* 分級 */}
      <div className="mb-3">{getRatingLabel(image.rating)}</div>

      <div className="text-sm text-zinc-300 mb-3">
        來源作者： <span className="text-white">{image?.author?.trim() || "—"}</span>
      </div>
      <div className="text-sm text-gray-300 mb-3">
        平台：{image.platform?.trim() ? image.platform : "未指定"}
      </div>

      {/* 模型 / LoRA */}
      <div className="text-sm text-gray-300 mb-3">
        模型名稱：<br />
        {(() => {
          const name = (image.modelName || "").trim();
          const link = (image.modelLink || "").trim();
          const url = link || name;
          const looksUrl = /^https?:\/\//i.test(url);
          if (!name && !looksUrl) return <span className="text-white">(未提供)</span>;
          if (looksUrl) {
            return (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 underline break-words inline-block max-w-[260px]"
              >
                {name || url}
              </a>
            );
          }
          return (
            <span className="text-white break-words inline-block max-w-[260px]">{name}</span>
          );
        })()}
      </div>

      <div className="text-sm text-gray-300 mb-3">
        LoRA 名稱：<br />
        {(() => {
          const name = (image.loraName || "").trim();
          const link = (image.loraLink || "").trim();
          const url = link || name;
          const looksUrl = /^https?:\/\//i.test(url);
          if (!name && !looksUrl) return <span className="text-white">(未提供)</span>;
          if (looksUrl) {
            return (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 underline break-words inline-block max-w-[260px]"
              >
                {name || url}
              </a>
            );
          }
          return (
            <span className="text-white break-words inline-block max-w-[260px]">{name}</span>
          );
        })()}
      </div>

      {/* 分類 */}
      <div className="text-sm text-gray-300 mb-3">分類：{image.category || "未分類"}</div>

      {/* 標籤 */}
      <div className="text-sm text-gray-300 mb-3">
        標籤：
        {Array.isArray(image.tags) && image.tags.length > 0
          ? image.tags.map((tag, index) => (
              <button
                key={index}
                onClick={() => {
                  const keyword = tag;
                  router.push(`/?search=${encodeURIComponent(keyword)}`);
                  onClose?.();
                }}
                className="inline-block bg-blue-700 hover:bg-blue-800 text-white text-xs px-2 py-1 rounded mr-1 mb-1 transition"
              >
                #{tag}
              </button>
            ))
          : "（無標籤）"}
      </div>

      {/* 正面 / 負面提示詞 */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1">
          <strong className="text-sm text-white">正面提示詞：</strong>
          <button
            onClick={() => copyFromRef(positiveRef, "positive")}
            className="text-xs px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded"
          >
            {copiedField === "positive" ? "✔ 已複製" : "複製"}
          </button>
        </div>
        <div
          ref={positiveRef}
          className="bg-neutral-900 border border-white/20 text-gray-200 text-xs p-2 rounded-lg max-h-[80px] overflow-y-auto whitespace-pre-wrap break-words"
        >
          {image.positivePrompt || "（無）"}
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <strong className="text-sm text-white">負面提示詞：</strong>
          <button
            onClick={() => copyFromRef(negativeRef, "negative")}
            className="text-xs px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded"
          >
            {copiedField === "negative" ? "✔ 已複製" : "複製"}
          </button>
        </div>
        <div
          ref={negativeRef}
          className="bg-neutral-900 border border-white/20 text-gray-200 text-xs p-2 rounded-lg max-h-[80px] overflow-y-auto whitespace-pre-wrap break-words"
        >
          {image.negativePrompt || "（無）"}
        </div>
      </div>

      {/* 進階參數 */}
      <div className="rounded-lg border border-white/10">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="w-full text-left px-4 py-2 font-semibold bg-zinc-800 hover:bg-zinc-700 transition"
        >
          {showAdvanced ? "▼" : "►"} 生成參數（可展開）
        </button>
        {showAdvanced && (
          <div className="p-4 space-y-3 bg-zinc-900/60">
            {hasAdvanced ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <Field label="Steps" value={adv.steps} />
                  <Field label="Sampler" value={adv.sampler} />
                  <Field label="CFG scale" value={adv.cfgScale} />
                  <Field label="Seed" value={adv.seed} />
                  <Field label="Clip skip" value={adv.clipSkip} />
                  <Field label="寬度" value={adv.width} />
                  <Field label="高度" value={adv.height} />
                  <Field label="Model hash" value={adv.modelHash} />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div ref={paramsRef} className="sr-only">
                    {paramsString}
                  </div>
                  <button
                    type="button"
                    onClick={() => copyText(paramsString, "params")}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Clipboard size={14} />
                    {copiedField === "params" ? "✔ 已複製參數" : "複製成 A1111 格式"}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-xs text-zinc-400">（沒有儲存到生成參數）</div>
            )}
          </div>
        )}
      </div>

      {/* 描述 */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <strong className="text-base text-white">描述：</strong>
        </div>
        <div className="bg-neutral-900 border border-white/20 text-gray-200 text-base p-3 rounded-lg whitespace-pre-wrap break-words">
          {image.description || "（無）"}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="bg-neutral-900 border border-white/10 rounded p-2">
      <div className="text-zinc-400 mb-1">{label}</div>
      <div className="text-white break-words min-h-[18px]">{value ?? "—"}</div>
    </div>
  );
}
