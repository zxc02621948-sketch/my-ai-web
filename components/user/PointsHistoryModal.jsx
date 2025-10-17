"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/common/Modal";

const TYPE_LABEL = {
  upload: "上傳作品",
  like_received: "獲得讚",
  like_given: "給予愛心",
  comment_received: "獲得留言",
  daily_login: "每日登入",
  admin_gift: "管理員發送",
  store_purchase: "商店購買",
  subscription_purchase: "訂閱購買",
  frame_color_edit: "頭像框調色",
  discussion_post_cost: "討論區發文",
  discussion_like_reward: "討論區愛心獎勵",
  discussion_claim_reward: "討論區收益提領",
};

const TYPE_COLOR = {
  upload: "text-yellow-300",
  like_received: "text-pink-300",
  like_given: "text-red-300",
  comment_received: "text-green-300",
  daily_login: "text-blue-300",
  admin_gift: "text-purple-300",
  store_purchase: "text-orange-300",
  subscription_purchase: "text-cyan-300",
  frame_color_edit: "text-purple-400",
  discussion_post_cost: "text-red-400",
  discussion_like_reward: "text-pink-400",
  discussion_claim_reward: "text-green-400",
};

export default function PointsHistoryModal({ isOpen, onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const run = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/points/history?limit=100&days=90&t=${Date.now()}`, { credentials: "include" });
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
      {/* 積分規則說明 */}
      <div className="mb-4 p-3 bg-blue-900/20 border border-blue-700/30 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-blue-400 text-lg">💡</span>
          <span className="text-blue-300 text-sm font-medium">積分規則</span>
        </div>
        <p className="text-gray-300 text-xs leading-relaxed">
          給他人按讚可獲積分，自讚不計分，每日最多 5 分，同一圖片僅計一次
        </p>
      </div>
      
      <div className="text-white max-h-[50vh] overflow-y-auto pr-2">
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
              // 消費類型（負數或零）顯示負號，收入類型（正數）顯示正號
              const isExpense = row.points <= 0;
              const sign = isExpense ? "-" : "+";
              const displayPoints = isExpense ? Math.abs(row.points) : row.points;
              return (
                <li key={String(row._id)} className="py-2 flex items-center">
                  <div className="flex flex-col flex-1 pr-6">
                    <span className={`text-sm ${color}`}>{label}</span>
                    <span className="text-xs text-gray-500">{date}</span>
                  </div>
                  <div className="text-sm font-semibold text-yellow-400 flex-shrink-0">{sign}{displayPoints}</div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}