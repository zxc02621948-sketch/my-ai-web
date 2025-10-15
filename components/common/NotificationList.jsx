"use client";

import { formatDistanceToNow } from "date-fns";
import axios from "axios";
import { Trash2 } from "lucide-react";
import { useCurrentUser } from "@/contexts/CurrentUserContext";

export default function NotificationList({
  notifications,
  setNotifications,
  onNotificationClick,
}) {
  const { updateUnreadCount } = useCurrentUser();

  const handleMarkRead = async (id) => {
    await axios.patch(`/api/notifications/mark-read/${id}`);
    const updated = notifications.map((n) =>
      n._id === id ? { ...n, isRead: true } : n
    );
    setNotifications(updated);
    const hasUnread = updated.some((n) => !n.isRead);
    updateUnreadCount('notifications', hasUnread ? 1 : 0);
  };

  const handleDelete = async (id) => {
    await axios.delete(`/api/notifications/${id}`);
    const updated = notifications.filter((n) => n._id !== id);
    setNotifications(updated);
    const hasUnread = updated.some((n) => !n.isRead);
    updateUnreadCount('notifications', hasUnread ? 1 : 0);
  };

  const handleDeleteRead = async () => {
    if (!confirm("確定要刪除所有已讀通知嗎？")) return;
    await axios.delete("/api/notifications/delete-read");
    const updated = notifications.filter((n) => !n.isRead);
    setNotifications(updated);
    const hasUnread = updated.some((n) => !n.isRead);
    updateUnreadCount('notifications', hasUnread ? 1 : 0);
  };

  if (notifications.length === 0) {
    return <div className="text-sm text-center p-4 text-zinc-400">目前沒有通知</div>;
  }

  return (
    <div className="divide-y divide-zinc-700">
      {/* ✅ 新增：一鍵刪除所有通知按鈕 */}
      <div className="py-3 px-3 text-center">
        <button
          onClick={handleDeleteRead}
          className="text-sm text-red-400 hover:underline"
        >
          🧹 刪除所有通知
        </button>
      </div>
      {notifications.map((n) => (
        <div
          key={n._id}
          className={`flex items-start gap-2 px-3 py-2 hover:bg-zinc-800 cursor-pointer ${
            n.isRead ? "opacity-70" : ""
          }`}
          onClick={() => {
            handleMarkRead(n._id);
            // 系統通知跳轉到指定鏈接
            if (!n.fromUserId && n.link) {
              window.location.href = n.link;
            } else if (n.imageId) {
              onNotificationClick?.(n.imageId);
            }
          }}
        >
          <div className="flex-1">
            <div className="text-sm">
              {/* 系統通知（無 fromUserId）*/}
              {!n.fromUserId ? (
                <>
                  <strong className="text-blue-400">🔔 系統通知</strong>
                  <div className="text-xs text-gray-300 mt-1">{n.message || n.text}</div>
                </>
              ) : (
                <>
                  <strong className="text-yellow-400">{n.fromUserId.username}</strong>{" "}
                  {n.type === "new_image"
                    ? "發布了新圖片"
                    : n.type === "comment"
                    ? "留言了你的圖片"
                    : n.type === "reply"
                    ? "回覆了你的留言"
                    : "發送了通知"}
                  {n.text && <div className="text-xs text-zinc-400 line-clamp-1 mt-1">{n.text}</div>}
                </>
              )}
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
            </div>
          </div>

          <button
            className="p-1 text-zinc-500 hover:text-red-500"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(n._id);
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
