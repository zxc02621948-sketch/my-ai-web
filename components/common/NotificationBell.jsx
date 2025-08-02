"use client";

import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { Bell } from "lucide-react";
import NotificationList from "./NotificationList";

export default function NotificationBell({ currentUser }) {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(false);
  const bellRef = useRef(null);

  // ✅ 每 30 秒輪詢一次未讀狀態
  useEffect(() => {
    if (!currentUser?._id) return;

    const fetchUnread = async () => {
      try {
        const res = await axios.get("/api/notifications/unread-count");
        setUnread(res.data?.count > 0);
      } catch (err) {
        console.warn("🔔 無法取得未讀通知數", err);
      }
    };

    fetchUnread(); // 初次啟動先抓一次
    const interval = setInterval(fetchUnread, 30000);

    // ✅ 支援外部強制刷新紅點
    window.addEventListener("refreshNotifications", fetchUnread);

    return () => {
      clearInterval(interval);
      window.removeEventListener("refreshNotifications", fetchUnread);
    };
  }, [currentUser]);

  // ✅ 點開鈴鐺後載入完整通知列表
  useEffect(() => {
    if (open) {
      axios.get("/api/notifications").then((res) => {
        const list = res.data.notifications || [];
        setNotifications(list);
        setUnread(list.some((n) => !n.isRead));
      });

      // ✅ 自動標記為已讀
      axios.post("/api/notifications/mark-all-read").then(() => {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, isRead: true }))
        );
        setUnread(false);
      });
    }
  }, [open]);

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
        {unread && (
          <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-zinc-900 border border-zinc-700 rounded shadow-lg z-50 max-h-[400px] overflow-y-auto">
          <NotificationList
            notifications={notifications}
            setNotifications={setNotifications}
            setUnread={setUnread}
            onNotificationClick={handleNotificationClick}
          />
        </div>
      )}
    </div>
  );
}
