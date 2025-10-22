"use client";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import axios from "axios";

const CurrentUserContext = createContext();

export const CurrentUserProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(undefined);
  const [subscriptions, setSubscriptions] = useState({});
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(false);
  
  // 新增：未讀計數緩存
  const [unreadCounts, setUnreadCounts] = useState({
    messages: 0,
    notifications: 0
  });
  const [lastFetchTime, setLastFetchTime] = useState(0);

  // 獲取訂閱狀態
  const fetchSubscriptions = async () => {
    if (subscriptionsLoading) return; // 防止重複調用
    setSubscriptionsLoading(true);
    try {
      const subsResponse = await axios.get("/api/subscriptions/my");
      if (subsResponse.data.success) {
        const subsMap = {};
        subsResponse.data.subscriptions.forEach(sub => {
          subsMap[sub.type] = sub;
        });
        setSubscriptions(subsMap);
        return subsMap;
      }
    } catch (error) {
      console.error("🔧 [Context] 獲取訂閱狀態失敗:", error);
    } finally {
      setSubscriptionsLoading(false);
    }
    return {};
  };

  // 檢查特定訂閱是否有效
  const hasValidSubscription = (subscriptionType) => {
    const sub = subscriptions[subscriptionType];
    
    if (!sub || !sub.isActive) {
      return false;
    }
    
    const now = new Date();
    const expiresAt = sub.expiresAt || sub.nextBillingDate;
    const isValid = expiresAt && new Date(expiresAt) > now;
    
    // 檢查是否未過期（已取消的訂閱在到期前仍可使用）
    return isValid;
  };

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await axios.get("/api/current-user");
        setCurrentUser(res.data);
        
        // 如果用戶已登入，同時獲取訂閱狀態
        if (res.data) {
          await fetchSubscriptions();
        }
      } catch {
        setCurrentUser(null);
        setSubscriptions({});
      }
    };
    fetchUser();
  }, []);

  // 訂閱狀態更新函數
  const updateSubscriptions = async () => {
    await fetchSubscriptions();
  };

  // 獲取未讀計數（帶緩存）
  const fetchUnreadCounts = useCallback(async (force = false) => {
    if (!currentUser) return unreadCounts;
    
    const now = Date.now();
    const CACHE_DURATION = 30000; // 30秒緩存
    
    if (!force && (now - lastFetchTime) < CACHE_DURATION) {
      return unreadCounts;
    }
    
    try {
      const [messagesRes, notificationsRes] = await Promise.all([
        axios.get("/api/messages/unread-count"),
        axios.get("/api/notifications/unread-count")
      ]);
      
      const newCounts = {
        messages: messagesRes.data?.unread || 0,
        notifications: notificationsRes.data?.count || 0
      };
      
      setUnreadCounts(newCounts);
      setLastFetchTime(now);
      
      return newCounts;
    } catch (error) {
      console.warn("🔧 獲取未讀計數失敗:", error);
      return unreadCounts;
    }
  }, [currentUser, unreadCounts, lastFetchTime]);

  // 更新特定未讀計數
  const updateUnreadCount = useCallback((type, count) => {
    setUnreadCounts(prev => ({
      ...prev,
      [type]: count
    }));
  }, []);

  return (
    <CurrentUserContext.Provider value={{ 
      currentUser, 
      setCurrentUser, 
      subscriptions, 
      hasValidSubscription, 
      updateSubscriptions,
      unreadCounts,
      fetchUnreadCounts,
      updateUnreadCount
    }}>
      {children}
    </CurrentUserContext.Provider>
  );
};

export const useCurrentUser = () => useContext(CurrentUserContext);
