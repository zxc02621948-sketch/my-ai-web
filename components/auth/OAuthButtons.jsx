// components/auth/OAuthButtons.jsx
"use client";

import { signIn } from "next-auth/react";
import { useState, useEffect } from "react";
import { notify } from "@/components/common/GlobalNotificationManager";

export default function OAuthButtons({ onSuccess }) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState(null);
  const [isOAuthEnabled, setIsOAuthEnabled] = useState(false);

  // ✅ 檢查 OAuth 是否已配置（只在客戶端檢查）
  useEffect(() => {
    // 透過 API 檢查環境變數是否已設定
    fetch("/api/auth/check-oauth-config")
      .then((res) => res.json())
      .then((data) => {
        setIsOAuthEnabled(data.enabled || false);
      })
      .catch(() => {
        setIsOAuthEnabled(false);
      });
  }, []);

  const handleOAuthLogin = async (provider) => {
    setIsLoading(true);
    setLoadingProvider(provider);

    try {
      // ✅ 使用 NextAuth 的 signIn 函數進行 OAuth 登入
      const result = await signIn(provider, {
        redirect: false,
        callbackUrl: window.location.href,
      });

      if (result?.error) {
        notify.error("登入失敗", `使用 ${provider === "google" ? "Google" : "Facebook"} 登入失敗，請稍後再試。`);
        setIsLoading(false);
        setLoadingProvider(null);
        return;
      }

      if (result?.ok) {
        // ✅ OAuth 登入成功，從 NextAuth session 取得 email，然後調用我們的 API 生成 JWT token
        try {
          // 等待一下讓 NextAuth session 更新
          await new Promise((resolve) => setTimeout(resolve, 500));

          // 從 NextAuth 取得 session
          const sessionResponse = await fetch("/api/auth/session");
          const session = await sessionResponse.json();

          if (session?.user?.email) {
            // ✅ 調用我們的 OAuth callback API 生成 JWT token
            const tokenResponse = await fetch("/api/auth/oauth-callback", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ email: session.user.email }),
            });

            const tokenData = await tokenResponse.json();

            if (tokenResponse.ok && tokenData.token) {
              // ✅ 保存 token 並重新載入頁面
              localStorage.setItem("token", tokenData.token);
              notify.success("登入成功", `使用 ${provider === "google" ? "Google" : "Facebook"} 登入成功！`);
              
              if (onSuccess) {
                onSuccess();
              } else {
                window.location.reload();
              }
            } else {
              notify.error("登入失敗", "無法生成登入憑證，請稍後再試。");
            }
          } else {
            notify.error("登入失敗", "無法取得用戶資訊，請稍後再試。");
          }
        } catch (err) {
          console.error("❌ OAuth callback 錯誤:", err);
          notify.error("登入失敗", "發生錯誤，請稍後再試。");
        }
      }

      setIsLoading(false);
      setLoadingProvider(null);
    } catch (err) {
      console.error("❌ OAuth 登入錯誤:", err);
      notify.error("登入失敗", `使用 ${provider === "google" ? "Google" : "Facebook"} 登入時發生錯誤，請稍後再試。`);
      setIsLoading(false);
      setLoadingProvider(null);
    }
  };

  // ✅ 如果 OAuth 未配置，不顯示按鈕
  if (!isOAuthEnabled) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-zinc-700"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-zinc-900 text-zinc-400">或使用第三方登入</span>
        </div>
      </div>

      <button
        onClick={() => handleOAuthLogin("google")}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white hover:bg-gray-100 text-gray-900 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-gray-300"
      >
        {loadingProvider === "google" ? (
          <>
            <svg className="animate-spin h-5 w-5 text-gray-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>登入中...</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span>使用 Google 登入</span>
          </>
        )}
      </button>

      <button
        onClick={() => handleOAuthLogin("facebook")}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-[#1877F2] hover:bg-[#166FE5] text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loadingProvider === "facebook" ? (
          <>
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>登入中...</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            <span>使用 Facebook 登入</span>
          </>
        )}
      </button>
    </div>
  );
}

