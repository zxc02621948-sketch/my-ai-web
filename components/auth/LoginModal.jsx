"use client";

import { useState, useEffect } from "react";
import { Dialog } from "@headlessui/react";
import { X } from "lucide-react";
import axios from "axios";
import ForgotPasswordModal from "./ForgotPasswordModal";

export default function LoginModal({ isOpen, onClose }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showResendButton, setShowResendButton] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const handleLogin = async () => {
    setIsLoading(true);
    setError("");
    setShowResendButton(false);

    try {
      const response = await axios.post("/api/auth/login", { email, password });
      if (response.status === 200) {
        localStorage.setItem("token", response.data.token); // ✅ 新增這行！
        window.location.reload();
      }
    } catch (err) {
      const message = err.response?.data?.message || "登入失敗，請稍後再試。";
      setError(message);
      if (message.includes("尚未驗證")) {
        setShowResendButton(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    try {
      await axios.post("/api/auth/resend-verification", { email });
      alert("驗證信已重新寄出，請至信箱確認。");
    } catch (err) {
      alert("重新寄送驗證信失敗，請稍後再試。\n錯誤訊息：" + (err.response?.data?.message || "未知錯誤"));
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleLogin();
  };

  useEffect(() => {
    if (isOpen) {
      setEmail("");
      setPassword("");
      setError("");
      setShowResendButton(false);
    }
  }, [isOpen]);

  return (
    <>
      <Dialog open={isOpen} onClose={onClose} className="fixed inset-0 z-50 overflow-y-auto">
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
        <div className="flex items-center justify-center min-h-screen px-4">
          <Dialog.Panel className="relative w-full max-w-md p-6 mx-auto bg-zinc-900 text-white rounded-xl shadow-xl">
            <button onClick={onClose} className="absolute top-4 right-4 text-zinc-400 hover:text-white">
              <X size={20} />
            </button>
            <Dialog.Title className="text-2xl font-bold mb-4">登入帳號</Dialog.Title>
            <input
              type="email"
              placeholder="Email"
              className="w-full p-2 mb-3 rounded bg-zinc-800 text-white"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <input
              type="password"
              placeholder="密碼"
              className="w-full p-2 mb-3 rounded bg-zinc-800 text-white"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            {error && <p className="text-red-400 text-sm mb-2">{error}</p>}

            {showResendButton && (
              <button
                onClick={handleResendVerification}
                className="mb-2 text-sm text-blue-400 hover:underline"
              >
                重新寄送驗證信
              </button>
            )}

            <button
              onClick={handleLogin}
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded disabled:opacity-50"
            >
              {isLoading ? "登入中..." : "登入"}
            </button>

            <div className="text-right mt-2">
              <button
                onClick={() => setShowForgotPassword(true)}
                className="text-sm text-blue-400 hover:underline"
              >
                忘記密碼？
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>

      <ForgotPasswordModal
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
      />
    </>
  );
}
