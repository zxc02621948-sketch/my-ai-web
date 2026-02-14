// components/auth/SessionProviderWrapper.jsx
"use client";

import { SessionProvider } from "next-auth/react";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";

const OAUTH_SYNC_MAX_RETRIES = 3;
const OAUTH_SYNC_RETRY_COOLDOWN_MS = 60 * 1000;

function OAuthSessionBridge() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.email) return;

    const syncKey = `oauth_jwt_synced:${session.user.email}`;
    const failKey = `oauth_jwt_sync_failed_meta:${session.user.email}`;
    if (sessionStorage.getItem(syncKey) === "1") return;

    let failMeta = { count: 0, lastTs: 0 };
    try {
      const raw = sessionStorage.getItem(failKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed &&
          Number.isFinite(parsed.count) &&
          Number.isFinite(parsed.lastTs)
        ) {
          failMeta = parsed;
        }
      }
    } catch {
      // ignore parse failure
    }

    // 避免無限重試：達上限後本次 session 不再嘗試
    if (failMeta.count >= OAUTH_SYNC_MAX_RETRIES) return;
    // 失敗後短時間冷卻，避免連續打 callback API
    if (Date.now() - failMeta.lastTs < OAUTH_SYNC_RETRY_COOLDOWN_MS) return;

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
          sessionStorage.removeItem(failKey); // 成功後清除失敗紀錄
          window.dispatchEvent(new CustomEvent("oauth-jwt-synced"));
        } else if (!cancelled) {
          sessionStorage.setItem(
            failKey,
            JSON.stringify({ count: failMeta.count + 1, lastTs: Date.now() })
          );
        }
      } catch {
        if (!cancelled) {
          sessionStorage.setItem(
            failKey,
            JSON.stringify({ count: failMeta.count + 1, lastTs: Date.now() })
          );
        }
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

