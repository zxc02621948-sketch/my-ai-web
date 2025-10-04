"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/common/Modal";

const TYPE_LABEL = {
  upload: "上傳作品",
  like_received: "獲得讚",
  like_given: "給予愛心",
  comment_received: "獲得留言",
  daily_login: "每日登入",
};

const TYPE_COLOR = {
  upload: "text-yellow-300",
  like_received: "text-pink-300",
  like_given: "text-red-300",
  comment_received: "text-green-300",
  daily_login: "text-blue-300",
};

export default function PointsHistoryModal({ isOpen, onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const run = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/points/history?limit=100&days=90", { credentials: "include" });
        const data = await res.json();
        setRows(Array.isArray(data?.data) ? data.data : []);
      } catch (err) {
        console.error("載入積分記錄失敗:", err);
        setRows([]);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="積分記錄">
      <div className="text-white max-h-[70vh] overflow-y-auto">
        {loading ? (
          <p className="text-gray-400">載入中...</p>
        ) : rows.length === 0 ? (
          <p className="text-gray-400">尚無積分記錄</p>
        ) : (
          <ul className="divide-y divide-zinc-700/50">
            {rows.map((row) => {
              const label = TYPE_LABEL[row.type] || row.type;
              const color = TYPE_COLOR[row.type] || "text-gray-300";
              const date = new Date(row.createdAt).toLocaleString();
              const sign = row.points >= 0 ? "+" : "";
              return (
                <li key={String(row._id)} className="py-2 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className={`text-sm ${color}`}>{label}</span>
                    <span className="text-xs text-gray-500">{date}</span>
                  </div>
                  <div className="text-sm font-semibold text-yellow-400">{sign}{row.points}</div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}