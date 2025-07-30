"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
        alert("✅ 登入成功！");
        router.push("/"); // ✅ 登入成功後跳轉首頁
      } else {
        alert(`❌ 登入失敗：${data.message}`);
      }
    } catch (err) {
      console.error("登入錯誤：", err);
      alert("❌ 發生錯誤，請稍後再試");
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
          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded"
        >
          登入
        </button>
      </div>
    </div>
  );
}
