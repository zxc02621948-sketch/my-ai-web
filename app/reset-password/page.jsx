"use client";

import { useState, Suspense } from "react";
import SearchParamsReset from "@/components/common/SearchParamsReset";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("連結無效，請重新申請重設密碼。");
      return;
    }

    if (password !== confirmPassword) {
      setError("兩次輸入的密碼不一致！");
      return;
    }

    setStatus("loading");

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "密碼重設失敗！");
      }

      setStatus("success");
    } catch (err) {
      setError(err.message);
      setStatus("idle");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      {/* ✅ Suspense 包裹 token 初始化 */}
      <Suspense fallback={null}>
        <SearchParamsReset onTokenRead={setToken} />
      </Suspense>

      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 w-full max-w-md">
        <h1 className="text-2xl font-semibold mb-4 text-gray-800">重設密碼</h1>

        {status === "success" ? (
          <p className="text-green-600">密碼已成功重設，請返回登入畫面。</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                新密碼
              </label>
              <input
                type="password"
                className="w-full border rounded px-3 py-2 text-gray-800 placeholder-gray-400"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                確認新密碼
              </label>
              <input
                type="password"
                className="w-full border rounded px-3 py-2"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm mb-4">{error}</p>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              disabled={status === "loading"}
            >
              {status === "loading" ? "送出中..." : "送出新密碼"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
