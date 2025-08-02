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

  // 頁面載入就抓通知清單
  useEffect(() => {
    axios.get("/api/notifications").then((res) => {
      const list = res.data.notifications || [];
      setNotifications(list);
      setUnread(list.some((n) => !n.isRead));
    });
  }, []);

  // 點開鈴鐺就自動設為已讀
  useEffect(() => {
    if (open) {
      axios.post("/api/notifications/mark-all-read").then(() => {
        // 將本地狀態也同步更新
        const updated = notifications.map((n) => ({ ...n, isRead: true }));
        setNotifications(updated);
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
      console.log("📡 準備請求 API 圖片");
      const res = await axios.get(`/api/images/${cleanId}`);
      const image = res.data?.image;
      console.log("🐞 最終拿到的 image 資料：", image);

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
