"use client";

import { formatDistanceToNow } from "date-fns";
import axios from "axios";
import { Trash2 } from "lucide-react";

export default function NotificationList({
  notifications,
  setNotifications,
  setUnread,
  onNotificationClick,
}) {
  const handleMarkRead = async (id) => {
    await axios.patch(`/api/notifications/mark-read/${id}`);
    const updated = notifications.map((n) =>
      n._id === id ? { ...n, isRead: true } : n
    );
    setNotifications(updated);
    setUnread(updated.some((n) => !n.isRead));
  };

  const handleDelete = async (id) => {
    await axios.delete(`/api/notifications/${id}`);
    const updated = notifications.filter((n) => n._id !== id);
    setNotifications(updated);
    setUnread(updated.some((n) => !n.isRead));
  };

  if (notifications.length === 0) {
    return <div className="text-sm text-center p-4 text-zinc-400">目前沒有通知</div>;
  }

  return (
    <div className="divide-y divide-zinc-700">
      {notifications.map((n) => (
        <div
          key={n._id}
          className={`flex items-start gap-2 px-3 py-2 hover:bg-zinc-800 cursor-pointer ${
            n.isRead ? "opacity-70" : ""
          }`}
          onClick={() => {
            handleMarkRead(n._id);
            onNotificationClick?.(n.imageId);
          }}
        >
          <div className="flex-1">
            <div className="text-sm">
              <strong className="text-yellow-400">{n.fromUserId?.username || "某位用戶"}</strong>{" "}
              {n.type === "new_image"
                ? "發布了新圖片"
                : n.type === "comment"
                ? "留言了你的圖片"
                : n.type === "reply"
                ? "回覆了你的留言"
                : "發送了通知"}
            </div>
            <div className="text-xs text-zinc-400 line-clamp-1">{n.text}</div>
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
