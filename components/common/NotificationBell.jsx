"use client";

import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { Bell } from "lucide-react";
import NotificationList from "./NotificationList";
import { useCurrentUser } from "@/contexts/CurrentUserContext";

export default function NotificationBell() {
  const { currentUser, unreadCounts, fetchUnreadCounts, updateUnreadCount } = useCurrentUser();
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const bellRef = useRef(null);

  // ✅ 使用 Context 緩存的未讀計數
  useEffect(() => {
    if (!currentUser?._id) return;

    const refreshNotifications = () => {
      fetchUnreadCounts(true); // 強制刷新
    };

    // 初次載入
    fetchUnreadCounts();
    
    // 支援外部強制刷新紅點
    window.addEventListener("refreshNotifications", refreshNotifications);

    return () => {
      window.removeEventListener("refreshNotifications", refreshNotifications);
    };
  }, [currentUser, fetchUnreadCounts]);

  // ✅ 點開鈴鐺後載入完整通知列表
  useEffect(() => {
    if (open) {
      axios.get("/api/notifications").then((res) => {
        const list = res.data.notifications || [];
        setNotifications(list);
        const hasUnread = list.some((n) => !n.isRead);
        updateUnreadCount('notifications', hasUnread ? 1 : 0);
      });
    } else if (!open && notifications.length > 0) {
      // ✅ 關閉鈴鐺時才標記為已讀（只執行一次）
      axios.post("/api/notifications/mark-all-read").then(() => {
        updateUnreadCount('notifications', 0);
        setNotifications([]); // 清空通知列表，避免重複觸發
      });
    }
  }, [open, updateUnreadCount]);

  // 點外部關閉彈窗
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (bellRef.current && !bellRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNotificationClick = async (imageId) => {
    const cleanId = String(imageId).trim();
    try {
      const res = await axios.get(`/api/images/${cleanId}`);
      const image = res.data?.image;

      if (image?._id) {
        window.dispatchEvent(
          new CustomEvent("openImageModal", {
            detail: { imageId: image._id },
          })
        );
        setOpen(false);
      } else {
        throw new Error("圖片不存在");
      }
    } catch (err) {
      console.warn("⚠️ 找不到該圖片，可能已被刪除");
      alert("找不到該圖片，可能已被刪除");
    }
  };

  return (
    <div ref={bellRef} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative p-2 hover:text-yellow-400"
      >
        <Bell />
        {unreadCounts.notifications > 0 && (
          <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-zinc-900 border border-zinc-700 rounded shadow-lg z-50 max-h-[400px] overflow-y-auto">
          <NotificationList
            notifications={notifications}
            setNotifications={setNotifications}
            onNotificationClick={handleNotificationClick}
          />
        </div>
      )}
    </div>
  );
}
