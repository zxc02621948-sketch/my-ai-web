"use client";
import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";

const CurrentUserContext = createContext();
const isAuthStatus = (status) => status === 401 || status === 403;

export const CurrentUserProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(undefined);
  const [subscriptions, setSubscriptions] = useState({});
  const subscriptionsLoadingRef = useRef(false);

  // 新增：未讀計數緩存
  const [unreadCounts, setUnreadCounts] = useState({
    messages: 0,
    notifications: 0
  });
  const [lastFetchTime, setLastFetchTime] = useState(0);

  // 獲取訂閱狀態
  const fetchSubscriptions = useCallback(async (userOverride = null) => {
    const targetUser = userOverride ?? currentUser;
    if (!targetUser) {
      setSubscriptions({});
      return {};
    }
    if (subscriptionsLoadingRef.current) return {}; // 防止重複調用
    subscriptionsLoadingRef.current = true;
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
      const status = error?.response?.status;
      // 登出或憑證過期時，401/403 是預期結果，不輸出紅色錯誤。
      if (isAuthStatus(status)) {
        setSubscriptions({});
        return {};
      }
      console.error("🔧 [Context] 獲取訂閱狀態失敗:", error);
    } finally {
      subscriptionsLoadingRef.current = false;
    }
    return {};
  }, [currentUser]);

  const refreshCurrentUser = useCallback(async (abortSignal = null) => {
    try {
      const res = await axios.get("/api/current-user", abortSignal ? { signal: abortSignal } : undefined);
      if (abortSignal?.aborted) return;
      setCurrentUser(res.data);
      if (res.data) {
        await fetchSubscriptions(res.data);
      } else {
        setSubscriptions({});
      }
    } catch (error) {
      if (
        error?.name === "CanceledError" ||
        error?.message === "canceled" ||
        error?.code === "ERR_CANCELED" ||
        abortSignal?.aborted
      ) {
        return;
      }
      if (isAuthStatus(error?.response?.status)) {
        setCurrentUser(null);
        setSubscriptions({});
        return;
      }
      setCurrentUser(null);
      setSubscriptions({});
    }
  }, [fetchSubscriptions]);

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
    // ✅ 僅在 mount 時執行一次，避免 401 後依賴變動造成無限迴圈
    const abortController = new AbortController();
    refreshCurrentUser(abortController.signal);
    return () => {
      abortController.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only on mount
  }, []);

  useEffect(() => {
    const onOAuthJwtSynced = () => {
      refreshCurrentUser();
    };
    window.addEventListener("oauth-jwt-synced", onOAuthJwtSynced);
    return () => window.removeEventListener("oauth-jwt-synced", onOAuthJwtSynced);
  }, [refreshCurrentUser]);

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
      if (isAuthStatus(error?.response?.status)) {
        const zeroCounts = { messages: 0, notifications: 0 };
        setUnreadCounts(zeroCounts);
        return zeroCounts;
      }
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
      refreshCurrentUser,
      unreadCounts,
      fetchUnreadCounts,
      updateUnreadCount
    }}>
      {children}
    </CurrentUserContext.Provider>
  );
};

export const useCurrentUser = () => useContext(CurrentUserContext);
