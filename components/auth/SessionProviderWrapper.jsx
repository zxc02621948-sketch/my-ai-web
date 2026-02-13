// components/auth/SessionProviderWrapper.jsx
"use client";

import { SessionProvider } from "next-auth/react";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";

function OAuthSessionBridge() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.email) return;

    const syncKey = `oauth_jwt_synced:${session.user.email}`;
    if (sessionStorage.getItem(syncKey) === "1") return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/oauth-callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email: session.user.email }),
        });
        if (!cancelled && res.ok) {
          sessionStorage.setItem(syncKey, "1");
        }
      } catch {
        // 靜默：不阻塞頁面；下一次 session 變化仍可重試。
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, session?.user?.email]);

  return null;
}

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
  return (
    <SessionProvider>
      <OAuthSessionBridge />
      {children}
    </SessionProvider>
  );
}

