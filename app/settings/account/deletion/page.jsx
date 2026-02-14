"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCurrentUser } from "@/contexts/CurrentUserContext";
import { notify } from "@/components/common/GlobalNotificationManager";
import axios from "axios";
import { getApiErrorMessage, isAuthError } from "@/lib/clientAuthError";

export default function AccountDeletionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser } = useCurrentUser();
  const [step, setStep] = useState(1); // 1: 輸入密碼, 2: 輸入驗證碼, 3: 確認完成
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [deletionStatus, setDeletionStatus] = useState(null);
  const [deletionScheduledAt, setDeletionScheduledAt] = useState(null);

  // 檢查是否有取消請求
  const isCancelRequest = searchParams.get("cancel") === "true";

  // 載入註銷狀態
  useEffect(() => {
    if (!currentUser) {
      router.push("/");
      return;
    }

    loadDeletionStatus();
  }, [currentUser, router]);

  // 處理取消請求
  useEffect(() => {
    if (isCancelRequest && deletionStatus?.hasDeletionRequest) {
      handleCancel();
    }
  }, [isCancelRequest, deletionStatus]);

  const loadDeletionStatus = async () => {
    try {
      const res = await axios.get("/api/account/deletion/status");
      if (res.data.success) {
        setDeletionStatus(res.data);
        if (res.data.hasDeletionRequest) {
          setDeletionScheduledAt(res.data.deletionScheduledAt);
          setStep(3); // 已申請，顯示確認頁面
        }
      }
    } catch (error) {
      if (!isAuthError(error)) {
        console.error("載入註銷狀態失敗：", error);
      }
    }
  };

  const handleSendCode = async () => {
    if (!password) {
      notify.error("錯誤", "請輸入密碼");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post("/api/account/deletion/send-code", {
        password,
      });

      if (res.data.success) {
        setDeletionScheduledAt(res.data.deletionScheduledAt);
        setStep(2);
        notify.success("成功", "驗證碼已發送到您的郵箱");
      } else {
        notify.error("錯誤", res.data.message || "發送驗證碼失敗");
      }
    } catch (error) {
      notify.error("錯誤", getApiErrorMessage(error, "發送驗證碼失敗"));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!code || code.length !== 6) {
      notify.error("錯誤", "請輸入 6 位數驗證碼");
      return;
    }

    const confirmed = await notify.confirm(
      "確認註銷帳號",
      `⚠️ 確定要註銷帳號嗎？\n\n您的帳號將在 7 天後被永久刪除，所有數據將無法恢復。\n\n在刪除前，您可以隨時取消註銷請求。`
    );

    if (!confirmed) {
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post("/api/account/deletion/confirm", { code });

      if (res.data.success) {
        setStep(3);
        setDeletionScheduledAt(res.data.deletionScheduledAt);
        notify.success("成功", "帳號註銷已確認");
        loadDeletionStatus();
      } else {
        notify.error("錯誤", res.data.message || "確認失敗");
      }
    } catch (error) {
      notify.error("錯誤", getApiErrorMessage(error, "確認失敗"));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    const confirmed = await notify.confirm(
      "取消註銷",
      "確定要取消帳號註銷請求嗎？"
    );

    if (!confirmed) {
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post("/api/account/deletion/cancel");

      if (res.data.success) {
        setDeletionStatus(null);
        setDeletionScheduledAt(null);
        setStep(1);
        notify.success("成功", "帳號註銷已取消");
        router.push("/settings/account/deletion");
      } else {
        notify.error("錯誤", res.data.message || "取消失敗");
      }
    } catch (error) {
      notify.error("錯誤", getApiErrorMessage(error, "取消失敗"));
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getDaysRemaining = (dateString) => {
    if (!dateString) return 0;
    const date = new Date(dateString);
    const now = new Date();
    const diff = date - now;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="text-gray-400 hover:text-white mb-4 flex items-center gap-2"
          >
            ← 返回
          </button>
          <h1 className="text-3xl font-bold mb-2">帳號註銷</h1>
          <p className="text-gray-400">
            註銷帳號後，您的所有數據將被永久刪除，無法恢復。
          </p>
        </div>

        {/* 步驟 1: 輸入密碼 */}
        {step === 1 && (
          <div className="bg-zinc-800/60 border border-zinc-700 rounded-lg p-6 space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">步驟 1: 驗證身份</h2>
              <p className="text-gray-400 mb-4">
                為了確保帳號安全，請輸入您的密碼以繼續。
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">密碼</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSendCode()}
                className="w-full px-4 py-2 bg-zinc-700 border border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="請輸入您的密碼"
                disabled={loading}
              />
            </div>

            <button
              onClick={handleSendCode}
              disabled={loading || !password}
              className="w-full py-3 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "發送中..." : "發送驗證碼"}
            </button>
          </div>
        )}

        {/* 步驟 2: 輸入驗證碼 */}
        {step === 2 && (
          <div className="bg-zinc-800/60 border border-zinc-700 rounded-lg p-6 space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">步驟 2: 輸入驗證碼</h2>
              <p className="text-gray-400 mb-4">
                我們已將 6 位數驗證碼發送到您的郵箱，請輸入驗證碼以確認註銷。
              </p>
              {deletionScheduledAt && (
                <div className="bg-yellow-900/20 border border-yellow-600/50 rounded-lg p-4 mb-4">
                  <p className="text-yellow-400 text-sm">
                    ⚠️ 驗證成功後，您的帳號將在{" "}
                    <strong>{formatDate(deletionScheduledAt)}</strong> 被永久刪除
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                驗證碼（6 位數）
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyPress={(e) => e.key === "Enter" && handleConfirm()}
                className="w-full px-4 py-2 bg-zinc-700 border border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-2xl tracking-widest"
                placeholder="000000"
                maxLength={6}
                disabled={loading}
              />
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => {
                  setStep(1);
                  setCode("");
                }}
                disabled={loading}
                className="flex-1 py-3 bg-zinc-700 hover:bg-zinc-600 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                返回
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading || code.length !== 6}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "確認中..." : "確認註銷"}
              </button>
            </div>
          </div>
        )}

        {/* 步驟 3: 確認完成 */}
        {step === 3 && deletionStatus?.hasDeletionRequest && (
          <div className="bg-zinc-800/60 border border-zinc-700 rounded-lg p-6 space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">註銷請求已確認</h2>
              <div className="bg-red-900/20 border border-red-600/50 rounded-lg p-4 mb-4">
                <p className="text-red-400 font-medium mb-2">
                  ⚠️ 您的帳號將在以下時間被永久刪除：
                </p>
                <p className="text-white text-lg font-semibold">
                  {formatDate(deletionStatus.deletionScheduledAt)}
                </p>
                <p className="text-gray-400 text-sm mt-2">
                  剩餘時間：{getDaysRemaining(deletionStatus.deletionScheduledAt)} 天
                </p>
              </div>

              <div className="bg-blue-900/20 border border-blue-600/50 rounded-lg p-4 mb-4">
                <p className="text-blue-400 text-sm">
                  💡 在刪除前，您可以隨時取消註銷請求。取消後，您的帳號將繼續保留。
                </p>
              </div>

              <div className="bg-yellow-900/20 border border-yellow-600/50 rounded-lg p-4">
                <p className="text-yellow-400 text-sm font-medium mb-2">
                  📋 註銷後將刪除的內容：
                </p>
                <ul className="text-gray-300 text-sm space-y-1 list-disc list-inside">
                  <li>所有上傳的作品（圖片、視頻、音樂）</li>
                  <li>所有評論和點讚記錄</li>
                  <li>所有積分和交易記錄</li>
                  <li>所有追蹤和收藏記錄</li>
                  <li>所有個人信息和設置</li>
                </ul>
              </div>
            </div>

            <button
              onClick={handleCancel}
              disabled={loading}
              className="w-full py-3 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {loading ? "取消中..." : "取消註銷請求"}
            </button>
          </div>
        )}

        {/* 安全提示 */}
        <div className="mt-6 bg-zinc-800/40 border border-zinc-700/60 rounded-lg p-4">
          <h3 className="font-semibold mb-2">🔒 安全提示</h3>
          <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
            <li>註銷流程需要驗證密碼和郵箱驗證碼，確保帳號安全</li>
            <li>帳號將在 7 天後刪除，期間可以隨時取消</li>
            <li>刪除後所有數據將無法恢復，請謹慎操作</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

