"use client";

import { useState } from "react";
import { Flag, X } from "lucide-react";

/**
 * 通用檢舉彈窗組件
 * @param {Object} props
 * @param {boolean} props.isOpen - 是否打開
 * @param {Function} props.onClose - 關閉回調
 * @param {Function} props.onSubmit - 提交回調 (reason) => Promise<void>
 * @param {string} props.title - 彈窗標題
 * @param {string} props.description - 描述文字
 */
export default function ReportModal({ isOpen, onClose, onSubmit, title = "檢舉內容", description = "請說明檢舉原因" }) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(reason.trim());
      setReason("");
      onClose();
    } catch (error) {
      console.error("提交檢舉失敗:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setReason("");
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-zinc-900 rounded-2xl w-full max-w-md shadow-2xl border border-zinc-700 animate-fadeIn">
        {/* 標題列 */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
              <Flag className="w-5 h-5 text-amber-500" />
            </div>
            <h3 className="text-xl font-bold text-white">{title}</h3>
          </div>
          <button
            onClick={handleClose}
            disabled={submitting}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* 內容 */}
        <div className="p-6">
          <p className="text-sm text-zinc-300 mb-4">{description}</p>
          
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="請詳細說明檢舉原因，以便管理員審核..."
            className="w-full bg-zinc-800 text-white rounded-lg p-3 min-h-[120px] resize-none focus:outline-none focus:ring-2 focus:ring-amber-500 border border-zinc-700"
            disabled={submitting}
            autoFocus
          />

          <div className="text-xs text-zinc-500 mt-2">
            提示：濫用檢舉功能可能會受到處罰
          </div>
        </div>

        {/* 按鈕 */}
        <div className="flex gap-3 p-6 border-t border-zinc-700">
          <button
            onClick={handleClose}
            disabled={submitting}
            className="flex-1 px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white font-medium transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !reason.trim()}
            className="flex-1 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "提交中..." : "提交檢舉"}
          </button>
        </div>
      </div>
    </div>
  );
}

