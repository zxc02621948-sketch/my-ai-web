// components/image/AdminModerationBar.jsx
"use client";

import { useState, useMemo } from "react";
import CATEGORIES from "@/constants/categories";
import { notify } from "@/components/common/GlobalNotificationManager";

// 🔧 只有「刪除」會顯示的理由選單（先保留一個正式代碼，避免超出後端支援）
const DELETE_REASONS = [
  { value: "policy_violation", label: "規範違反（policy_violation）" },
  { value: "duplicate_content", label: "重複內容（duplicate_content）" },
];

export default function AdminModerationBar({ image, onDone }) {
  // 'delete' | 'reclassify' | 'rerate'
  const [action, setAction] = useState("delete");

  // reclassify / rerate 專用欄位
  const [newCategory, setNewCategory] = useState(image?.category || "");
  const [newRating, setNewRating] = useState(String(image?.rating || "all"));

  // 刪除專屬理由 + 補充說明
  const [deleteReason, setDeleteReason] = useState("policy_violation");
  const [note, setNote] = useState("");

  const [loading, setLoading] = useState(false);

  // 以站內既有分類為主，若現有圖片的分類不在清單，則加到第一個位置避免值被吃掉
  const categoryOptions = useMemo(() => {
    const list = Array.isArray(CATEGORIES) ? [...CATEGORIES] : [];
    if (image?.category && !list.includes(image.category)) {
      list.unshift(image.category);
    }
    return list;
  }, [image?.category]);

  async function submit() {
    if (!image?._id) {
      notify.warning("提示", "找不到圖片 ID");
      return;
    }

    // 驗證
    if (action === "reclassify" && !newCategory) {
      notify.warning("提示", "請選擇新分類");
      return;
    }
    if (action === "rerate" && !newRating) {
      notify.warning("提示", "請選擇新分級");
      return;
    }

    // reasonCode：刪除用選單；其餘動作用固定代碼
    const reasonCode =
      action === "delete"
        ? deleteReason
        : action === "reclassify"
        ? "category_wrong"
        : "rating_wrong";

    setLoading(true);
    try {
      const res = await fetch("/api/delete-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageId: image._id,
          adminModeration: true,
          adminAction: action,
          reasonCode,                   // ✅ 刪除：選單值；改分類/改分級：固定對應
          newCategory: action === "reclassify" ? newCategory : undefined,
          newRating: action === "rerate" ? newRating : undefined,
          note: note?.trim() || "",     // 可選補充說明：三種動作皆可附
        }),
      });
      const data = await res.json();
      if (!res.ok || data?.ok === false) throw new Error(data?.message || "操作失敗");
      notify.success("成功", data.summary || "已完成");
      onDone?.(data);
    } catch (e) {
      console.error(e);
      notify.error("操作失敗", e.message || "請稍後再試");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="mt-3 rounded border border-zinc-700 bg-zinc-900/60 p-3 text-sm"
      data-stop-nav
      onClick={(e)=>e.stopPropagation()}
      onPointerDown={(e)=>e.stopPropagation()}
      onMouseDown={(e)=>e.stopPropagation()}
      onTouchStart={(e)=>e.stopPropagation()}
    >
      <div className="font-semibold text-zinc-200 mb-2">🛡️ 管理員操作</div>

      <div className="flex flex-wrap items-center gap-3 mb-3">
        {/* 操作選擇 */}
        <label className="inline-flex items-center gap-2">
          <span>操作</span>
          <select
            className="bg-zinc-900 border border-white/10 rounded px-2 py-1"
            value={action}
            onChange={(e) => setAction(e.target.value)}
          >
            <option value="delete">刪除圖片</option>
            <option value="reclassify">更改分類</option>
            <option value="rerate">更改分級</option>
          </select>
        </label>

        {/* 刪除專屬：理由選單 */}
        {action === "delete" && (
          <label className="inline-flex items-center gap-2">
            <span>刪除理由</span>
            <select
              className="bg-zinc-900 border border-white/10 rounded px-2 py-1"
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
            >
              {DELETE_REASONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </label>
        )}

        {/* 更改分類：只選新分類，不再有理由 */}
        {action === "reclassify" && (
          <label className="inline-flex items-center gap-2">
            <span>新分類</span>
            <select
              className="bg-zinc-900 border border-white/10 rounded px-2 py-1 min-w-[10rem]"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            >
              <option value="">（請選擇）</option>
              {categoryOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
        )}

        {/* 更改分級：只選新分級，不再有理由 */}
        {action === "rerate" && (
          <label className="inline-flex items-center gap-2">
            <span>新分級</span>
            <select
              className="bg-zinc-900 border border-white/10 rounded px-2 py-1"
              value={newRating}
              onChange={(e) => setNewRating(e.target.value)}
            >
              <option value="all">一般</option>
              <option value="15">15+</option>
              <option value="18">18+</option>
            </select>
          </label>
        )}
      </div>

      {/* 補充說明（三種動作皆可填，會寄給作者） */}
      <textarea
        className="w-full bg-zinc-900 border border-white/10 rounded px-2 py-1 text-zinc-200"
        rows={3}
        placeholder="可選：補充說明（會一起寄給作者）"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <div className="mt-3">
        <button
          onClick={submit}
          disabled={loading}
          className={`px-4 py-2 rounded text-white disabled:opacity-50 ${action === "delete" ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
        >
          {loading ? "處理中…" : action === "delete" ? "🗑️ 刪除並寄站內信" : "💾 變更並寄站內信"}
        </button>
      </div>
    </div>
  );
}
