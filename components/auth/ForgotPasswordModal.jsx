"use client";

import { Dialog } from "@headlessui/react";
import { useState } from "react";
import { X } from "lucide-react";
import axios from "axios";

export default function ForgotPasswordModal({ isOpen, onClose }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!email) return setError("請輸入 Email");
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await axios.post("/api/auth/forgot-password", { email });
      setMessage("📨 重設密碼信已寄出，請查看您的信箱");
      setEmail("");
    } catch (err) {
      console.error("重設密碼發送錯誤：", err);
      setError("發送失敗：" + (err?.response?.data?.error || "請稍後再試"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-md rounded-lg bg-zinc-900 p-6 text-white shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <Dialog.Title className="text-xl font-semibold">🔑 忘記密碼</Dialog.Title>
            <button onClick={onClose}>
              <X className="w-5 h-5 text-white hover:text-red-400" />
            </button>
          </div>

          <input
            type="email"
            placeholder="請輸入註冊 Email"
            className="w-full rounded-md border border-zinc-700 bg-zinc-800 p-2 text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="mt-4 w-full rounded-md bg-blue-600 py-2 font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "發送中..." : "發送重設密碼信"}
          </button>

          {message && <p className="mt-3 text-green-400 text-sm">{message}</p>}
          {error && <p className="mt-3 text-red-400 text-sm">{error}</p>}
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
