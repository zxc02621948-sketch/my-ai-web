// components/auth/SessionProviderWrapper.jsx
"use client";

import { SessionProvider } from "next-auth/react";
import { useState, useEffect } from "react";

export default function SessionProviderWrapper({ children }) {
  const [isOAuthEnabled, setIsOAuthEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // ✅ 檢查 OAuth 是否已配置
  useEffect(() => {
    fetch("/api/auth/check-oauth-config")
      .then((res) => res.json())
      .then((data) => {
        setIsOAuthEnabled(data.enabled || false);
      })
      .catch(() => {
        setIsOAuthEnabled(false);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // ✅ 如果 OAuth 未配置，直接返回 children（不使用 SessionProvider）
  // 這樣可以避免 NextAuth session API 的 500 錯誤
  if (isLoading) {
    // 載入中時先不渲染 SessionProvider，避免錯誤
    return <>{children}</>;
  }

  if (!isOAuthEnabled) {
    // OAuth 未配置，不需要 SessionProvider
    return <>{children}</>;
  }

  // ✅ 只有 OAuth 已配置時才使用 SessionProvider
  return <SessionProvider>{children}</SessionProvider>;
}

