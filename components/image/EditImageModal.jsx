"use client";

import { useState, useEffect, useMemo } from "react";
import Modal from "@/components/common/Modal";
import toast from "react-hot-toast";
import CATEGORIES from "@/constants/categories";
import SelectField from "@/components/common/SelectField";

/** 更寬鬆的真值判斷（支援 true/1/"1"/"true"/"yes"/"on"/"public"） */
function truthy(v) {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "true" || s === "1" || s === "yes" || s === "on" || s === "public";
  }
  return false;
}

/** 從圖片物件推論「公開 Comfy」旗標（相容多種命名） */
function inferAllowComfyShare(img) {
  const comfy = img?.comfy || {};
  const raw = img?.raw || {};
  const candidates = [
    img.allowComfyShare,     // 你前端傳的欄位
    comfy.allowShare,        // 模型常見欄位
    comfy.isPublic,          // 可能的別名
    comfy.public,
    comfy.share,
    comfy.sharePublic,
    raw.comfyAllowShare,     // 假如存到 raw
  ];
  return candidates.some(truthy);
}

export default function EditImageModal({ imageId, isOpen, onClose, onImageUpdated }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const categoryOptions = CATEGORIES;

  // ✅ 初始不預設公開；等 API 回來依「現況」帶值
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "", // 保持向後兼容
    categories: [],
    rating: "all",
    platform: "",
    positivePrompt: "",
    negativePrompt: "",
    modelName: "",
    modelUrl: "",
    loraName: "",
    loraUrl: "",
    tags: "",
    // ▼ 進階參數
    steps: "",
    sampler: "",
    cfgScale: "",
    seed: "",
    clipSkip: "",
    width: "",
    height: "",
    modelHash: "",
    allowComfyShare: false, // ⬅️ 改為 false，等載入時依現況更新（取代原本預設 true）:contentReference[oaicite:2]{index=2}
  });

  useEffect(() => {
    if (!imageId || !isOpen) return;
    let aborted = false;

    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/images/${imageId}`, { credentials: "include" });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(payload?.message || `取得圖片資料失敗（${res.status}）`);
          return;
        }
        if (aborted) return;
        const img = payload.image || {};

        // ✅ 依現況推論公開旗標（取代原本用 form.allowComfyShare 回填自己的做法）:contentReference[oaicite:3]{index=3}
        const allowShareNow = inferAllowComfyShare(img);
        
        // ✅ 將 rating 從 'sfw' 轉換為 'all' 以匹配表單選項
        const ratingForForm = img.rating === "sfw" ? "all" : (img.rating || "all");

        setForm({
          title: img.title || "",
          description: img.description || "",
          category: img.category || "", // 保持向後兼容
          categories: Array.isArray(img.categories) && img.categories.length > 0
            ? img.categories
            : img.category
              ? [img.category]
              : [],
          rating: ratingForForm,
          platform: img.platform || "",
          positivePrompt: img.positivePrompt || "",
          negativePrompt: img.negativePrompt || "",
          modelName: img.modelName || "",
          modelUrl: img.modelUrl || img.modelLink || "",
          loraName: img.loraName || "",
          loraUrl: img.loraUrl || img.loraLink || "",
          tags: Array.isArray(img.tags) ? img.tags.join(" ") : (img.tags || ""),
          // 進階
          steps: img.steps ?? "",
          sampler: img.sampler || "",
          cfgScale: img.cfgScale ?? "",
          seed: img.seed || "",
          clipSkip: img.clipSkip ?? "",
          width: img.width ?? "",
          height: img.height ?? "",
          modelHash: img.modelHash || "",
          allowComfyShare: allowShareNow, // ⬅️ 依現況
        });
      } catch (err) {
        console.error(err);
        toast.error("取得圖片資料失敗（網路或伺服器錯誤）");
      } finally {
        if (!aborted) setLoading(false);
      }
    })();

    return () => { aborted = true; };
  }, [imageId, isOpen]);

  const handleChange = (field, value) => setForm((p) => ({ ...p, [field]: value }));

  const isNonEmpty = (v) => typeof v === "string" && v.trim() !== "";
  const notAllowedLink = (v) =>
    isNonEmpty(v) &&
    !/^https?:\/\/(www\.)?(civitai\.com|seaart\.ai)\//i.test(v.trim());

  const handleSubmit = async () => {
    try {
      if (notAllowedLink(form.modelUrl) || notAllowedLink(form.loraUrl)) {
        toast.error("模型 / LoRA 連結僅允許 civitai.com 或 seaart.ai 網址");
        return;
      }
      setSaving(true);

      const normalizedTags = String(form.tags || "")
        .split(/[\s,，、]+/g)
        .map((t) => t.trim())
        .filter(Boolean);

      // ✅ 送出時確保是布林，並將 rating 從 'all' 轉換為 'sfw'
      const normalizedRating = form.rating === "all" ? "sfw" : (form.rating || "sfw");
      
      const body = {
        title: (form.title || "").trim(),
        description: form.description || "",
        category: form.categories.length > 0 ? form.categories[0] : "", // 保持向後兼容
        categories: form.categories.slice(0, 3), // 最多3個
        rating: normalizedRating,
        platform: (form.platform || "").trim(),
        positivePrompt: (form.positivePrompt || "").trim(),
        negativePrompt: (form.negativePrompt || "").trim(),
        modelName: (form.modelName || "").trim(),
        modelUrl: (form.modelUrl || "").trim(), // 若後端用 modelLink 會在 API 端對應
        loraName: (form.loraName || "").trim(),
        loraUrl: (form.loraUrl || "").trim(),   // 同上
        tags: normalizedTags,
        // 進階（型別轉換）
        steps: form.steps === "" ? null : Number(form.steps),
        sampler: (form.sampler || "").trim(),
        cfgScale: form.cfgScale === "" ? null : Number(form.cfgScale),
        seed: String(form.seed || ""),
        clipSkip: form.clipSkip === "" ? null : Number(form.clipSkip),
        width: form.width === "" ? null : Number(form.width),
        height: form.height === "" ? null : Number(form.height),
        modelHash: (form.modelHash || "").trim(),
        allowComfyShare: !!form.allowComfyShare,
      };

      const res = await fetch(`/api/images/${imageId}/edit`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `更新失敗（${res.status}）`);

      toast.success("圖片資料已更新");
      onImageUpdated?.(data.image);
      onClose?.();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "更新失敗");
    } finally {
      setSaving(false);
    }
  };

  const finalCategoryOptions = useMemo(() => {
    const opts = [...categoryOptions];
    if (form.category && !opts.includes(form.category)) opts.unshift(form.category);
    return opts;
  }, [categoryOptions, form.category]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="編輯圖片資料">
      <div className="flex flex-col gap-3">
        {/* 標題 */}
        <label className="text-sm text-zinc-300">
          標題
          <input
            className="mt-1 w-full p-2 rounded bg-zinc-800 text-white"
            placeholder="標題"
            value={form.title}
            onChange={(e) => handleChange("title", e.target.value)}
            disabled={loading || saving}
          />
        </label>

        {/* 標籤 */}
        <label className="text-sm text-zinc-300">
          標籤（以空白或逗號分隔）
          <input
            className="mt-1 w-full p-2 rounded bg-zinc-800 text-white"
            placeholder="戰士 惡魔 機甲（或：戰士, 惡魔, 機甲）"
            value={form.tags}
            onChange={(e) => handleChange("tags", e.target.value)}
            disabled={loading || saving}
          />
        </label>

        {/* 描述 */}
        <label className="text-sm text-zinc-300">
          描述（選填）
          <textarea
            className="mt-1 w-full p-2 rounded bg-zinc-800 text-white min-h-[80px]"
            placeholder="描述"
            value={form.description}
            onChange={(e) => handleChange("description", e.target.value)}
            disabled={loading || saving}
          />
        </label>

        {/* 分級 */}
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm text-zinc-300">
            分級
            <select
              className="mt-1 w-full p-2 rounded bg-zinc-800 text-white"
              value={form.rating}
              onChange={(e) => handleChange("rating", e.target.value)}
              disabled={loading || saving}
            >
              <option value="all">一般</option>
              <option value="15">15+</option>
              <option value="18">18+</option>
            </select>
          </label>
        </div>

        {/* 分類與生成平台 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 分類（可複選，最多3個） */}
          <div>
            <label className={`text-sm font-semibold text-zinc-300 mb-2 block ${form.categories.length === 0 ? "" : ""}`}>
              📁 圖片分類（可複選，最多3個）
            </label>
            <div
              className={`max-h-32 overflow-y-auto rounded p-2 bg-zinc-800 border ${
                form.categories.length === 0 ? "border-zinc-700" : form.categories.length >= 3 ? "border-yellow-500/50" : "border-zinc-700"
              }`}
            >
              {categoryOptions.map((categoryKey) => {
                const isSelected = form.categories.includes(categoryKey);
                const isDisabled = !isSelected && form.categories.length >= 3;
                
                return (
                  <label
                    key={categoryKey}
                    className={`flex items-center gap-2 py-1 cursor-pointer hover:bg-zinc-700/50 rounded px-2 ${
                      isDisabled ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      value={categoryKey}
                      checked={isSelected}
                      disabled={isDisabled || loading || saving}
                      onChange={(e) => {
                        if (e.target.checked) {
                          if (form.categories.length < 3) {
                            const newCategories = [...form.categories, categoryKey];
                            setForm((p) => ({
                              ...p,
                              categories: newCategories,
                              category: newCategories.length > 0 ? newCategories[0] : "", // 保持向後兼容
                            }));
                          }
                        } else {
                          const newCategories = form.categories.filter((c) => c !== categoryKey);
                          setForm((p) => ({
                            ...p,
                            categories: newCategories,
                            category: newCategories.length > 0 ? newCategories[0] : "", // 保持向後兼容
                          }));
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-white text-sm">
                      {categoryKey}
                    </span>
                  </label>
                );
              })}
            </div>
            {form.categories.length > 0 && (
              <div className="mt-1 text-xs text-zinc-400">
                已選擇 {form.categories.length} / 3 個分類
              </div>
            )}
          </div>

          {/* 生成平台 */}
          <div>
            <label className="text-sm text-zinc-300 mb-2 block">
              🛠️ 使用平台
            </label>
            <SelectField
              value={form.platform}
              onChange={(value) => handleChange("platform", value)}
              placeholder="選擇平台"
              options={[
                { value: 'Stable Diffusion WebUI', label: 'Stable Diffusion WebUI' },
                { value: 'ComfyUI', label: 'ComfyUI' },
                { value: 'SeaArt.ai', label: 'SeaArt.ai' },
                { value: '其他', label: '其他' },
              ]}
              disabled={loading || saving}
              buttonClassName="bg-zinc-800 text-white"
            />
          </div>
        </div>

        {/* 提示詞與負面提示詞 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm text-zinc-300">
            正面提示詞（Prompt）
            <textarea
              className="mt-1 w-full p-2 rounded bg-zinc-800 text-white min-h-[80px]"
              placeholder="描述你想要的畫面、風格等"
              value={form.positivePrompt}
              onChange={(e) => handleChange("positivePrompt", e.target.value)}
              disabled={loading || saving}
            />
          </label>
          <label className="text-sm text-zinc-300">
            負面提示詞（Negative Prompt）
            <textarea
              className="mt-1 w-full p-2 rounded bg-zinc-800 text-white min-h-[80px]"
              placeholder="不想要出現的元素（如：模糊、雜訊、扭曲等）"
              value={form.negativePrompt}
              onChange={(e) => handleChange("negativePrompt", e.target.value)}
              disabled={loading || saving}
            />
          </label>
        </div>

        <label className="text-sm text-zinc-300">
          模型名稱
          <input
            className="mt-1 w-full p-2 rounded bg-zinc-800 text-white"
            placeholder="模型名稱"
            value={form.modelName}
            onChange={(e) => handleChange("modelName", e.target.value)}
            disabled={loading || saving}
          />
        </label>

        <label className="text-sm text-zinc-300">
          模型 civitai 連結
          <input
            className="mt-1 w-full p-2 rounded bg-zinc-800 text-white"
            placeholder="https://civitai.com/... 或 https://seaart.ai/..."
            value={form.modelUrl}
            onChange={(e) => handleChange("modelUrl", e.target.value)}
            disabled={loading || saving}
          />
        </label>

        <label className="text-sm text-zinc-300">
          LoRA 名稱
          <input
            className="mt-1 w-full p-2 rounded bg-zinc-800 text-white"
            placeholder="LoRA 名稱"
            value={form.loraName}
            onChange={(e) => handleChange("loraName", e.target.value)}
            disabled={loading || saving}
          />
        </label>

        <label className="text-sm text-zinc-300">
          LoRA civitai 連結
          <input
            className="mt-1 w-full p-2 rounded bg-zinc-800 text-white"
            placeholder="https://civitai.com/... 或 https://seaart.ai/..."
            value={form.loraUrl}
            onChange={(e) => handleChange("loraUrl", e.target.value)}
            disabled={loading || saving}
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={!!form.allowComfyShare}
            onChange={(e) => handleChange("allowComfyShare", e.target.checked)}
            disabled={loading || saving}
          />
          允許公開 ComfyUI workflow（依現況顯示）
        </label>

        {/* 進階參數 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <input className="mt-1 w-full p-2 rounded bg-zinc-800 text-white" placeholder="Steps" value={form.steps} onChange={(e) => handleChange("steps", e.target.value)} disabled={loading || saving} />
          <input className="mt-1 w-full p-2 rounded bg-zinc-800 text-white" placeholder="Sampler" value={form.sampler} onChange={(e) => handleChange("sampler", e.target.value)} disabled={loading || saving} />
          <input className="mt-1 w-full p-2 rounded bg-zinc-800 text-white" placeholder="CFG scale" value={form.cfgScale} onChange={(e) => handleChange("cfgScale", e.target.value)} disabled={loading || saving} />
          <input className="mt-1 w-full p-2 rounded bg-zinc-800 text-white" placeholder="Seed" value={form.seed} onChange={(e) => handleChange("seed", e.target.value)} disabled={loading || saving} />
          <input className="mt-1 w-full p-2 rounded bg-zinc-800 text-white" placeholder="Clip skip" value={form.clipSkip} onChange={(e) => handleChange("clipSkip", e.target.value)} disabled={loading || saving} />
          <input className="mt-1 w-full p-2 rounded bg-zinc-800 text-white" placeholder="寬度" value={form.width} onChange={(e) => handleChange("width", e.target.value)} disabled={loading || saving} />
          <input className="mt-1 w-full p-2 rounded bg-zinc-800 text-white" placeholder="高度" value={form.height} onChange={(e) => handleChange("height", e.target.value)} disabled={loading || saving} />
          <input className="mt-1 w-full p-2 rounded bg-zinc-800 text-white" placeholder="Model hash" value={form.modelHash} onChange={(e) => handleChange("modelHash", e.target.value)} disabled={loading || saving} />
        </div>

        <div className="mt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded bg-zinc-700 text-white hover:bg-zinc-600 disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || saving}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "更新中..." : "儲存修改"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
