"use client";

import { useState } from "react";
import axios from "axios";
import Modal from "@/components/common/Modal";

export default function PlaylistModal({
  isOpen,
  onClose,
  playlist = [],
  onChangePlaylist,
  activeIndex = 0,
  onSetActiveIndex,
  maxItems = 5,
}) {
  const [inputUrl, setInputUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const canAddMore = (playlist?.length || 0) < Number(maxItems || 5);

  const isYouTubeUrl = (u) => {
    try {
      const url = new URL(String(u));
      return /youtube\.com|youtu\.be/.test(url.hostname);
    } catch {
      return false;
    }
  };

  const fetchTitle = async (url) => {
    try {
      const o = await axios.get(`/api/youtube-oembed?url=${encodeURIComponent(url)}`);
      return String(o?.data?.title || "");
    } catch {
      return "";
    }
  };

  const addItem = async () => {
    const raw = String(inputUrl || "").trim();
    if (!raw) return;
    if (!isYouTubeUrl(raw)) return;
    if (!canAddMore) return;
    setAdding(true);
    const title = (await fetchTitle(raw)) || raw;
    const next = [...(playlist || []), { url: raw, title }];
    onChangePlaylist?.(next);
    setInputUrl("");
    setAdding(false);
  };

  const removeItem = (idx) => {
    const next = (playlist || []).filter((_, i) => i !== idx);
    onChangePlaylist?.(next);
    if (typeof activeIndex === "number" && idx === activeIndex) {
      onSetActiveIndex?.(Math.max(0, activeIndex - 1));
    }
  };

  const moveItem = (from, to) => {
    if (to < 0 || to >= (playlist || []).length) return;
    const next = [...(playlist || [])];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChangePlaylist?.(next);
    if (activeIndex === from) onSetActiveIndex?.(to);
  };

  return (
    <Modal isOpen={!!isOpen} onClose={onClose} title="管理播放清單">
      <div className="space-y-4">
        {/* 新增連結輸入 */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="貼上 YouTube 連結"
            className="flex-1 px-3 py-2 rounded-md bg-black/50 border border-gray-700 text-white placeholder-gray-500"
          />
          <button
            onClick={addItem}
            disabled={!canAddMore || adding || !isYouTubeUrl(inputUrl)}
            className="px-3 py-2 rounded-md bg-white/10 hover:bg-white/20 border border-white/30 text-white disabled:opacity-50"
          >
            新增
          </button>
        </div>
        {!canAddMore ? (
          <p className="text-xs text-orange-300">已達 {maxItems} 首上限，解鎖更多請使用積分購買播放空間。</p>
        ) : (
          <p className="text-xs text-gray-400">目前僅支援 YouTube 連結。可新增至 {maxItems} 首。</p>
        )}

        {/* 清單 */}
        <div className="space-y-2 max-h-64 overflow-auto">
          {(playlist || []).length === 0 ? (
            <div className="text-sm text-gray-400">尚未新增任何曲目。</div>
          ) : (
            (playlist || []).map((item, i) => (
              <div key={`${item.url}-${i}`} className={`flex items-center gap-2 p-2 rounded border ${i === activeIndex ? "border-white/50 bg-white/5" : "border-white/20 bg-white/0"}`}>
                <button
                  className="px-2 py-1 rounded bg-black/40 text-xs border border-white/20"
                  title="設為目前播放"
                  onClick={() => onSetActiveIndex?.(i)}
                >
                  播放
                </button>
                <div className="flex-1 truncate">
                  <div className="text-sm text-white truncate">{item.title || item.url}</div>
                  <div className="text-[11px] text-gray-400 truncate">{item.url}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-xs border border-white/20"
                    onClick={() => moveItem(i, i - 1)}
                    title="上移"
                  >↑</button>
                  <button
                    className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-xs border border-white/20"
                    onClick={() => moveItem(i, i + 1)}
                    title="下移"
                  >↓</button>
                  <button
                    className="px-2 py-1 rounded bg-red-600/70 hover:bg-red-600 text-xs border border-red-400"
                    onClick={() => removeItem(i)}
                    title="刪除"
                  >刪除</button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 關閉 */}
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-white/10 hover:bg-white/20 border border-white/30 text-white"
          >
            關閉
          </button>
        </div>
      </div>
    </Modal>
  );
}