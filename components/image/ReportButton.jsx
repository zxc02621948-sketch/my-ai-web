// /components/image/ReportButton.jsx
"use client";
import { useState } from "react";
import { notify } from "@/components/common/GlobalNotificationManager";

const OPTIONS = [
  { value: "category_wrong", label: "分類錯誤" },
  { value: "rating_wrong", label: "分級錯誤" },
  { value: "duplicate", label: "重複/洗版" },
  { value: "broken", label: "壞圖/無法顯示" },
  { value: "policy_violation", label: "站規違規" },
  { value: "other", label: "其他（需說明）" },
];

export default function ReportButton({ imageId }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("category_wrong");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!imageId) {
      notify.warning("提示", "圖片不存在");
      return;
    }
    if (type === "other" && !message.trim()) {
      notify.warning("提示", "請填寫說明");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ imageId, type, message }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) throw new Error(j?.message || `HTTP ${res.status}`);
      notify.success("成功", "已收到你的檢舉，感謝協助！");
      setOpen(false);
      setType("category_wrong");
      setMessage("");
    } catch (e) {
      notify.error("提交失敗", e.message || "請稍後再試");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inline-block">
      <button className="px-3 py-1 rounded-md bg-zinc-800 text-white text-sm" onClick={() => setOpen(true)}>
        檢舉
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-2xl bg-zinc-900 p-4 text-zinc-100 shadow-xl">
            <div className="text-lg font-semibold mb-3">為什麼要檢舉？</div>

            <select
              className="w-full rounded-md bg-zinc-800 p-2 mb-3"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            <textarea
              className="w-full h-24 rounded-md bg-zinc-800 p-2 mb-3"
              placeholder={type === "other" ? "請簡述原因…" : "（可選）補充說明"}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />

            <div className="flex gap-2 justify-end">
              <button className="px-3 py-1 rounded-md bg-zinc-700" onClick={() => setOpen(false)} disabled={loading}>取消</button>
              <button className="px-3 py-1 rounded-md bg-rose-600" onClick={submit} disabled={loading}>
                {loading ? "送出中…" : "送出檢舉"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
