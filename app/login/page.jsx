"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { notify } from "@/components/common/GlobalNotificationManager";
import OAuthButtons from "@/components/auth/OAuthButtons";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleLogin = async () => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        notify.success("登入成功", "登入成功！");
        router.push("/"); // ✅ 登入成功後跳轉首頁
      } else {
        // ✅ API 返回的錯誤訊息在 error 欄位，不是 message
        const errorMessage = data.error || data.message || "登入失敗，請稍後再試";
        notify.error("登入失敗", errorMessage);
      }
    } catch (err) {
      console.error("登入錯誤：", err);
      notify.error("錯誤", "發生錯誤，請稍後再試");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div className="bg-gray-800 p-6 rounded-xl shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-4 text-center">會員登入</h1>

        <label className="block mb-2">Email</label>
        <input
          type="email"
          className="w-full p-2 rounded bg-gray-700 mb-4"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleLogin(); // ✅ 支援 Enter 鍵
          }}
        />

        <label className="block mb-2">密碼</label>
        <input
          type="password"
          className="w-full p-2 rounded bg-gray-700 mb-6"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleLogin(); // ✅ 支援 Enter 鍵
          }}
        />

        <button
          onClick={handleLogin}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded mb-4"
        >
          登入
        </button>

        {/* ✅ OAuth 第三方登入按鈕 */}
        <OAuthButtons
          onSuccess={() => {
            router.push("/");
          }}
        />
      </div>
    </div>
  );
}
