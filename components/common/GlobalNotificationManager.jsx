"use client";

import { useState, useEffect } from "react";
import NotificationModal from "./NotificationModal";

let globalNotificationManager = null;

export class NotificationManager {
  constructor() {
    this.listeners = [];
    this.currentNotification = null;
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  notify(notification) {
    this.currentNotification = notification;
    this.listeners.forEach(callback => callback(notification));
  }

  close() {
    this.currentNotification = null;
    this.listeners.forEach(callback => callback(null));
  }

  // 便捷方法
  success(title, message, options = {}) {
    this.notify({ type: "success", title, message, ...options });
  }

  error(title, message, options = {}) {
    this.notify({ type: "error", title, message, ...options });
  }

  warning(title, message, options = {}) {
    this.notify({ type: "warning", title, message, ...options });
  }

  info(title, message, options = {}) {
    this.notify({ type: "info", title, message, ...options });
  }
}

// 全局實例
if (typeof window !== "undefined") {
  globalNotificationManager = new NotificationManager();
}

export default function GlobalNotificationManager() {
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    if (globalNotificationManager) {
      const unsubscribe = globalNotificationManager.subscribe(setNotification);
      return unsubscribe;
    }
  }, []);

  return (
    <NotificationModal
      isOpen={!!notification}
      onClose={() => {
        setNotification(null);
        if (globalNotificationManager) {
          globalNotificationManager.close();
        }
      }}
      type={notification?.type}
      title={notification?.title}
      message={notification?.message}
      autoClose={notification?.autoClose}
      autoCloseDelay={notification?.autoCloseDelay}
    />
  );
}

// 導出全局通知函數
export const notify = {
  success: (title, message, options) => {
    if (globalNotificationManager) {
      globalNotificationManager.success(title, message, options);
    }
  },
  error: (title, message, options) => {
    if (globalNotificationManager) {
      globalNotificationManager.error(title, message, options);
    }
  },
  warning: (title, message, options) => {
    if (globalNotificationManager) {
      globalNotificationManager.warning(title, message, options);
    }
  },
  info: (title, message, options) => {
    if (globalNotificationManager) {
      globalNotificationManager.info(title, message, options);
    }
  }
};
