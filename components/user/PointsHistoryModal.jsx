"use client";

import { useEffect, useState, useMemo } from "react";
import Modal from "@/components/common/Modal";

const TYPE_LABEL = {
  upload: "上傳圖片",
  video_upload: "上傳影片",
  music_upload: "上傳音樂",
  like_received: "獲得愛心",
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
  playlist_expansion: "播放清單擴充",
  register_bonus: "註冊獎勵", // ✅ 新用戶註冊贈送100積分
};

const TYPE_COLOR = {
  upload: "text-yellow-300",
  video_upload: "text-orange-300",
  music_upload: "text-purple-300",
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
  playlist_expansion: "text-indigo-400",
  register_bonus: "text-emerald-300", // ✅ 註冊獎勵使用綠色系
};

export default function PointsHistoryModal({ isOpen, onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(new Set());

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

  // 按日期和类型分组
  const groupedRows = useMemo(() => {
    const groups = new Map();
    
    rows.forEach((row) => {
      // 使用 dateKey 和 type 作为分组键
      const dateKey = row.dateKey || new Date(row.createdAt).toISOString().slice(0, 10);
      const groupKey = `${dateKey}_${row.type}`;
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          groupKey,
          dateKey,
          type: row.type,
          rows: [],
          totalPoints: 0,
        });
      }
      
      const group = groups.get(groupKey);
      group.rows.push(row);
      group.totalPoints += row.points;
    });
    
    // 转换为数组并按日期倒序排序
    return Array.from(groups.values()).sort((a, b) => {
      if (a.dateKey !== b.dateKey) {
        return b.dateKey.localeCompare(a.dateKey);
      }
      return b.rows[0].createdAt.localeCompare(a.rows[0].createdAt);
    });
  }, [rows]);

  const toggleGroup = (groupKey) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="積分記錄">
      <div className="text-white pr-2">
        {loading ? (
          <p className="text-gray-400">載入中...</p>
        ) : groupedRows.length === 0 ? (
          <p className="text-gray-400">尚無積分記錄</p>
        ) : (
          <ul className="divide-y divide-zinc-700/50">
            {groupedRows.map((group) => {
              const label = TYPE_LABEL[group.type] || group.type;
              const color = TYPE_COLOR[group.type] || "text-gray-300";
              
              // 格式化日期显示
              const date = new Date(group.dateKey + "T00:00:00");
              const dateStr = date.toLocaleDateString("zh-TW", { 
                year: "numeric", 
                month: "long", 
                day: "numeric" 
              });
              
              const isExpense = group.totalPoints <= 0;
              const sign = isExpense ? "-" : "+";
              const displayPoints = isExpense ? Math.abs(group.totalPoints) : group.totalPoints;
              const isExpanded = expandedGroups.has(group.groupKey);
              const canExpand = group.rows.length > 1;
              
              return (
                <li key={group.groupKey}>
                  {/* 合并项 */}
                  <div 
                    className={`py-2 flex items-center transition-colors ${canExpand ? "cursor-pointer hover:bg-zinc-800/70 rounded-lg px-2" : ""}`}
                    onClick={() => canExpand && toggleGroup(group.groupKey)}
                  >
                    <div className="flex flex-col flex-1 pr-6">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${color}`}>{label}</span>
                        {canExpand && (
                          <>
                            <span className="px-2 py-0.5 text-xs font-semibold bg-blue-900/40 text-blue-300 rounded-full border border-blue-600/50">
                              {group.rows.length} 筆
                            </span>
                            <span className={`text-xs font-bold transition-colors ${
                              isExpanded 
                                ? "text-blue-300" 
                                : "text-gray-400 hover:text-blue-300"
                            }`}>
                              {isExpanded ? "▼" : "►"}
                            </span>
                          </>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">{dateStr}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-sm font-semibold text-yellow-400">
                        {sign}{displayPoints}
                      </div>
                    </div>
                  </div>
                  
                  {/* 展开的详细记录 */}
                  {isExpanded && canExpand && (
                    <ul className="ml-4 border-l-2 border-zinc-700/50 pl-2 space-y-1">
                      {group.rows.map((row) => {
                        const rowDate = new Date(row.createdAt).toLocaleString("zh-TW", {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        });
                        const rowIsExpense = row.points <= 0;
                        const rowSign = rowIsExpense ? "-" : "+";
                        const rowDisplayPoints = rowIsExpense ? Math.abs(row.points) : row.points;
                        return (
                          <li key={String(row._id)} className="py-1 flex items-center">
                            <div className="flex flex-col flex-1 pr-4">
                              <span className={`text-xs ${color} opacity-75`}>{label}</span>
                              <span className="text-xs text-gray-600">{rowDate}</span>
                            </div>
                            <div className="text-xs font-semibold text-yellow-400/75 flex-shrink-0">
                              {rowSign}{rowDisplayPoints}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}