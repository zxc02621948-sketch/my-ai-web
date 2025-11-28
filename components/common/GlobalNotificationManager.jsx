"use client";

import { useState, useEffect } from "react";
import NotificationModal from "./NotificationModal";
import ConfirmModal from "./ConfirmModal";

let globalNotificationManager = null;
let globalConfirmManager = null;

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

export class ConfirmManager {
  constructor() {
    this.listeners = [];
    this.currentConfirm = null;
    this.resolveCallback = null;
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  confirm(confirmData) {
    return new Promise((resolve) => {
      this.resolveCallback = resolve;
      this.currentConfirm = confirmData;
      this.listeners.forEach(callback => callback(confirmData));
    });
  }

  resolve(value) {
    if (this.resolveCallback) {
      this.resolveCallback(value);
      this.resolveCallback = null;
    }
    this.currentConfirm = null;
    this.listeners.forEach(callback => callback(null));
  }
}

// 全局實例
if (typeof window !== "undefined") {
  globalNotificationManager = new NotificationManager();
  globalConfirmManager = new ConfirmManager();
}

export default function GlobalNotificationManager() {
  const [notification, setNotification] = useState(null);
  const [confirm, setConfirm] = useState(null);

  useEffect(() => {
    if (globalNotificationManager) {
      const unsubscribe = globalNotificationManager.subscribe(setNotification);
      return unsubscribe;
    }
  }, []);

  useEffect(() => {
    if (globalConfirmManager) {
      const unsubscribe = globalConfirmManager.subscribe(setConfirm);
      return unsubscribe;
    }
  }, []);

  // 檢查 sessionStorage 中是否有需要顯示的提示（刷新後顯示）
  useEffect(() => {
    if (typeof window === "undefined" || !globalNotificationManager) return;

    // ✅ 將註冊獎勵檢查邏輯移到單獨的異步函數中
    const checkRegisterBonus = async () => {
      const showRegisterBonus = sessionStorage.getItem("showRegisterBonus");
      if (showRegisterBonus !== "true") return;
      
      sessionStorage.removeItem("showRegisterBonus");
      
      // ✅ 檢查用戶是否已經看過這個彈窗（使用 localStorage 持久化記錄）
      try {
        // 先嘗試從 token 解析用戶 ID（更快，不需要 API 調用）
        let userId = null;
        const token = localStorage.getItem("token");
        
        if (token) {
          try {
            // JWT token 格式：header.payload.signature
            const payload = JSON.parse(atob(token.split('.')[1]));
            userId = payload.id || payload._id;
          } catch (e) {
            // Token 解析失敗，嘗試從 API 獲取
          }
        }
        
        // 如果無法從 token 解析，從 API 獲取當前用戶 ID
        if (!userId) {
          try {
            const userRes = await fetch("/api/current-user", { credentials: "include" });
            if (userRes.ok) {
              const userData = await userRes.json();
              userId = userData?._id || userData?.user?._id;
            }
          } catch (e) {
            // 從 API 獲取失敗，使用 sessionStorage 作為後備方案
          }
        }
        
        if (userId) {
          // ✅ 將 userId 轉換為字符串，確保格式一致
          const userIdStr = String(userId);
          const bonusShownKey = `registerBonusShown_${userIdStr}`;
          const hasShown = localStorage.getItem(bonusShownKey);
          
          if (!hasShown) {
            // 第一次顯示，記錄到 localStorage
            localStorage.setItem(bonusShownKey, "true");
            globalNotificationManager.success(
              "🎉 歡迎加入！",
              "恭喜您成功註冊！我們已為您送上 100 積分作為歡迎禮物。\n\n您可以使用積分在積分商店購買各種功能與道具！"
            );
          }
          // 如果已經顯示過，就不顯示了
          return;
        }
        // 如果無法獲取用戶 ID，使用 sessionStorage 避免同一次會話重複顯示
        const sessionShown = sessionStorage.getItem("registerBonusShownThisSession");
        if (!sessionShown) {
          sessionStorage.setItem("registerBonusShownThisSession", "true");
          globalNotificationManager.success(
            "🎉 歡迎加入！",
            "恭喜您成功註冊！我們已為您送上 100 積分作為歡迎禮物。\n\n您可以使用積分在積分商店購買各種功能與道具！"
          );
        }
      } catch (error) {
        // 發生錯誤時，使用 sessionStorage 避免同一次會話重複顯示
        const sessionShown = sessionStorage.getItem("registerBonusShownThisSession");
        if (!sessionShown) {
          sessionStorage.setItem("registerBonusShownThisSession", "true");
          globalNotificationManager.success(
            "🎉 歡迎加入！",
            "恭喜您成功註冊！我們已為您送上 100 積分作為歡迎禮物。\n\n您可以使用積分在積分商店購買各種功能與道具！"
          );
        }
      }
    };

    try {
      // 檢查刪除圖片成功的提示
      const deletedNotification = sessionStorage.getItem("imageDeletedSuccess");
      if (deletedNotification) {
        const { title, message } = JSON.parse(deletedNotification);
        sessionStorage.removeItem("imageDeletedSuccess");
        globalNotificationManager.success(title, message);
        checkRegisterBonus(); // 異步執行，不阻塞
        return; // 只顯示一個提示，優先顯示刪除提示
      }

      // 檢查上傳圖片成功的提示
      const uploadNotification = sessionStorage.getItem("imageUploadSuccessMessage");
      if (uploadNotification) {
        try {
          const payload = JSON.parse(uploadNotification);
          const title = payload.title || "上傳成功";
          const message = payload.body || payload.message || "";
          sessionStorage.removeItem("imageUploadSuccessMessage");
          globalNotificationManager.success(title, message, { 
            autoClose: true, 
            autoCloseDelay: 6000 
          });
        } catch (e) {
          // 如果不是 JSON 格式，當作純文字處理
          sessionStorage.removeItem("imageUploadSuccessMessage");
          globalNotificationManager.success("上傳成功", uploadNotification, { 
            autoClose: true, 
            autoCloseDelay: 6000 
          });
        }
        checkRegisterBonus(); // 異步執行，不阻塞
        return;
      }

      // 檢查購買成功的提示
      const purchaseNotification = sessionStorage.getItem("purchaseSuccess");
      if (purchaseNotification) {
        const { title, message } = JSON.parse(purchaseNotification);
        sessionStorage.removeItem("purchaseSuccess");
        globalNotificationManager.success(title, message);
        checkRegisterBonus(); // 異步執行，不阻塞
        return;
      }

      // 檢查操作成功的提示（通用）
      const actionNotification = sessionStorage.getItem("actionSuccess");
      if (actionNotification) {
        const { title, message } = JSON.parse(actionNotification);
        sessionStorage.removeItem("actionSuccess");
        globalNotificationManager.success(title, message);
      }

      // ✅ 檢查是否需要顯示註冊獎勵彈窗
      checkRegisterBonus();
    } catch (err) {
      console.error("讀取保存的提示失敗:", err);
      // 清除可能損壞的數據
      sessionStorage.removeItem("imageDeletedSuccess");
      sessionStorage.removeItem("imageUploadSuccessMessage");
      sessionStorage.removeItem("purchaseSuccess");
      sessionStorage.removeItem("actionSuccess");
    }
  }, []);

  return (
    <>
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
      <ConfirmModal
        isOpen={!!confirm}
        onConfirm={() => {
          if (globalConfirmManager) {
            globalConfirmManager.resolve(true);
          }
        }}
        onCancel={() => {
          if (globalConfirmManager) {
            globalConfirmManager.resolve(false);
          }
        }}
        title={confirm?.title}
        message={confirm?.message}
        confirmText={confirm?.confirmText}
        cancelText={confirm?.cancelText}
        confirmType={confirm?.confirmType}
      />
    </>
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
  },
  // 確認對話框 - 返回 Promise<boolean>
  confirm: (title, message, options = {}) => {
    if (globalConfirmManager) {
      return globalConfirmManager.confirm({
        title,
        message,
        confirmText: options.confirmText || "確定",
        cancelText: options.cancelText || "取消",
        confirmType: options.confirmType || "danger"
      });
    }
    return Promise.resolve(false);
  }
};
