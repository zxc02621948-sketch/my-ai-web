"use client";

import { useState, useEffect, useMemo } from "react";
import Modal from "@/components/common/Modal";
import toast from "react-hot-toast";
import CATEGORIES from "@/constants/categories";

export default function EditImageModal({ imageId, isOpen, onClose, onImageUpdated }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const categoryOptions = CATEGORIES;

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    rating: "all",
    modelName: "",
    modelUrl: "",
    loraName: "",
    loraUrl: "",
    tags: "",
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
        setForm({
          title: img.title || "",
          description: img.description || "",
          category: img.category || "",
          rating: img.rating || "all",
          modelName: img.modelName || "",
          modelUrl: img.modelUrl || "",
          loraName: img.loraName || "",
          loraUrl: img.loraUrl || "",
          tags: Array.isArray(img.tags) ? img.tags.join(" ") : (img.tags || ""),
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
  const notCivitai = (v) => isNonEmpty(v) && !/^https?:\/\/(www\.)?civitai\.com\//i.test(v.trim());

  const handleSubmit = async () => {
    try {
      if (notCivitai(form.modelUrl) || notCivitai(form.loraUrl)) {
        toast.error("模型 / LoRA 連結僅允許 civitai.com 網址");
        return;
      }
      setSaving(true);

      const normalizedTags = String(form.tags || "")
        .split(/[,\s]+/g)
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch(`/api/images/${imageId}/edit`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, tags: normalizedTags }),
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

        <label className="text-sm text-zinc-300">
          描述
          <textarea
            className="mt-1 w-full p-2 rounded bg-zinc-800 text-white min-h-[80px]"
            placeholder="描述"
            value={form.description}
            onChange={(e) => handleChange("description", e.target.value)}
            disabled={loading || saving}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm text-zinc-300">
            分類
            <select
              className="mt-1 w-full p-2 rounded bg-zinc-800 text-white"
              value={form.category || ""}
              onChange={(e) => handleChange("category", e.target.value)}
              disabled={loading || saving}
            >
              <option value="" disabled>請選擇分類</option>
              {finalCategoryOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

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
            placeholder="https://civitai.com/..."
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
            placeholder="https://civitai.com/..."
            value={form.loraUrl}
            onChange={(e) => handleChange("loraUrl", e.target.value)}
            disabled={loading || saving}
          />
        </label>

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
